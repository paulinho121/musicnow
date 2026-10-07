import { atLeast, guessKey, isChord, normalizeSearch, PUBLIC_LICENSES, stripLyrics, youtubeId } from '@ensaio/shared'
import { and, asc, desc, eq, exists, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { getRole } from '../access'
import { assertCanCreate } from '../billing'
import { COVER_URL_RE } from '../covers'
import { removeScoreFiles, scoresOfSong } from './scores'
import { publish } from '../realtime'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'

const { song, songShare, favorite, songUserState, songMark, songReport, setlistItem, setlistMember, setlist, user, changeLog } = schema

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
  // Só links do YouTube: são tocados no player oficial (forma permitida de ouvir a gravação).
  referenceUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => youtubeId(u) !== null, 'Use um link do YouTube (youtube.com ou youtu.be).')
    .nullish(),
  // Capa: link do Cover Art Archive, '' (capa gerada pelo app) ou null (procurar sozinho).
  coverUrl: z.union([z.literal(''), z.string().regex(COVER_URL_RE, 'Capa inválida')]).nullish(),
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
        .extend({ importedFrom: z.enum(['chordpro', 'onsong', 'opensong', 'text', 'guitarpro', 'word']).nullish() })
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
  return normalizeSearch([s.title, s.artist, s.composer, s.style, s.originalKey, ...(s.tags ?? [])].filter(Boolean).join(' '))
}

