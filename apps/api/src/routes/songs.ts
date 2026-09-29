import { guessKey, isChord, normalizeSearch, PUBLIC_LICENSES } from '@ensaio/shared'
import { and, asc, desc, eq, exists, ilike, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db, schema } from '../db'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'

const { song, favorite, songUserState, songMark, songReport, setlistItem, setlistMember, setlist, user, changeLog } = schema

const keySchema = z
  .string()
  .trim()
  .max(8)
  .refine((k) => isChord(k), 'Tom inválido')
  .nullish()

const songFields = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(200),
  artist: z.string().trim().max(200).nullish(),
  composer: z.string().trim().max(200).nullish(),
  originalKey: keySchema,
  bpm: z.number().int().min(20).max(320).nullish(),
  timeSignature: z.string().trim().max(10).nullish(),
  style: z.string().trim().max(60).nullish(),
  notes: z.string().max(5000).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  content: z.string().max(100_000).default(''),
  lyricsAuthorized: z.boolean().default(false),
  visibility: z.enum(['private', 'shared', 'public']).default('private'),
  license: z.enum(schema.songLicense.enumValues).default('unknown'),
})

// Catálogo público só com direitos conhecidos (própria, domínio público ou licenciada).
const publicNeedsLicense = (s: { visibility: string; license: string }) =>
  s.visibility !== 'public' || (PUBLIC_LICENSES as string[]).includes(s.license)
const PUBLIC_LICENSE_MSG = {
  message: 'Para deixar a música pública, informe a licença (própria, domínio público ou licenciada).',
  path: ['license'],
}

const songInput = songFields.refine(publicNeedsLicense, PUBLIC_LICENSE_MSG)

const importInput = z.object({
  songs: z
    .array(
      songFields
        .extend({ importedFrom: z.enum(['chordpro', 'onsong', 'opensong', 'text']).nullish() })
        .refine(publicNeedsLicense, PUBLIC_LICENSE_MSG),
    )
    .min(1, 'Nenhuma música para importar')
    .max(100, 'Importe no máximo 100 músicas por vez'),
  skipDuplicates: z.boolean().default(true),
})

const markInput = z.object({
  lineIndex: z.number().int().min(0),
  type: z.enum(schema.markType.enumValues),
  text: z.string().trim().max(500).nullish(),
  instrument: z.enum(schema.instrument.enumValues).nullish(),
  shared: z.boolean().default(false),
  setlistId: z.string().uuid().nullish(),
})

type SearchFields = Pick<z.infer<typeof songFields>, 'title' | 'artist' | 'composer' | 'style' | 'originalKey' | 'tags'>

function buildSearchText(s: SearchFields) {
  return normalizeSearch(
    [s.title, s.artist, s.composer, s.style, s.originalKey, ...(s.tags ?? [])].filter(Boolean).join(' '),
  )
}

/** Músicas que o usuário pode ver: dele, públicas, ou em repertórios de que participa. */
export function canViewSong(userId: string): SQL {
  return or(
    eq(song.ownerId, userId),
    eq(song.visibility, 'public'),
    exists(
      db
        .select({ one: sql`1` })
        .from(setlistItem)
        .innerJoin(setlist, eq(setlist.id, setlistItem.setlistId))
        .leftJoin(
          setlistMember,
          and(eq(setlistMember.setlistId, setlistItem.setlistId), eq(setlistMember.userId, userId)),
        )
        .where(
          and(
            eq(setlistItem.songId, song.id),
            or(eq(setlist.ownerId, userId), eq(setlistMember.userId, userId)),
          ),
        ),
    ),
  )!
}

export function isFavoriteExpr(userId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(favorite)
      .where(and(eq(favorite.songId, song.id), eq(favorite.userId, userId))),
  )
}

export const songListColumns = {
  id: song.id,
  title: song.title,
  artist: song.artist,
  originalKey: song.originalKey,
  bpm: song.bpm,
  style: song.style,
  tags: song.tags,
  visibility: song.visibility,
  ownerId: song.ownerId,
  ownerName: user.name,
  updatedAt: song.updatedAt,
}

function dupKey(title: string, artist?: string | null) {
  return `${normalizeSearch(title)}|${normalizeSearch(artist ?? '')}`
}

/** Mapa "título|artista" → id das músicas da pessoa, para achar duplicadas na importação. */
async function ownSongKeys(userId: string) {
  const rows = await db.select({ id: song.id, title: song.title, artist: song.artist }).from(song).where(eq(song.ownerId, userId))
  return new Map(rows.map((r) => [dupKey(r.title, r.artist), r.id]))
}

async function loadOwnSong(id: string, userId: string) {
  const [row] = await db.select().from(song).where(eq(song.id, id)).limit(1)
  if (!row) notFound('Música')
  if (row.ownerId !== userId) forbidden('Só quem cadastrou a música pode alterá-la.')
  return row
}

