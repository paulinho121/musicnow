import { atLeast, isChord, normalizeSearch, parseSetlistText, type SetlistRole } from '@ensaio/shared'
import { and, asc, desc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { streamSSE } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'
import { sendSetlistInviteEmail } from '../mail'
import { getRole } from '../access'
import {
  closeRoom,
  connectionsOf,
  getStage,
  join,
  kick,
  LIMITS,
  notifyChanged,
  presence,
  setFollowing,
  stopStage,
  totalConnections,
  updateStage,
} from '../realtime'
import { canViewSong } from './songs'

const { setlist, setlistItem, setlistBlock, setlistMember, setlistSuggestion, invite, song, user, userInstrument, songUserState, changeLog } =
  schema

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// ---------------------------------------------------------------------------
// Acesso

/** Exige um papel mínimo. Quem não participa recebe 404 (não revelamos que o repertório existe). */
async function requireRole(setlistId: string, userId: string, min: SetlistRole) {
  const access = await getRole(setlistId, userId)
  if (!access) notFound('Repertório')
  if (!atLeast(access.role, min)) {
    forbidden(
      min === 'admin' || min === 'owner'
        ? 'Só quem administra o repertório pode fazer isso.'
        : 'Sua permissão neste repertório não permite isso.',
    )
  }
  return access
}

/** Toda alteração sobe a revisão (os aparelhos da banda sabem que precisam atualizar) e vai para o histórico. */
async function touch(tx: Tx, setlistId: string, userId: string, action: string, diff?: Record<string, unknown>) {
  await tx
    .update(setlist)
    .set({ revision: sql`${setlist.revision} + 1`, updatedAt: new Date() })
    .where(eq(setlist.id, setlistId))
  await tx.insert(changeLog).values({ entityType: 'setlist', entityId: setlistId, userId, action, diff: diff ?? null })
}

/**
 * Deixa as posições contínuas na ordem de tocar: primeiro as músicas sem bloco,
 * depois cada bloco na sua ordem (e, dentro dele, na ordem das músicas).
 */
async function renumber(tx: Tx, setlistId: string) {
  await tx.execute(sql`
    update ${setlistBlock} b set position = r.rn - 1
    from (select id, row_number() over (order by position, id) as rn from ${setlistBlock} where setlist_id = ${setlistId}) r
    where b.id = r.id`)
  await tx.execute(sql`
    update ${setlistItem} si set position = r.rn - 1
    from (
      select i.id, row_number() over (order by (b.id is not null), b.position, i.position, i.id) as rn
      from ${setlistItem} i left join ${setlistBlock} b on b.id = i.block_id
      where i.setlist_id = ${setlistId}
    ) r
    where si.id = r.id`)
}

async function requireBlock(tx: Tx, setlistId: string, blockId: string) {
  const [b] = await tx
    .select({ id: setlistBlock.id, name: setlistBlock.name })
    .from(setlistBlock)
    .where(and(eq(setlistBlock.id, blockId), eq(setlistBlock.setlistId, setlistId)))
  if (!b) notFound('Bloco')
  return b
}

/**
 * Depois de qualquer escrita bem-sucedida num repertório, avisa os aparelhos conectados
 * (já com a transação concluída, para eles não lerem dados antigos).
 */
async function announce(setlistId: string) {
  const [r] = await db.select({ revision: setlist.revision }).from(setlist).where(eq(setlist.id, setlistId))
  if (r) notifyChanged(setlistId, r.revision)
}

const SETLIST_PATH = /^\/api\/setlists\/([0-9a-f-]{36})(\/.*)?$/
const announceWrites = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  if (c.req.method === 'GET' || c.res.status >= 400) return
  const m = SETLIST_PATH.exec(c.req.path)
  if (!m) return
  const [, id, rest = ''] = m
  if (/^\/(stage|presence|events|duplicate)$/.test(rest)) return
  if (c.req.method === 'DELETE' && rest === '') return closeRoom(id)
  await announce(id).catch(() => {})
})

// Código de convite: 8 caracteres sem letras ambíguas (0/O, 1/I/L). ~1 trilhão de combinações.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function newInviteCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

const inviteUrl = (code: string) => `${env.APP_URL}/convite/${code}`

// ---------------------------------------------------------------------------
// Validação

const idParam = z.object({ id: z.string().uuid() })
const keySchema = z
  .string()
  .trim()
  .max(8)
  .refine((k) => isChord(k), 'Tom inválido')
  .nullish()

const setlistInput = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao repertório').max(120),
  eventDate: z.coerce.date().nullish(),
  location: z.string().trim().max(160).nullish(),
  groupName: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(5000).nullish(),
  status: z.enum(schema.setlistStatus.enumValues).default('rascunho'),
})

const blockInput = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao bloco').max(80),
  style: z.string().trim().max(80).nullish(),
  bpm: z.number().int().min(20).max(320).nullish(),
  notes: z.string().trim().max(500).nullish(),
})