/** Músicas que o usuário pode ver: dele, públicas, ou em repertórios de que participa. */
export function canViewSong(userId: string): SQL {
  return or(
    eq(song.ownerId, userId),
    eq(song.visibility, 'public'),
    // Compartilhada com a pessoa pelo link da música.
    exists(
      db
        .select({ one: sql`1` })
        .from(songShare)
        .where(and(eq(songShare.songId, song.id), eq(songShare.userId, userId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(setlistItem)
        .innerJoin(setlist, eq(setlist.id, setlistItem.setlistId))
        .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlistItem.setlistId), eq(setlistMember.userId, userId)))
        .where(and(eq(setlistItem.songId, song.id), or(eq(setlist.ownerId, userId), eq(setlistMember.userId, userId)))),
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
  createdAt: song.createdAt,
  /** false = só nome e tom (ainda sem cifra). */
  hasContent: sql<boolean>`length(trim(${song.content})) > 0`,
  coverUrl: song.coverUrl,
  usageSetlists: song.usageSetlists,
  usagePeople: song.usagePeople,
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

// ---------------------------------------------------------------------------
// Compartilhar uma música por link (fora de repertório)

// 10 caracteres sem letras ambíguas (0/O, 1/I/L): ~800 trilhões de combinações.
const SHARE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const newShareCode = () => Array.from({ length: 10 }, () => SHARE_ALPHABET[randomInt(SHARE_ALPHABET.length)]).join('')
const shareUrl = (code: string) => `${env.APP_URL}/compartilhado/${code}`

/** Quem tem a música (para a dona ver e remover). */
async function sharesOf(songId: string) {
  return db
    .select({ userId: songShare.userId, name: user.name, image: user.image, createdAt: songShare.createdAt })
    .from(songShare)
    .innerJoin(user, eq(user.id, songShare.userId))
    .where(eq(songShare.songId, songId))
    .orderBy(asc(songShare.createdAt))
}

/** Abrir o link: prévia e "adicionar à minha biblioteca". Funciona para qualquer conta logada. */
export const sharedSongRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get('/:code', validate('param', z.object({ code: z.string().regex(/^[A-Z2-9]{10}$/) })), async (c) => {
    const uid = c.var.user.id
    const { code } = c.req.valid('param')
    const [row] = await db
      .select({ id: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl, ownerId: song.ownerId, ownerName: user.name })
      .from(song)
      .innerJoin(user, eq(user.id, song.ownerId))
      .where(eq(song.shareCode, code))
    if (!row) notFound('Link de música')
    const [has] = await db
      .select({ one: sql`1` })
      .from(songShare)
      .where(and(eq(songShare.songId, row.id), eq(songShare.userId, uid)))
    const { ownerId, ...preview } = row
    return c.json({ ...preview, isOwner: ownerId === uid, alreadyHas: ownerId === uid || Boolean(has) })
  })
  .post('/:code/accept', validate('param', z.object({ code: z.string().regex(/^[A-Z2-9]{10}$/) })), async (c) => {
    const uid = c.var.user.id
    const { code } = c.req.valid('param')
    const [row] = await db.select({ id: song.id, ownerId: song.ownerId }).from(song).where(eq(song.shareCode, code))
    if (!row) notFound('Link de música')
    if (row.ownerId !== uid) await db.insert(songShare).values({ songId: row.id, userId: uid }).onConflictDoNothing()
    return c.json({ songId: row.id }, 201)
  })

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
        scope: z.enum(['all', 'mine', 'favorites', 'public', 'shared']).default('all'),
        limit: z.coerce.number().int().min(1).max(1000).default(50),
      }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { q, key, style, scope, limit } = c.req.valid('query')
      const where: SQL[] = [canViewSong(uid)]
      if (scope === 'mine') where.push(eq(song.ownerId, uid))
      if (scope === 'public') where.push(eq(song.visibility, 'public'))
      if (scope === 'favorites') where.push(isFavoriteExpr(uid))
      if (scope === 'shared')
        where.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(songShare)
              .where(and(eq(songShare.songId, song.id), eq(songShare.userId, uid))),
          ),
        )
      if (key) where.push(eq(song.originalKey, key))
      if (style) where.push(ilike(song.style, style))
      const terms = q ? normalizeSearch(q).split(' ').filter(Boolean) : []
      for (const t of terms) where.push(ilike(song.searchText, `%${t.replace(/[%_\\]/g, '\\$&')}%`))

      const rows = await db
        .select({ ...songListColumns, isFavorite: isFavoriteExpr(uid) })
        .from(song)
        .innerJoin(user, eq(user.id, song.ownerId))
        .where(and(...where))
        // Músicas públicas: as mais usadas por outros músicos primeiro (cifra testada no palco).
        .orderBy(
          ...(scope === 'public' ? [desc(song.usagePeople), desc(song.usageSetlists)] : []),
          terms.length ? asc(song.title) : desc(song.updatedAt),
        )
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
    await assertCanCreate(uid)
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
        await tx.insert(changeLog).values(created.map((s) => ({ entityType: 'song', entityId: s.id, userId: uid, action: 'import' })))
      }
    })
    return c.json({ created, skipped }, 201)
  })

  .get(
    '/:id',
    validate('param', z.object({ id: z.string().uuid() })),
    // setlistId: a música está sendo vista dentro de um repertório (traz as marcações da banda).
    validate('query', z.object({ setlistId: z.string().uuid().optional() })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const access = c.req.valid('query').setlistId ? await getRole(c.req.valid('query').setlistId!, uid) : null
      const setlistId = access ? c.req.valid('query').setlistId! : null
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

      // Marcações visíveis: as minhas (gerais ou deste repertório), as compartilhadas pela
      // dona da música e, dentro de um repertório, as compartilhadas com a banda.
      const marks = await db
        .select({ mark: songMark, authorName: user.name })
        .from(songMark)
        .innerJoin(user, eq(user.id, songMark.authorId))
        .where(
          and(
            eq(songMark.songId, id),
            or(
              and(
                eq(songMark.authorId, uid),
                setlistId ? or(isNull(songMark.setlistId), eq(songMark.setlistId, setlistId)) : isNull(songMark.setlistId),
              ),
              and(eq(songMark.shared, true), isNull(songMark.setlistId), eq(songMark.authorId, row.song.ownerId)),
              setlistId ? and(eq(songMark.shared, true), eq(songMark.setlistId, setlistId)) : undefined,
            ),
          ),
        )
        .orderBy(asc(songMark.lineIndex), asc(songMark.createdAt))
      const scores = await scoresOfSong(id)
      const [shared] = await db
        .select({ one: sql`1` })
        .from(songShare)
        .where(and(eq(songShare.songId, id), eq(songShare.userId, uid)))

      const { searchText: _omit, shareCode: _code, ...data } = row.song
      const isOwner = row.song.ownerId === uid
      // Letra sem autorização só sai para quem cadastrou; os outros recebem apenas acordes e seções.
      const lyricsHidden = !row.song.lyricsAuthorized && !isOwner
      return c.json({
        ...data,
        content: lyricsHidden ? stripLyrics(data.content) : data.content,
        lyricsHidden,
        ownerName: row.ownerName,
        isFavorite: row.isFavorite,
        canEdit: isOwner,
        personalKey: state?.personalKey ?? null,
        marks: marks.map((m) => ({ ...m.mark, authorName: m.authorName })),
        scores,
        /** Recebida pelo link de compartilhamento (pode sair dela). */
        sharedWithMe: Boolean(shared),
        setlistRole: access?.role ?? null,
        // Fora de repertório só a dona compartilha marcações; dentro, quem tem permissão de marcar.
        canShareMarks: access ? atLeast(access.role, 'mark') : isOwner,
      })
    },
  )

  .post('/', validate('json', songInput), async (c) => {
    const uid = c.var.user.id
    await assertCanCreate(uid)
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
    await assertCanCreate(uid)
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const before = await loadOwnSong(id, uid)
    const originalKey = input.originalKey || guessKey(input.content)
    // Mudou o nome ou o artista e a capa ainda não foi decidida: procura de novo logo.
    const renamed = before.title !== input.title || (before.artist ?? null) !== (input.artist ?? null)
    const coverUrl = input.coverUrl === undefined ? before.coverUrl : input.coverUrl
    await db
      .update(song)
      .set({
        ...input,
        originalKey,
        searchText: buildSearchText({ ...input, originalKey }),
        coverUrl,
        coverCheckedAt: coverUrl !== null ? new Date() : renamed ? null : before.coverCheckedAt,
      })
      .where(eq(song.id, id))
    // Guarda a versão anterior da cifra: permite restaurar e auditar alterações.
    const changed = Object.keys(input).filter(
      (k) =>
        JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((input as Record<string, unknown>)[k] ?? null),
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
    const scoreIds = (await scoresOfSong(id)).map((s) => s.id)
    await db.delete(song).where(eq(song.id, id))
    await removeScoreFiles(scoreIds)
    await db.insert(changeLog).values({ entityType: 'song', entityId: id, userId: uid, action: 'delete' })
    return c.body(null, 204)
  })

  // ---- compartilhar por link (só a dona)
  .get('/:id/share', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const row = await loadOwnSong(c.req.valid('param').id, c.var.user.id)
    return c.json({ url: row.shareCode ? shareUrl(row.shareCode) : null, people: await sharesOf(row.id) })
  })

  // Cria o link (ou troca por um novo: o antigo deixa de funcionar).
  .post(
    '/:id/share',
    validate('param', z.object({ id: z.string().uuid() })),
    validate('json', z.object({ rotate: z.boolean().default(false) })),
    async (c) => {
      const uid = c.var.user.id
      const row = await loadOwnSong(c.req.valid('param').id, uid)
      await assertCanCreate(uid)
      let code = row.shareCode
      if (!code || c.req.valid('json').rotate) {
        code = newShareCode()
        await db.update(song).set({ shareCode: code }).where(eq(song.id, row.id))
      }
      return c.json({ url: shareUrl(code) })
    },
  )

  // Desliga o link (quem já recebeu continua com a música).
  .delete('/:id/share', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const row = await loadOwnSong(c.req.valid('param').id, c.var.user.id)
    await db.update(song).set({ shareCode: null }).where(eq(song.id, row.id))
    return c.body(null, 204)
  })

  // Tirar o acesso de alguém (a dona) ou sair da música compartilhada (a própria pessoa).
  .delete('/:id/share/:userId', validate('param', z.object({ id: z.string().uuid(), userId: z.string().min(1) })), async (c) => {
    const uid = c.var.user.id
    const { id, userId } = c.req.valid('param')
    const target = userId === 'eu' ? uid : userId
    if (target !== uid) await loadOwnSong(id, uid)
    await db.delete(songShare).where(and(eq(songShare.songId, id), eq(songShare.userId, target)))
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
    const [visible] = await db
      .select({ id: song.id })
      .from(song)
      .where(and(eq(song.id, id), canViewSong(uid)))
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
      const [visible] = await db
        .select({ id: song.id })
        .from(song)
        .where(and(eq(song.id, id), canViewSong(uid)))
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

  .post('/:id/marks', validate('param', z.object({ id: z.string().uuid() })), validate('json', markInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const [visible] = await db
      .select({ id: song.id, ownerId: song.ownerId })
      .from(song)
      .where(and(eq(song.id, id), canViewSong(uid)))
    if (!visible) notFound('Música')
    if (input.setlistId) {
      const access = await getRole(input.setlistId, uid)
      if (!access) notFound('Repertório')
      const [inSetlist] = await db
        .select({ id: setlistItem.id })
        .from(setlistItem)
        .where(and(eq(setlistItem.setlistId, input.setlistId), eq(setlistItem.songId, id)))
      if (!inSetlist) notFound('Música do repertório')
      if (input.shared && !atLeast(access.role, 'mark')) {
        forbidden('Sua permissão neste repertório só permite marcações pessoais.')
      }
    } else if (input.shared && visible.ownerId !== uid) {
      forbidden('Só quem cadastrou a música pode criar marcações compartilhadas fora de um repertório.')
    }
    const [mark] = await db
      .insert(songMark)
      .values({ ...input, songId: id, authorId: uid })
      .returning()
    // Marcação da banda: os aparelhos com o repertório aberto atualizam a cifra na hora.
    if (mark.setlistId && mark.shared) publish(mark.setlistId, 'marks', { songId: id })
    return c.json(mark, 201)
  })

  .delete('/:id/marks/:markId', validate('param', z.object({ id: z.string().uuid(), markId: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id, markId } = c.req.valid('param')
    const [mark] = await db
      .select({ authorId: songMark.authorId, setlistId: songMark.setlistId })
      .from(songMark)
      .where(and(eq(songMark.id, markId), eq(songMark.songId, id)))
    if (!mark) notFound('Marcação')
    // Quem criou apaga; num repertório, quem administra também pode apagar a de qualquer um.
    const access = mark.setlistId ? await getRole(mark.setlistId, uid) : null
    if (mark.authorId !== uid && !atLeast(access?.role, 'admin')) notFound('Marcação')
    await db.delete(songMark).where(eq(songMark.id, markId))
    if (mark.setlistId) publish(mark.setlistId, 'marks', { songId: id })
    return c.body(null, 204)
  })
