// Ensaios no estúdio: data, estúdio, sala, custo e a parte de cada músico (quem já acertou).
import { atLeast } from '@ensaio/shared'
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getRole } from '../access'
import { db, schema } from '../db'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'

const { rehearsal, rehearsalShare, setlist, setlistMember, user } = schema

const idParam = z.object({ id: z.string().uuid() })
const text = (max: number) => z.string().trim().max(max).nullish()

const rehearsalInput = z.object({
  startsAt: z.coerce.date(),
  durationMin: z.number().int().min(15).max(24 * 60).default(120),
  studioName: text(120),
  room: text(60),
  address: text(200),
  phone: text(40),
  costCents: z.number().int().min(0).max(10_000_000).nullish(),
  paidBy: z.string().min(1).nullish(),
  notes: text(1000),
  /** Quem divide o custo (padrão: todo mundo do repertório). */
  participants: z.array(z.string().min(1)).max(100).optional(),
})

/** Divide o valor em partes iguais; os centavos que sobram vão para os primeiros. */
export function splitCents(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0))
}

/** O dono e os músicos do repertório (quem pode dividir o ensaio). */
async function bandOf(setlistId: string): Promise<string[]> {
  const rows = await db
    .select({ ownerId: setlist.ownerId, memberId: setlistMember.userId })
    .from(setlist)
    .leftJoin(setlistMember, eq(setlistMember.setlistId, setlist.id))
    .where(eq(setlist.id, setlistId))
  return [...new Set(rows.flatMap((r) => [r.ownerId, r.memberId]).filter((x): x is string => Boolean(x)))]
}

async function requireAccess(setlistId: string, userId: string, admin = false) {
  const access = await getRole(setlistId, userId)
  if (!access) notFound('Repertório')
  if (admin && !atLeast(access.role, 'admin')) forbidden('Só quem administra o repertório marca ensaios.')
  return access
}

async function loadRehearsal(id: string) {
  const [r] = await db.select().from(rehearsal).where(eq(rehearsal.id, id))
  if (!r) notFound('Ensaio')
  return r
}

/** Grava as partes: valor dividido entre os participantes, mantendo quem já tinha acertado. */
async function writeShares(rehearsalId: string, costCents: number | null | undefined, participants: string[]) {
  const before = await db.select().from(rehearsalShare).where(eq(rehearsalShare.rehearsalId, rehearsalId))
  const paid = new Map(before.map((s) => [s.userId, s.paidAt]))
  await db.delete(rehearsalShare).where(eq(rehearsalShare.rehearsalId, rehearsalId))
  if (!costCents || !participants.length) return
  const parts = splitCents(costCents, participants.length)
  await db.insert(rehearsalShare).values(
    participants.map((userId, i) => ({ rehearsalId, userId, amountCents: parts[i], paidAt: paid.get(userId) ?? null })),
  )
}

/** Participantes válidos: só gente do repertório; quem pagou o estúdio já está quite. */
async function resolveParticipants(setlistId: string, wanted: string[] | undefined, paidBy: string | null | undefined) {
  const band = await bandOf(setlistId)
  const list = wanted ? wanted.filter((u) => band.includes(u)) : band
  if (paidBy && !band.includes(paidBy)) forbidden('Quem pagou o estúdio precisa ser da banda.')
  return list
}