export const songsRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get(
    '/',
    validate(
      'query',
      z.object({
        q: z.string().optional(),
        key: z.string().optional(),
        style: z.string().optional(),
        scope: z.enum(['all', 'mine', 'favorites', 'public']).default('all'),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { q, key, style, scope, limit } = c.req.valid('query')
      const where: SQL[] = [canViewSong(uid)]
      if (scope === 'mine') where.push(eq(song.ownerId, uid))
      if (scope === 'public') where.push(eq(song.visibility, 'public'))
      if (scope === 'favorites') where.push(isFavoriteExpr(uid))
      if (key) where.push(eq(song.originalKey, key))
      if (style) where.push(ilike(song.style, style))
      const terms = q ? normalizeSearch(q).split(' ').filter(Boolean) : []
      for (const t of terms) where.push(ilike(song.searchText, `%${t.replace(/[%_\\]/g, '\\$&')}%`))

      const rows = await db
        .select({ ...songListColumns, isFavorite: isFavoriteExpr(uid) })
        .from(song)
        .innerJoin(user, eq(user.id, song.ownerId))
        .where(and(...where))
        .orderBy(terms.length ? asc(song.title) : desc(song.updatedAt))
        .limit(limit)
      return c.json(rows)
    },
  )

  .get('/facets', async (c) => {
    const uid = c.var.user.id
    const styles = await db
      .selectDistinct({ style: song.style })
      .from(song)
      .where(and(canViewSong(uid), sql`${song.style} is not null`))
      .orderBy(asc(song.style))
    return c.json({ styles: styles.map((s) => s.style).filter(Boolean) })
  })

  // Quais itens da importação já existem na biblioteca da pessoa (mesmo título e artista).
  .post(
    '/import/check',
    validate(
      'json',
      z.object({
        items: z.array(z.object({ title: z.string(), artist: z.string().nullish() })).max(100),
      }),
    ),
    async (c) => {
      const { items } = c.req.valid('json')
      const existing = await ownSongKeys(c.var.user.id)
      return c.json({
        duplicates: items.map((i) => existing.get(dupKey(i.title, i.artist)) ?? null),
      })
    },
  )

  .post('/import', validate('json', importInput), async (c) => {
    const uid = c.var.user.id
    const { songs, skipDuplicates } = c.req.valid('json')
    const existing = await ownSongKeys(uid)
    const created: { id: string; title: string }[] = []
    const skipped: { title: string; reason: string }[] = []

    await db.transaction(async (tx) => {
      for (const input of songs) {
        const key = dupKey(input.title, input.artist)
        if (skipDuplicates && existing.has(key)) {
          skipped.push({ title: input.title, reason: 'Já existe na sua biblioteca' })
          continue
        }
        existing.set(key, 'nova')
        const originalKey = input.originalKey || guessKey(input.content)
        const [row] = await tx
          .insert(song)
          .values({
            ...input,
            originalKey,
            ownerId: uid,
            searchText: buildSearchText({ ...input, originalKey }),
          })
          .returning({ id: song.id, title: song.title })
        created.push(row)
      }
      if (created.length) {
        await tx.insert(changeLog).values(
          created.map((s) => ({ entityType: 'song', entityId: s.id, userId: uid, action: 'import' })),
        )
      }
    })
    return c.json({ created, skipped }, 201)
  })

  .get('/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const [row] = await db
      .select({
        song,
        ownerName: user.name,
        isFavorite: isFavoriteExpr(uid),
      })
      .from(song)
      .innerJoin(user, eq(user.id, song.ownerId))
      .where(and(eq(song.id, id), canViewSong(uid)))
      .limit(1)
    if (!row) notFound('Música')

    const [state] = await db
      .insert(songUserState)
      .values({ userId: uid, songId: id, lastViewedAt: new Date(), viewCount: 1 })
      .onConflictDoUpdate({
        target: [songUserState.userId, songUserState.songId],
        set: { lastViewedAt: new Date(), viewCount: sql`${songUserState.viewCount} + 1` },
      })
      .returning()

    const marks = await db
      .select()
      .from(songMark)
      .where(and(eq(songMark.songId, id), or(eq(songMark.authorId, uid), eq(songMark.shared, true))))
      .orderBy(asc(songMark.lineIndex))

    const { searchText: _omit, ...data } = row.song
    return c.json({
      ...data,
      ownerName: row.ownerName,
      isFavorite: row.isFavorite,
      canEdit: row.song.ownerId === uid,
      personalKey: state?.personalKey ?? null,
      marks,
    })
  })

  .post('/', validate('json', songInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    const originalKey = input.originalKey || guessKey(input.content)
    const [created] = await db
      .insert(song)
      .values({ ...input, originalKey, ownerId: uid, searchText: buildSearchText({ ...input, originalKey }) })
      .returning({ id: song.id })
    await db.insert(changeLog).values({ entityType: 'song', entityId: created.id, userId: uid, action: 'create' })
    return c.json(created, 201)
  })

  .put('/:id', validate('param', z.object({ id: z.string().uuid() })), validate('json', songInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const before = await loadOwnSong(id, uid)
    const originalKey = input.originalKey || guessKey(input.content)
    await db
      .update(song)
      .set({ ...input, originalKey, searchText: buildSearchText({ ...input, originalKey }) })
      .where(eq(song.id, id))
    // Guarda a versão anterior da cifra: permite restaurar e auditar alterações.
    const changed = Object.keys(input).filter(
      (k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((input as Record<string, unknown>)[k] ?? null),
    )
    if (changed.length) {
      await db.insert(changeLog).values({
        entityType: 'song',
        entityId: id,
        userId: uid,
        action: 'update',
        diff: { fields: changed, previousContent: changed.includes('content') ? before.content : undefined },
      })
    }
    return c.json({ id })
  })

  .delete('/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    await loadOwnSong(id, uid)
    const [used] = await db.select({ id: setlistItem.id }).from(setlistItem).where(eq(setlistItem.songId, id)).limit(1)
    if (used) {
      throw new HTTPException(409, { message: 'Esta música está em um repertório. Remova-a de lá antes de excluir.' })
    }
    await db.delete(song).where(eq(song.id, id))
    await db.insert(changeLog).values({ entityType: 'song', entityId: id, userId: uid, action: 'delete' })
    return c.body(null, 204)
  })

  .post(
    '/:id/report',
    validate('param', z.object({ id: z.string().uuid() })),
    validate(
      'json',
      z.object({
        reason: z.enum(schema.reportReason.enumValues),
        details: z.string().trim().max(2000).nullish(),
      }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { reason, details } = c.req.valid('json')
      const [target] = await db
        .select({ ownerId: song.ownerId })
        .from(song)
        .where(and(eq(song.id, id), canViewSong(uid)))
      if (!target) notFound('Música')
      if (target.ownerId === uid) forbidden('Você não pode denunciar uma música sua. Edite ou exclua.')
      // Uma denúncia por pessoa por música: denunciar de novo só atualiza o motivo.
      await db
        .insert(songReport)
        .values({ songId: id, reporterId: uid, reason, details: details ?? null })
        .onConflictDoUpdate({
          target: [songReport.songId, songReport.reporterId],
          set: { reason, details: details ?? null, status: 'open', createdAt: new Date() },
        })
      return c.json({ ok: true }, 201)
    },
  )

  .post('/:id/favorite', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const [visible] = await db.select({ id: song.id }).from(song).where(and(eq(song.id, id), canViewSong(uid)))
    if (!visible) notFound('Música')
    await db.insert(favorite).values({ userId: uid, songId: id }).onConflictDoNothing()
    return c.json({ isFavorite: true })
  })

  .delete('/:id/favorite', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const { id } = c.req.valid('param')
    await db.delete(favorite).where(and(eq(favorite.userId, c.var.user.id), eq(favorite.songId, id)))
    return c.json({ isFavorite: false })
  })

  // Tom pessoal: cada músico guarda o seu, sem alterar a música original.
  .put(
    '/:id/state',
    validate('param', z.object({ id: z.string().uuid() })),
    validate('json', z.object({ personalKey: keySchema })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { personalKey } = c.req.valid('json')
      const [visible] = await db.select({ id: song.id }).from(song).where(and(eq(song.id, id), canViewSong(uid)))
      if (!visible) notFound('Música')
      await db
        .insert(songUserState)
        .values({ userId: uid, songId: id, personalKey: personalKey ?? null })
        .onConflictDoUpdate({
          target: [songUserState.userId, songUserState.songId],
          set: { personalKey: personalKey ?? null },
        })
      return c.json({ personalKey: personalKey ?? null })
    },
  )

  .post(
    '/:id/marks',
    validate('param', z.object({ id: z.string().uuid() })),
    validate('json', markInput),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      const [visible] = await db.select({ id: song.id }).from(song).where(and(eq(song.id, id), canViewSong(uid)))
      if (!visible) notFound('Música')
      const [mark] = await db.insert(songMark).values({ ...input, songId: id, authorId: uid }).returning()
      return c.json(mark, 201)
    },
  )

  .delete(
    '/:id/marks/:markId',
    validate('param', z.object({ id: z.string().uuid(), markId: z.string().uuid() })),
    async (c) => {
      const { id, markId } = c.req.valid('param')
      const deleted = await db
        .delete(songMark)
        .where(and(eq(songMark.id, markId), eq(songMark.songId, id), eq(songMark.authorId, c.var.user.id)))
        .returning({ id: songMark.id })
      if (!deleted.length) notFound('Marcação')
      return c.body(null, 204)
    },
  )
