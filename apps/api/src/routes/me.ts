import { and, asc, desc, eq, gte, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db'
import { isAdminUser, requireUser, validate, type AppEnv } from '../http'
import { canViewSong, isFavoriteExpr, songListColumns } from './songs'
import { billingSummary } from '../billing'

const { user, profile, userInstrument, song, songUserState, favorite, setlist, setlistMember, setlistItem } = schema

const profileInput = z.object({
  name: z.string().trim().min(1, 'Informe seu nome').max(120),
  role: z.enum(schema.musicianRole.enumValues).nullish(),
  city: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(1000).nullish(),
  instruments: z
    .array(z.object({ instrument: z.enum(schema.instrument.enumValues), primary: z.boolean().default(false) }))
    .max(9)
    .default([]),
  viewerPrefs: z.record(z.string(), z.unknown()).optional(),
  emailReminders: z.boolean().optional(),
})

async function loadMe(uid: string) {
  const [u] = await db.select().from(user).where(eq(user.id, uid))
  const [p] = await db.select().from(profile).where(eq(profile.userId, uid))
  const [partnerRow] = await db.select({ code: schema.partner.code }).from(schema.partner).where(eq(schema.partner.userId, uid))
  const instruments = await db
    .select({ instrument: userInstrument.instrument, primary: userInstrument.primary })
    .from(userInstrument)
    .where(eq(userInstrument.userId, uid))
    .orderBy(desc(userInstrument.primary), asc(userInstrument.instrument))
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: p?.role ?? null,
    city: p?.city ?? null,
    bio: p?.bio ?? null,
    viewerPrefs: p?.viewerPrefs ?? {},
    /** Imagens do destaque do início (vazio = o visual padrão). */
    heroImages: p?.heroImages ?? [],
    /** Lembretes por e-mail (show amanhã, fim do teste). */
    emailReminders: p?.emailReminders ?? true,
    instruments,
    /** Perfil ainda não preenchido: o app leva a pessoa ao onboarding. */
    onboarded: Boolean(p?.role) && instruments.length > 0,
    isAdmin: isAdminUser(u),
    /** Cupom de parceiro desta conta (painel do parceiro), se for parceiro. */
    partnerCode: partnerRow?.code ?? null,
    /** Teste grátis / assinatura (aviso no app e tela "Minha assinatura"). */
    billing: await billingSummary(u),
  }
}

export const meRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => c.json(await loadMe(c.var.user.id)))

  .put('/', validate('json', profileInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    const instruments = input.instruments.filter((i, idx, arr) => arr.findIndex((x) => x.instrument === i.instrument) === idx)
    // Exatamente um instrumento principal quando há instrumentos.
    if (instruments.length && !instruments.some((i) => i.primary)) instruments[0].primary = true
    let seenPrimary = false
    for (const i of instruments) {
      if (i.primary && seenPrimary) i.primary = false
      if (i.primary) seenPrimary = true
    }

    await db.transaction(async (tx) => {
      await tx.update(user).set({ name: input.name }).where(eq(user.id, uid))
      const values = {
        role: input.role ?? null,
        city: input.city ?? null,
        bio: input.bio ?? null,
        ...(input.viewerPrefs ? { viewerPrefs: input.viewerPrefs } : {}),
        ...(input.emailReminders !== undefined ? { emailReminders: input.emailReminders } : {}),
      }
      await tx
        .insert(profile)
        .values({ userId: uid, ...values })
        .onConflictDoUpdate({ target: profile.userId, set: values })
      await tx.delete(userInstrument).where(eq(userInstrument.userId, uid))
      if (instruments.length) {
        await tx.insert(userInstrument).values(instruments.map((i) => ({ ...i, userId: uid })))
      }
    })
    return c.json(await loadMe(uid))
  })

  .get('/dashboard', async (c) => {
    const uid = c.var.user.id
    const listCols = { ...songListColumns, isFavorite: isFavoriteExpr(uid) }

    const [recent, favorites, upcoming, counts] = await Promise.all([
      db
        .select({ ...listCols, lastViewedAt: songUserState.lastViewedAt })
        .from(songUserState)
        .innerJoin(song, eq(song.id, songUserState.songId))
        .innerJoin(user, eq(user.id, song.ownerId))
        .where(and(eq(songUserState.userId, uid), isNotNull(songUserState.lastViewedAt), canViewSong(uid)))
        .orderBy(desc(songUserState.lastViewedAt))
        .limit(8),
      db
        .select(listCols)
        .from(favorite)
        .innerJoin(song, eq(song.id, favorite.songId))
        .innerJoin(user, eq(user.id, song.ownerId))
        .where(and(eq(favorite.userId, uid), canViewSong(uid)))
        .orderBy(desc(favorite.createdAt))
        .limit(8),
      db
        .selectDistinct({
          id: setlist.id,
          name: setlist.name,
          eventDate: setlist.eventDate,
          location: setlist.location,
          status: setlist.status,
          isOwner: sql<boolean>`${setlist.ownerId} = ${uid}`,
        })
        .from(setlist)
        .leftJoin(setlistMember, eq(setlistMember.setlistId, setlist.id))
        .where(
          and(
            or(eq(setlist.ownerId, uid), eq(setlistMember.userId, uid)),
            eq(setlist.archived, false),
            gte(setlist.eventDate, sql`now() - interval '6 hours'`),
          ),
        )
        .orderBy(asc(setlist.eventDate))
        .limit(5),
      db
        .select({
          mySongs: sql<number>`count(*) filter (where ${song.ownerId} = ${uid})::int`,
          library: sql<number>`count(*)::int`,
        })
        .from(song)
        .where(canViewSong(uid)),
    ])

    // Capas das músicas de cada repertório próximo (mosaico no card do início).
    const items = upcoming.length
      ? await db
          .select({ setlistId: setlistItem.setlistId, title: song.title, artist: song.artist, coverUrl: song.coverUrl })
          .from(setlistItem)
          .innerJoin(song, eq(song.id, setlistItem.songId))
          .where(
            inArray(
              setlistItem.setlistId,
              upcoming.map((s) => s.id),
            ),
          )
          .orderBy(asc(setlistItem.position))
      : []
    const withSongs = upcoming.map((s) => {
      const mine = items.filter((i) => i.setlistId === s.id)
      return { ...s, songCount: mine.length, songs: mine.slice(0, 4).map(({ setlistId: _, ...rest }) => rest) }
    })

    // Primeiros passos (cartão do início para contas novas): abriu uma música, montou um
    // repertório com músicas, chamou a banda (alguém entrou ou tem convite criado).
    const [progress] = await db.execute<{ setlist: boolean; band: boolean }>(sql`
      select
        exists(select 1 from ${setlist} s join ${setlistItem} i on i.setlist_id = s.id where s.owner_id = ${uid}) as setlist,
        exists(select 1 from ${setlist} s where s.owner_id = ${uid} and (
          exists(select 1 from ${setlistMember} m where m.setlist_id = s.id and m.user_id <> ${uid})
          or exists(select 1 from ${schema.invite} v where v.setlist_id = s.id)
        )) as band
    `)
    const onboarding = { opened: recent.length > 0, setlist: !!progress?.setlist, band: !!progress?.band }

    return c.json({ recent, favorites, upcoming: withSongs, counts: counts[0], onboarding })
  })