const itemInput = z.object({
  key: keySchema,
  bpm: z.number().int().min(20).max(320).nullish(),
  notes: z.string().trim().max(1000).nullish(),
})

// ---------------------------------------------------------------------------

export const setlistsRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .use(announceWrites)

  .get('/', async (c) => {
    const uid = c.var.user.id
    const rows = await db
      .select({
        id: setlist.id,
        name: setlist.name,
        eventDate: setlist.eventDate,
        location: setlist.location,
        groupName: setlist.groupName,
        status: setlist.status,
        archived: setlist.archived,
        updatedAt: setlist.updatedAt,
        ownerId: setlist.ownerId,
        ownerName: user.name,
        myPermission: setlistMember.permission,
        itemCount: sql<number>`(select count(*)::int from ${setlistItem} where ${setlistItem.setlistId} = ${setlist.id})`,
        memberCount: sql<number>`(select count(*)::int from ${setlistMember} m where m.setlist_id = ${setlist.id})`,
      })
      .from(setlist)
      .innerJoin(user, eq(user.id, setlist.ownerId))
      .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, uid)))
      .where(or(eq(setlist.ownerId, uid), eq(setlistMember.userId, uid)))
      .orderBy(asc(setlist.eventDate), desc(setlist.updatedAt))
    return c.json(
      rows.map(({ myPermission, ...r }) => ({ ...r, role: (r.ownerId === uid ? 'owner' : myPermission) as SetlistRole })),
    )
  })

  .post('/', validate('json', setlistInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(setlist).values({ ...input, ownerId: uid }).returning({ id: setlist.id })
      await tx.insert(changeLog).values({ entityType: 'setlist', entityId: row.id, userId: uid, action: 'create' })
      return row
    })
    return c.json(created, 201)
  })

  .get('/:id', validate('param', idParam), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { role } = await requireRole(id, uid, 'view')
    const isAdmin = atLeast(role, 'admin')

    const [s] = await db
      .select({ setlist, ownerName: user.name })
      .from(setlist)
      .innerJoin(user, eq(user.id, setlist.ownerId))
      .where(eq(setlist.id, id))

    const [items, members, suggestions, invites, parent, blocks] = await Promise.all([
      db
        .select({
          id: setlistItem.id,
          blockId: setlistItem.blockId,
          position: setlistItem.position,
          key: setlistItem.key,
          bpm: setlistItem.bpm,
          notes: setlistItem.notes,
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            originalKey: song.originalKey,
            bpm: song.bpm,
            timeSignature: song.timeSignature,
            coverUrl: song.coverUrl,
            hasContent: sql<boolean>`length(${song.content}) > 0`,
          },
          personalKey: songUserState.personalKey,
        })
        .from(setlistItem)
        .innerJoin(song, eq(song.id, setlistItem.songId))
        .leftJoin(songUserState, and(eq(songUserState.songId, song.id), eq(songUserState.userId, uid)))
        .where(eq(setlistItem.setlistId, id))
        .orderBy(asc(setlistItem.position)),
      db
        .select({
          userId: setlistMember.userId,
          name: user.name,
          image: user.image,
          permission: setlistMember.permission,
          instrument: sql<string | null>`coalesce(${setlistMember.instrument}::text, (select ui.instrument::text from ${userInstrument} ui where ui.user_id = ${user.id} and ui."primary" limit 1))`,
          joinedAt: setlistMember.joinedAt,
        })
        .from(setlistMember)
        .innerJoin(user, eq(user.id, setlistMember.userId))
        .where(eq(setlistMember.setlistId, id))
        .orderBy(asc(setlistMember.joinedAt)),
      db
        .select({
          id: setlistSuggestion.id,
          itemId: setlistSuggestion.itemId,
          proposedKey: setlistSuggestion.proposedKey,
          message: setlistSuggestion.message,
          status: setlistSuggestion.status,
          createdAt: setlistSuggestion.createdAt,
          authorId: setlistSuggestion.authorId,
          authorName: user.name,
        })
        .from(setlistSuggestion)
        .innerJoin(user, eq(user.id, setlistSuggestion.authorId))
        .where(
          and(
            eq(setlistSuggestion.setlistId, id),
            // Quem administra vê as sugestões abertas; os demais, só as próprias.
            isAdmin ? eq(setlistSuggestion.status, 'open') : eq(setlistSuggestion.authorId, uid),
          ),
        )
        .orderBy(desc(setlistSuggestion.createdAt))
        .limit(50),
      isAdmin
        ? db
            .select({
              id: invite.id,
              code: invite.code,
              email: invite.email,
              permission: invite.permission,
              uses: invite.uses,
              maxUses: invite.maxUses,
              expiresAt: invite.expiresAt,
            })
            .from(invite)
            .where(
              and(
                eq(invite.setlistId, id),
                isNull(invite.revokedAt),
                or(isNull(invite.expiresAt), gt(invite.expiresAt, new Date())),
              ),
            )
            .orderBy(desc(invite.createdAt))
        : Promise.resolve([]),
      s.setlist.parentId
        ? db
            .select({ id: setlist.id, name: setlist.name })
            .from(setlist)
            .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, uid)))
            .where(and(eq(setlist.id, s.setlist.parentId), or(eq(setlist.ownerId, uid), eq(setlistMember.userId, uid))))
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
      db
        .select({ id: setlistBlock.id, name: setlistBlock.name, style: setlistBlock.style, bpm: setlistBlock.bpm, notes: setlistBlock.notes })
        .from(setlistBlock)
        .where(eq(setlistBlock.setlistId, id))
        .orderBy(asc(setlistBlock.position)),
    ])

    const [ownerInstrument] = await db
      .select({ instrument: userInstrument.instrument })
      .from(userInstrument)
      .where(and(eq(userInstrument.userId, s.setlist.ownerId), eq(userInstrument.primary, true)))

    return c.json({
      ...s.setlist,
      ownerName: s.ownerName,
      role,
      parent,
      blocks,
      items,
      members: [
        {
          userId: s.setlist.ownerId,
          name: s.ownerName,
          image: null,
          permission: 'owner' as const,
          instrument: ownerInstrument?.instrument ?? null,
          joinedAt: s.setlist.createdAt,
        },
        ...members,
      ],
      suggestions,
      stage: getStage(id),
      invites: invites.filter((i) => i.maxUses == null || i.uses < i.maxUses).map((i) => ({ ...i, url: inviteUrl(i.code) })),
    })
  })

  // Só a revisão: os aparelhos consultam isto a cada poucos segundos para saber se algo mudou.
  .get('/:id/revision', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await requireRole(id, c.var.user.id, 'view')
    const [r] = await db.select({ revision: setlist.revision }).from(setlist).where(eq(setlist.id, id))
    return c.json(r)
  })

  // ---------------------------------------------------------------- tempo real

  // Conexão ao vivo (SSE): avisos de alteração, Modo Palco e quem está conectado.
  .get('/:id/events', validate('param', idParam), async (c) => {
    const me = c.var.user
    const { id } = c.req.valid('param')
    await requireRole(id, me.id, 'view')
    if (totalConnections() >= LIMITS.total) {
      throw new HTTPException(503, { message: 'Muitas conexões ao vivo agora. Tente em instantes.' })
    }
    if (connectionsOf(id, me.id) >= LIMITS.perUserPerRoom) {
      throw new HTTPException(429, { message: 'Este repertório já está aberto em muitos aparelhos seus.' })
    }
    const [r] = await db.select({ revision: setlist.revision }).from(setlist).where(eq(setlist.id, id))

    return streamSSE(c, async (stream) => {
      let open = true
      const send = (event: string, data: unknown) =>
        open ? stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {}) : undefined
      const conn = join(id, { id: me.id, name: me.name }, send, () => {
        open = false
        void stream.close()
      })
      stream.onAbort(() => {
        open = false
        conn.leave()
      })
      await stream.writeSSE({
        event: 'hello',
        // retry: o navegador espera 3 s antes de reconectar se a conexão cair.
        retry: 3000,
        data: JSON.stringify({ clientId: conn.id, revision: r.revision, stage: getStage(id), presence: presence(id) }),
      })
      // Sinal de vida a cada 25 s: proxies e redes móveis derrubam conexões silenciosas.
      while (open) {
        await stream.sleep(25_000)
        if (open) await stream.writeSSE({ event: 'ping', data: '{}' }).catch(() => (open = false))
      }
      conn.leave()
    })
  })

  // Modo Palco: quem administra comanda; os aparelhos que estão seguindo vão junto.
  .post(
    '/:id/stage',
    validate('param', idParam),
    validate(
      'json',
      z.object({
        action: z.enum(['go', 'stop']),
        position: z.number().int().min(0).optional(),
        section: z.number().int().min(0).nullish(),
      }),
    ),
    async (c) => {
      const me = c.var.user
      const { id } = c.req.valid('param')
      const { action, position, section } = c.req.valid('json')
      await requireRole(id, me.id, 'admin')
      if (action === 'stop') {
        stopStage(id)
        return c.json({ stage: null })
      }
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(setlistItem)
        .where(eq(setlistItem.setlistId, id))
      if (position === undefined || position >= n) {
        throw new HTTPException(400, { message: 'Posição fora do repertório.' })
      }
      // Outro admin pode assumir o comando a qualquer momento (ex.: o líder ficou sem bateria).
      const stage = updateStage(id, { leaderId: me.id, leaderName: me.name, position, section: section ?? null })
      return c.json({ stage })
    },
  )

  .post(
    '/:id/presence',
    validate('param', idParam),
    validate('json', z.object({ clientId: z.string().uuid(), following: z.boolean() })),
    async (c) => {
      const { id } = c.req.valid('param')
      const { clientId, following } = c.req.valid('json')
      // Só a própria pessoa muda o estado da própria conexão.
      if (!setFollowing(id, clientId, c.var.user.id, following)) notFound('Conexão')
      return c.json({ following })
    },
  )

  .put('/:id', validate('param', idParam), validate('json', setlistInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    await requireRole(id, uid, 'admin')
    await db.transaction(async (tx) => {
      await tx.update(setlist).set(input).where(eq(setlist.id, id))
      await touch(tx, id, uid, 'update', { fields: Object.keys(input) })
    })
    return c.json({ id })
  })

  .post(
    '/:id/archive',
    validate('param', idParam),
    validate('json', z.object({ archived: z.boolean() })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { archived } = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      await db.transaction(async (tx) => {
        await tx.update(setlist).set({ archived }).where(eq(setlist.id, id))
        await touch(tx, id, uid, archived ? 'archive' : 'unarchive')
      })
      return c.json({ archived })
    },
  )

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await requireRole(id, c.var.user.id, 'owner')
    await db.delete(setlist).where(eq(setlist.id, id))
    return c.body(null, 204)
  })

  // Duplicar só para quem administra: um músico que só vê não pode copiar as
  // músicas (às vezes privadas) do líder para um repertório próprio e compartilhá-lo.
  .post(
    '/:id/duplicate',
    validate('param', idParam),
    validate('json', z.object({ name: z.string().trim().min(1).max(120).optional(), asVersion: z.boolean().default(false) })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { name, asVersion } = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      const created = await db.transaction(async (tx) => {
        const [src] = await tx.select().from(setlist).where(eq(setlist.id, id))
        const [copy] = await tx
          .insert(setlist)
          .values({
            ownerId: uid,
            parentId: asVersion ? src.id : null,
            name: name ?? `${src.name} (${asVersion ? 'nova versão' : 'cópia'})`,
            eventDate: asVersion ? src.eventDate : null,
            location: src.location,
            groupName: src.groupName,
            notes: src.notes,
            status: 'rascunho',
          })
          .returning({ id: setlist.id })
        const blocks = await tx.select().from(setlistBlock).where(eq(setlistBlock.setlistId, id))
        const blockMap = new Map<string, string>()
        for (const { id: oldId, setlistId: _s, ...b } of blocks) {
          const [nb] = await tx.insert(setlistBlock).values({ ...b, setlistId: copy.id }).returning({ id: setlistBlock.id })
          blockMap.set(oldId, nb.id)
        }
        const items = await tx.select().from(setlistItem).where(eq(setlistItem.setlistId, id)).orderBy(asc(setlistItem.position))
        if (items.length) {
          await tx.insert(setlistItem).values(
            items.map(({ id: _id, setlistId: _s, blockId, ...it }) => ({
              ...it,
              setlistId: copy.id,
              blockId: blockId ? (blockMap.get(blockId) ?? null) : null,
            })),
          )
        }
        await tx.insert(changeLog).values({
          entityType: 'setlist',
          entityId: copy.id,
          userId: uid,
          action: asVersion ? 'version' : 'duplicate',
          diff: { from: id },
        })
        return copy
      })
      return c.json(created, 201)
    },
  )

  // ---------------------------------------------------------------- músicas

  .post(
    '/:id/items',
    validate('param', idParam),
    validate('json', itemInput.extend({ songId: z.string().uuid(), blockId: z.string().uuid().nullish() })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { songId, blockId, ...input } = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      const [visible] = await db.select({ id: song.id, title: song.title }).from(song).where(and(eq(song.id, songId), canViewSong(uid)))
      if (!visible) notFound('Música')
      const item = await db.transaction(async (tx) => {
        if (blockId) await requireBlock(tx, id, blockId)
        const [{ next }] = await tx
          .select({ next: sql<number>`coalesce(max(${setlistItem.position}) + 1, 0)::int` })
          .from(setlistItem)
          .where(eq(setlistItem.setlistId, id))
        const [row] = await tx
          .insert(setlistItem)
          .values({ ...input, setlistId: id, songId, blockId: blockId ?? null, position: next })
          .returning({ id: setlistItem.id })
        // Entra no fim do bloco escolhido.
        if (blockId) await renumber(tx, id)
        await touch(tx, id, uid, 'add_song', { songId, title: visible.title })
        return row
      })
      return c.json(item, 201)
    },
  )

  .put(
    '/:id/items/:itemId',
    validate('param', idParam.extend({ itemId: z.string().uuid() })),
    validate('json', itemInput),
    async (c) => {
      const uid = c.var.user.id
      const { id, itemId } = c.req.valid('param')
      const input = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(setlistItem)
          .set({ key: input.key ?? null, bpm: input.bpm ?? null, notes: input.notes ?? null })
          .where(and(eq(setlistItem.id, itemId), eq(setlistItem.setlistId, id)))
          .returning({ id: setlistItem.id })
        if (!updated.length) notFound('Música do repertório')
        await touch(tx, id, uid, 'update_song', { itemId, ...input })
      })
      return c.json({ id: itemId })
    },
  )

  .delete('/:id/items/:itemId', validate('param', idParam.extend({ itemId: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id, itemId } = c.req.valid('param')
    await requireRole(id, uid, 'admin')
    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(setlistItem)
        .where(and(eq(setlistItem.id, itemId), eq(setlistItem.setlistId, id)))
        .returning({ songId: setlistItem.songId })
      if (!deleted.length) notFound('Música do repertório')
      // Mantém as posições contínuas (0, 1, 2...).
      await renumber(tx, id)
      await touch(tx, id, uid, 'remove_song', { songId: deleted[0].songId })
    })
    return c.body(null, 204)
  })

  .put(
    '/:id/order',
    validate('param', idParam),
    validate(
      'json',
      z.union([
        z.object({ itemIds: z.array(z.string().uuid()).max(300) }),
        // Com blocos: a ordem dos blocos e das músicas dentro de cada um (blockId null = sem bloco).
        z.object({
          layout: z.array(z.object({ blockId: z.string().uuid().nullable(), itemIds: z.array(z.string().uuid()).max(300) })).max(61),
        }),
      ]),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      const layout = 'layout' in body ? body.layout : null
      const itemIds = 'layout' in body ? body.layout.flatMap((g) => g.itemIds) : body.itemIds
      const conflict = () => {
        throw new HTTPException(409, { message: 'O repertório mudou enquanto você reordenava. Atualize e tente de novo.' })
      }
      await db.transaction(async (tx) => {
        const current = await tx.select({ id: setlistItem.id }).from(setlistItem).where(eq(setlistItem.setlistId, id))
        const same =
          current.length === itemIds.length && new Set(itemIds).size === itemIds.length && current.every((r) => itemIds.includes(r.id))
        if (!same) conflict()
        if (layout) {
          const blocks = await tx.select({ id: setlistBlock.id }).from(setlistBlock).where(eq(setlistBlock.setlistId, id))
          const listed = layout.flatMap((g) => (g.blockId ? [g.blockId] : []))
          if (listed.length !== blocks.length || new Set(listed).size !== listed.length || !blocks.every((b) => listed.includes(b.id)))
            conflict()
          for (const [position, blockId] of listed.entries()) {
            await tx.update(setlistBlock).set({ position }).where(eq(setlistBlock.id, blockId))
          }
          let position = 0
          // Sem bloco primeiro, como na tela.
          for (const g of [...layout.filter((g) => !g.blockId), ...layout.filter((g) => g.blockId)]) {
            for (const itemId of g.itemIds) {
              await tx.update(setlistItem).set({ position: position++, blockId: g.blockId }).where(eq(setlistItem.id, itemId))
            }
          }
        } else {
          for (const [position, itemId] of itemIds.entries()) {
            await tx.update(setlistItem).set({ position }).where(eq(setlistItem.id, itemId))
          }
          await renumber(tx, id)
        }
        await touch(tx, id, uid, 'reorder')
      })
      return c.json({ ok: true })
    },
  )

  // ---------------------------------------------------------------- blocos

  .post('/:id/blocks', validate('param', idParam), validate('json', blockInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    await requireRole(id, uid, 'admin')
    const block = await db.transaction(async (tx) => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(setlistBlock)
        .where(eq(setlistBlock.setlistId, id))
      if (count >= 60) throw new HTTPException(400, { message: 'Limite de 60 blocos por repertório.' })
      const [row] = await tx
        .insert(setlistBlock)
        .values({ ...input, setlistId: id, position: count })
        .returning({ id: setlistBlock.id })
      await touch(tx, id, uid, 'add_block', { name: input.name })
      return row
    })
    return c.json(block, 201)
  })

  .put(
    '/:id/blocks/:blockId',
    validate('param', idParam.extend({ blockId: z.string().uuid() })),
    validate('json', blockInput),
    async (c) => {
      const uid = c.var.user.id
      const { id, blockId } = c.req.valid('param')
      const input = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      await db.transaction(async (tx) => {
        await requireBlock(tx, id, blockId)
        await tx
          .update(setlistBlock)
          .set({ name: input.name, style: input.style ?? null, bpm: input.bpm ?? null, notes: input.notes ?? null })
          .where(eq(setlistBlock.id, blockId))
        await touch(tx, id, uid, 'update_block', { name: input.name })
      })
      return c.json({ id: blockId })
    },
  )

  // Apagar o bloco não tira as músicas do repertório: elas ficam "sem bloco".
  .delete('/:id/blocks/:blockId', validate('param', idParam.extend({ blockId: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id, blockId } = c.req.valid('param')
    await requireRole(id, uid, 'admin')
    await db.transaction(async (tx) => {
      const b = await requireBlock(tx, id, blockId)
      await tx.delete(setlistBlock).where(eq(setlistBlock.id, blockId))
      await renumber(tx, id)
      await touch(tx, id, uid, 'remove_block', { name: b.name })
    })
    return c.body(null, 204)
  })

  // Colar o repertório em texto ("BLOCO 2 (Marília - 130)" / "Fada - A"): cria os blocos e
  // procura cada música na biblioteca. A que não existe vira uma música só com nome e tom.
  .post(
    '/:id/import-text',
    validate('param', idParam),
    validate('json', z.object({ text: z.string().max(20_000) })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { text } = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      const parsed = parseSetlistText(text)
      const total = parsed.loose.length + parsed.blocks.reduce((n, b) => n + b.songs.length, 0)
      if (total === 0 && parsed.blocks.length === 0)
        throw new HTTPException(400, { message: 'Não encontramos músicas no texto. Use uma música por linha, como "Fada - A".' })

      const result = await db.transaction(async (tx) => {
        const [counts] = await tx
          .select({
            items: sql<number>`(select count(*)::int from ${setlistItem} where setlist_id = ${id})`,
            blocks: sql<number>`(select count(*)::int from ${setlistBlock} where setlist_id = ${id})`,
          })
          .from(setlist)
          .where(eq(setlist.id, id))
        if (counts.items + total > 300) throw new HTTPException(400, { message: 'Limite de 300 músicas por repertório.' })
        if (counts.blocks + parsed.blocks.length > 60) throw new HTTPException(400, { message: 'Limite de 60 blocos por repertório.' })

        let found = 0
        const created: string[] = []
        const cache = new Map<string, { id: string; originalKey: string | null }>()
        // Procura pelo título (sem acento nem maiúscula). Prefere as músicas da própria pessoa.
        const resolve = async (title: string, key: string | null) => {
          const norm = normalizeSearch(title)
          const hit = cache.get(norm)
          if (hit) return hit
          const candidates = await tx
            .select({ id: song.id, title: song.title, originalKey: song.originalKey, ownerId: song.ownerId })
            .from(song)
            .where(and(canViewSong(uid), ilike(song.searchText, `%${norm.replace(/[%_\\]/g, '\\$&')}%`)))
            .limit(30)
          const match = candidates
            .filter((s) => normalizeSearch(s.title) === norm)
            .sort((a, b) => Number(b.ownerId === uid) - Number(a.ownerId === uid))[0]
          if (match) {
            found++
            cache.set(norm, match)
            return match
          }
          const [row] = await tx
            .insert(song)
            .values({
              ownerId: uid,
              title: title.slice(0, 200),
              originalKey: key,
              content: '',
              visibility: 'private',
              lyricsAuthorized: true,
              tags: ['sem cifra'],
              searchText: normalizeSearch([title, key, 'sem cifra'].filter(Boolean).join(' ')),
            })
            .returning({ id: song.id, originalKey: song.originalKey })
          created.push(title)
          cache.set(norm, row)
          return row
        }

        let position = 100_000 // entra no fim; o renumber acerta as posições
        const add = async (t: { title: string; key: string | null }, blockId: string | null) => {
          const s = await resolve(t.title, t.key)
          await tx.insert(setlistItem).values({
            setlistId: id,
            songId: s.id,
            blockId,
            position: position++,
            // O tom da lista vale para este repertório (quando é diferente do original da música).
            key: t.key && t.key !== s.originalKey ? t.key : null,
          })
        }
        for (const t of parsed.loose) await add(t, null)
        for (const [i, b] of parsed.blocks.entries()) {
          const [nb] = await tx
            .insert(setlistBlock)
            .values({ setlistId: id, position: counts.blocks + i, name: b.name.slice(0, 80), style: b.style?.slice(0, 80) ?? null, bpm: b.bpm })
            .returning({ id: setlistBlock.id })
          for (const t of b.songs) await add(t, nb.id)
        }
        await renumber(tx, id)
        await touch(tx, id, uid, 'import_text', { songs: total, blocks: parsed.blocks.length, created: created.length })
        return { songs: total, blocks: parsed.blocks.length, found, created }
      })
      return c.json(result, 201)
    },
  )

  // ---------------------------------------------------------------- músicos

  .put(
    '/:id/members/:userId',
    validate('param', idParam.extend({ userId: z.string().min(1) })),
    validate(
      'json',
      z.object({
        permission: z.enum(schema.permission.enumValues).optional(),
        instrument: z.enum(schema.instrument.enumValues).nullish(),
      }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id, userId } = c.req.valid('param')
      const { permission, instrument } = c.req.valid('json')
      const { role, ownerId } = await requireRole(id, uid, 'view')
      if (userId === ownerId) forbidden('A permissão de quem criou o repertório não muda.')
      const [target] = await db
        .select({ permission: setlistMember.permission })
        .from(setlistMember)
        .where(and(eq(setlistMember.setlistId, id), eq(setlistMember.userId, userId)))
      if (!target) notFound('Músico')

      const patch: Partial<typeof setlistMember.$inferInsert> = {}
      if (permission && permission !== target.permission) {
        if (!atLeast(role, 'admin')) forbidden('Só quem administra pode mudar permissões.')
        // Dar ou tirar "administrar" é decisão só do dono.
        if ((permission === 'admin' || target.permission === 'admin') && role !== 'owner') {
          forbidden('Só o dono do repertório pode dar ou tirar a permissão de administrar.')
        }
        patch.permission = permission
      }
      if (instrument !== undefined) {
        // Cada um escolhe o próprio instrumento; quem administra pode ajustar o de todos.
        if (userId !== uid && !atLeast(role, 'admin')) forbidden()
        patch.instrument = instrument
      }
      if (Object.keys(patch).length) {
        await db.transaction(async (tx) => {
          await tx.update(setlistMember).set(patch).where(and(eq(setlistMember.setlistId, id), eq(setlistMember.userId, userId)))
          await touch(tx, id, uid, 'update_member', { userId, ...patch })
        })
      }
      return c.json({ ok: true })
    },
  )

  .delete('/:id/members/:userId', validate('param', idParam.extend({ userId: z.string().min(1) })), async (c) => {
    const uid = c.var.user.id
    const { id, userId } = c.req.valid('param')
    const { role, ownerId } = await requireRole(id, uid, 'view')
    if (userId === ownerId) forbidden('Quem criou o repertório não pode sair dele. Exclua ou passe para outra pessoa.')
    const [target] = await db
      .select({ permission: setlistMember.permission })
      .from(setlistMember)
      .where(and(eq(setlistMember.setlistId, id), eq(setlistMember.userId, userId)))
    if (!target) notFound('Músico')
    const leaving = userId === uid
    if (!leaving) {
      if (!atLeast(role, 'admin')) forbidden('Só quem administra pode remover músicos.')
      if (target.permission === 'admin' && role !== 'owner') forbidden('Só o dono pode remover quem administra.')
    }
    await db.transaction(async (tx) => {
      await tx.delete(setlistMember).where(and(eq(setlistMember.setlistId, id), eq(setlistMember.userId, userId)))
      await touch(tx, id, uid, leaving ? 'leave' : 'remove_member', { userId })
    })
    // Quem saiu ou foi removido para de receber os avisos ao vivo na hora.
    kick(id, userId)
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------- convites

  .post(
    '/:id/invites',
    validate('param', idParam),
    validate(
      'json',
      z.object({
        permission: z.enum(schema.permission.enumValues).default('view'),
        email: z.string().trim().email('E-mail inválido').max(200).nullish(),
        maxUses: z.number().int().min(1).max(200).nullish(),
        expiresInDays: z.number().int().min(1).max(90).default(14),
      }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      const { role } = await requireRole(id, uid, 'admin')
      if (input.permission === 'admin' && role !== 'owner') forbidden('Só o dono pode convidar alguém para administrar.')

      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      let created: { id: string; code: string } | undefined
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const rows = await db
          .insert(invite)
          .values({
            setlistId: id,
            code: newInviteCode(),
            email: input.email ?? null,
            permission: input.permission,
            maxUses: input.email ? 1 : (input.maxUses ?? null),
            expiresAt,
            createdBy: uid,
          })
          .onConflictDoNothing()
          .returning({ id: invite.id, code: invite.code })
        created = rows[0]
      }
      if (!created) throw new HTTPException(500, { message: 'Não foi possível gerar o convite. Tente de novo.' })

      if (input.email) {
        const [s] = await db.select({ name: setlist.name }).from(setlist).where(eq(setlist.id, id))
        sendSetlistInviteEmail(input.email, c.var.user.name, s.name, inviteUrl(created.code)).catch((e) =>
          console.error('Falha ao enviar convite', e),
        )
      }
      return c.json({ ...created, url: inviteUrl(created.code), expiresAt }, 201)
    },
  )

  .delete('/:id/invites/:inviteId', validate('param', idParam.extend({ inviteId: z.string().uuid() })), async (c) => {
    const { id, inviteId } = c.req.valid('param')
    await requireRole(id, c.var.user.id, 'admin')
    await db
      .update(invite)
      .set({ revokedAt: new Date() })
      .where(and(eq(invite.id, inviteId), eq(invite.setlistId, id)))
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------- sugestões

  .post(
    '/:id/suggestions',
    validate('param', idParam),
    validate(
      'json',
      z
        .object({
          itemId: z.string().uuid().nullish(),
          proposedKey: keySchema,
          message: z.string().trim().max(1000).nullish(),
        })
        .refine((s) => s.proposedKey || s.message, { message: 'Escreva a sugestão ou escolha um tom.' }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      await requireRole(id, uid, 'suggest')
      if (input.itemId) {
        const [it] = await db
          .select({ id: setlistItem.id })
          .from(setlistItem)
          .where(and(eq(setlistItem.id, input.itemId), eq(setlistItem.setlistId, id)))
        if (!it) notFound('Música do repertório')
      }
      const [row] = await db
        .insert(setlistSuggestion)
        .values({ setlistId: id, authorId: uid, itemId: input.itemId ?? null, proposedKey: input.proposedKey ?? null, message: input.message ?? null })
        .returning({ id: setlistSuggestion.id })
      return c.json(row, 201)
    },
  )

  .put(
    '/:id/suggestions/:sid',
    validate('param', idParam.extend({ sid: z.string().uuid() })),
    validate('json', z.object({ status: z.enum(['accepted', 'rejected']) })),
    async (c) => {
      const uid = c.var.user.id
      const { id, sid } = c.req.valid('param')
      const { status } = c.req.valid('json')
      await requireRole(id, uid, 'admin')
      await db.transaction(async (tx) => {
        const [sg] = await tx
          .select()
          .from(setlistSuggestion)
          .where(and(eq(setlistSuggestion.id, sid), eq(setlistSuggestion.setlistId, id)))
        if (!sg) notFound('Sugestão')
        if (sg.status !== 'open') throw new HTTPException(409, { message: 'Esta sugestão já foi respondida.' })
        await tx
          .update(setlistSuggestion)
          .set({ status, resolvedBy: uid, resolvedAt: new Date() })
          .where(eq(setlistSuggestion.id, sid))
        // Aceitar uma troca de tom já aplica o tom na música do repertório.
        if (status === 'accepted' && sg.itemId && sg.proposedKey) {
          await tx.update(setlistItem).set({ key: sg.proposedKey }).where(eq(setlistItem.id, sg.itemId))
        }
        await touch(tx, id, uid, status === 'accepted' ? 'accept_suggestion' : 'reject_suggestion', { suggestionId: sid })
      })
      return c.json({ status })
    },
  )

  // ---------------------------------------------------------------- histórico

  .get('/:id/history', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await requireRole(id, c.var.user.id, 'view')
    const rows = await db
      .select({ id: changeLog.id, action: changeLog.action, diff: changeLog.diff, createdAt: changeLog.createdAt, userName: user.name })
      .from(changeLog)
      .leftJoin(user, eq(user.id, changeLog.userId))
      .where(and(eq(changeLog.entityType, 'setlist'), eq(changeLog.entityId, id)))
      .orderBy(desc(changeLog.createdAt))
      .limit(50)
    return c.json(rows)
  })

// ---------------------------------------------------------------------------
// Convites: prévia e aceite (a pessoa ainda não participa do repertório)

async function loadValidInvite(code: string) {
  const [row] = await db
    .select({ invite, setlistName: setlist.name, eventDate: setlist.eventDate, location: setlist.location, groupName: setlist.groupName, ownerId: setlist.ownerId, ownerName: user.name })
    .from(invite)
    .innerJoin(setlist, eq(setlist.id, invite.setlistId))
    .innerJoin(user, eq(user.id, setlist.ownerId))
    .where(eq(invite.code, code.toUpperCase()))
  const i = row?.invite
  const invalid =
    !i || i.revokedAt || (i.expiresAt && i.expiresAt < new Date()) || (i.maxUses != null && i.uses >= i.maxUses)
  if (invalid) throw new HTTPException(404, { message: 'Convite inválido, expirado ou já usado. Peça um novo a quem te convidou.' })
  return row
}

const codeParam = z.object({ code: z.string().trim().min(6).max(12) })

export const invitesRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/:code', validate('param', codeParam), async (c) => {
    const uid = c.var.user.id
    const row = await loadValidInvite(c.req.valid('param').code)
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(setlistItem)
      .where(eq(setlistItem.setlistId, row.invite.setlistId))
    const access = await getRole(row.invite.setlistId, uid)
    return c.json({
      setlistId: row.invite.setlistId,
      name: row.setlistName,
      eventDate: row.eventDate,
      location: row.location,
      groupName: row.groupName,
      ownerName: row.ownerName,
      permission: row.invite.permission,
      songCount: n,
      alreadyMember: Boolean(access),
    })
  })

  .post('/:code/accept', validate('param', codeParam), async (c) => {
    const uid = c.var.user.id
    const row = await loadValidInvite(c.req.valid('param').code)
    const setlistId = row.invite.setlistId
    const access = await getRole(setlistId, uid)
    if (access) return c.json({ setlistId, alreadyMember: true })

    await db.transaction(async (tx) => {
      // Soma o uso de forma atômica: dois cliques ao mesmo tempo não passam do limite.
      const used = await tx
        .update(invite)
        .set({ uses: sql`${invite.uses} + 1` })
        .where(and(eq(invite.id, row.invite.id), or(isNull(invite.maxUses), sql`${invite.uses} < ${invite.maxUses}`)))
        .returning({ id: invite.id })
      if (!used.length) throw new HTTPException(404, { message: 'Este convite já atingiu o limite de usos.' })
      await tx.insert(setlistMember).values({ setlistId, userId: uid, permission: row.invite.permission }).onConflictDoNothing()
      await touch(tx, setlistId, uid, 'join', { permission: row.invite.permission })
    })
    await announce(setlistId).catch(() => {})
    return c.json({ setlistId, alreadyMember: false }, 201)
  })