export const rehearsalsRoutes = new Hono<AppEnv>()
  .use(requireUser)

  // Ensaios do repertório: os próximos e os dos últimos 60 dias.
  .get('/setlist/:id', validate('param', idParam), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { role } = await requireAccess(id, uid)
    const since = new Date(Date.now() - 60 * 86400_000)
    const list = await db
      .select({ r: rehearsal, paidByName: user.name })
      .from(rehearsal)
      .leftJoin(user, eq(user.id, rehearsal.paidBy))
      .where(and(eq(rehearsal.setlistId, id), gte(rehearsal.startsAt, since)))
      .orderBy(desc(rehearsal.startsAt))
    const shares = list.length
      ? await db
          .select({
            rehearsalId: rehearsalShare.rehearsalId,
            userId: rehearsalShare.userId,
            name: user.name,
            image: user.image,
            amountCents: rehearsalShare.amountCents,
            paidAt: rehearsalShare.paidAt,
          })
          .from(rehearsalShare)
          .innerJoin(user, eq(user.id, rehearsalShare.userId))
          .where(
            inArray(
              rehearsalShare.rehearsalId,
              list.map((x) => x.r.id),
            ),
          )
          .orderBy(asc(user.name))
      : []
    return c.json({
      canEdit: atLeast(role, 'admin'),
      rehearsals: list.map(({ r, paidByName }) => ({
        ...r,
        paidByName,
        shares: shares.filter((s) => s.rehearsalId === r.id).map(({ rehearsalId: _r, ...s }) => s),
      })),
    })
  })

  .post('/setlist/:id', validate('param', idParam), validate('json', rehearsalInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { participants, ...input } = c.req.valid('json')
    await requireAccess(id, uid, true)
    const people = await resolveParticipants(id, participants, input.paidBy)
    const [r] = await db
      .insert(rehearsal)
      .values({ ...input, paidBy: input.paidBy ?? null, setlistId: id, createdBy: uid })
      .returning({ id: rehearsal.id })
    await writeShares(r.id, input.costCents, people)
    // Quem pagou o estúdio não deve a si mesmo.
    if (input.paidBy) await db.update(rehearsalShare).set({ paidAt: new Date() }).where(and(eq(rehearsalShare.rehearsalId, r.id), eq(rehearsalShare.userId, input.paidBy)))
    return c.json(r, 201)
  })

  .put('/:id', validate('param', idParam), validate('json', rehearsalInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { participants, ...input } = c.req.valid('json')
    const r = await loadRehearsal(id)
    await requireAccess(r.setlistId, uid, true)
    const current = await db.select({ userId: rehearsalShare.userId }).from(rehearsalShare).where(eq(rehearsalShare.rehearsalId, id))
    const people = await resolveParticipants(
      r.setlistId,
      participants ?? (current.length ? current.map((s) => s.userId) : undefined),
      input.paidBy,
    )
    await db.update(rehearsal).set({ ...input, paidBy: input.paidBy ?? null }).where(eq(rehearsal.id, id))
    await writeShares(id, input.costCents, people)
    if (input.paidBy) await db.update(rehearsalShare).set({ paidAt: new Date() }).where(and(eq(rehearsalShare.rehearsalId, id), eq(rehearsalShare.userId, input.paidBy), isNull(rehearsalShare.paidAt)))
    return c.json({ ok: true })
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const r = await loadRehearsal(id)
    await requireAccess(r.setlistId, c.var.user.id, true)
    await db.delete(rehearsal).where(eq(rehearsal.id, id))
    return c.body(null, 204)
  })

  // Marcar a parte como acertada: a própria pessoa ou quem administra.
  .patch(
    '/:id/partes/:userId',
    validate('param', idParam.extend({ userId: z.string().min(1) })),
    validate('json', z.object({ paid: z.boolean() })),
    async (c) => {
      const uid = c.var.user.id
      const { id, userId } = c.req.valid('param')
      const { paid } = c.req.valid('json')
      const r = await loadRehearsal(id)
      const { role } = await requireAccess(r.setlistId, uid)
      if (userId !== uid && !atLeast(role, 'admin') && r.paidBy !== uid) forbidden('Só a própria pessoa ou quem administra marca isso.')
      const [row] = await db
        .update(rehearsalShare)
        .set({ paidAt: paid ? new Date() : null })
        .where(and(eq(rehearsalShare.rehearsalId, id), eq(rehearsalShare.userId, userId)))
        .returning({ userId: rehearsalShare.userId })
      if (!row) notFound('Parte')
      return c.json({ ok: true })
    },
  )

  // Meus ensaios: os próximos e os que ainda devo.
  .get('/meus', async (c) => {
    const uid = c.var.user.id
    const now = new Date(Date.now() - 3 * 3600_000)
    const rows = await db
      .select({
        id: rehearsal.id,
        setlistId: rehearsal.setlistId,
        setlistName: setlist.name,
        startsAt: rehearsal.startsAt,
        durationMin: rehearsal.durationMin,
        studioName: rehearsal.studioName,
        room: rehearsal.room,
        address: rehearsal.address,
        amountCents: rehearsalShare.amountCents,
        paidAt: rehearsalShare.paidAt,
        paidByName: user.name,
      })
      .from(rehearsal)
      .innerJoin(setlist, eq(setlist.id, rehearsal.setlistId))
      .leftJoin(rehearsalShare, and(eq(rehearsalShare.rehearsalId, rehearsal.id), eq(rehearsalShare.userId, uid)))
      .leftJoin(user, eq(user.id, rehearsal.paidBy))
      .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, uid)))
      .where(
        and(
          or(eq(setlist.ownerId, uid), eq(setlistMember.userId, uid)),
          or(gte(rehearsal.startsAt, now), and(sql`${rehearsalShare.amountCents} > 0`, isNull(rehearsalShare.paidAt))),
        ),
      )
      .orderBy(asc(rehearsal.startsAt))
    return c.json(rows)
  })

  // Estúdios já usados pelas minhas bandas, para preencher rápido.
  .get('/estudios', async (c) => {
    const uid = c.var.user.id
    const rows = await db
      .selectDistinctOn([rehearsal.studioName], {
        studioName: rehearsal.studioName,
        room: rehearsal.room,
        address: rehearsal.address,
        phone: rehearsal.phone,
        costCents: rehearsal.costCents,
        durationMin: rehearsal.durationMin,
      })
      .from(rehearsal)
      .innerJoin(setlist, eq(setlist.id, rehearsal.setlistId))
      .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, uid)))
      .where(and(or(eq(setlist.ownerId, uid), eq(setlistMember.userId, uid)), sql`${rehearsal.studioName} is not null`))
      .orderBy(rehearsal.studioName, desc(rehearsal.startsAt))
      .limit(30)
    return c.json(rows)
  })
