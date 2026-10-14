// Financeiro do show: receitas, despesas e o cachê de cada músico, por repertório; e o resumo
// do mês de quem administra.
import { atLeast } from '@ensaio/shared'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getRole } from '../access'
import { db, schema } from '../db'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'

const { setlist, setlistEntry, setlistMember, user } = schema

const idParam = z.object({ id: z.string().uuid() })
const entryInput = z.object({
  kind: z.enum(schema.entryKind.enumValues),
  description: z.string().trim().min(1, 'Descreva o lançamento.').max(120),
  amountCents: z.number().int().min(0).max(100_000_000),
  userId: z.string().min(1).nullish(),
  settled: z.boolean().default(false),
})

async function requireAccess(setlistId: string, userId: string) {
  const access = await getRole(setlistId, userId)
  if (!access) notFound('Repertório')
  return { ...access, isAdmin: atLeast(access.role, 'admin') }
}

/** Cachê só para quem é da banda (o dono ou um músico do repertório). */
async function assertBand(setlistId: string, ownerId: string, userId: string | null | undefined) {
  if (!userId || userId === ownerId) return
  const [m] = await db
    .select({ one: sql`1` })
    .from(setlistMember)
    .where(and(eq(setlistMember.setlistId, setlistId), eq(setlistMember.userId, userId)))
  if (!m) forbidden('O cachê é para alguém da banda.')
}

async function loadEntry(id: string) {
  const [e] = await db.select().from(setlistEntry).where(eq(setlistEntry.id, id))
  if (!e) notFound('Lançamento')
  return e
}

export const financeRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/setlist/:id', validate('param', idParam), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { isAdmin } = await requireAccess(id, uid)
    // Quem não administra vê só o próprio cachê.
    const entries = await db
      .select({
        id: setlistEntry.id,
        kind: setlistEntry.kind,
        description: setlistEntry.description,
        amountCents: setlistEntry.amountCents,
        userId: setlistEntry.userId,
        userName: user.name,
        settledAt: setlistEntry.settledAt,
      })
      .from(setlistEntry)
      .leftJoin(user, eq(user.id, setlistEntry.userId))
      .where(and(eq(setlistEntry.setlistId, id), isAdmin ? undefined : eq(setlistEntry.userId, uid)))
      .orderBy(asc(setlistEntry.kind), asc(setlistEntry.createdAt))
    return c.json({ canEdit: isAdmin, entries })
  })

  // Um ou vários lançamentos de uma vez (ex.: o cachê de cada músico escalado).
  .post(
    '/setlist/:id',
    validate('param', idParam),
    validate('json', z.object({ entries: z.array(entryInput).min(1).max(50) })),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { entries } = c.req.valid('json')
      const { isAdmin, ownerId } = await requireAccess(id, uid)
      if (!isAdmin) forbidden('Só quem administra o repertório cuida do financeiro.')
      for (const e of entries) await assertBand(id, ownerId, e.kind === 'cache' ? e.userId : null)
      await db.insert(setlistEntry).values(
        entries.map(({ settled, ...e }) => ({
          ...e,
          userId: e.kind === 'cache' ? (e.userId ?? null) : null,
          setlistId: id,
          settledAt: settled ? new Date() : null,
        })),
      )
      return c.json({ ok: true }, 201)
    },
  )

  .put('/:id', validate('param', idParam), validate('json', entryInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { settled, ...input } = c.req.valid('json')
    const e = await loadEntry(id)
    const { isAdmin, ownerId } = await requireAccess(e.setlistId, uid)
    if (!isAdmin) forbidden('Só quem administra o repertório cuida do financeiro.')
    await assertBand(e.setlistId, ownerId, input.kind === 'cache' ? input.userId : null)
    await db
      .update(setlistEntry)
      .set({
        ...input,
        userId: input.kind === 'cache' ? (input.userId ?? null) : null,
        settledAt: settled ? (e.settledAt ?? new Date()) : null,
      })
      .where(eq(setlistEntry.id, id))
    return c.json({ ok: true })
  })

  // Marcar recebido/pago. O músico pode confirmar que recebeu o próprio cachê.
  .patch('/:id/acerto', validate('param', idParam), validate('json', z.object({ settled: z.boolean() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { settled } = c.req.valid('json')
    const e = await loadEntry(id)
    const { isAdmin } = await requireAccess(e.setlistId, uid)
    if (!isAdmin && e.userId !== uid) notFound('Lançamento')
    await db
      .update(setlistEntry)
      .set({ settledAt: settled ? new Date() : null })
      .where(eq(setlistEntry.id, id))
    return c.json({ ok: true })
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const e = await loadEntry(id)
    const { isAdmin } = await requireAccess(e.setlistId, uid)
    if (!isAdmin) forbidden('Só quem administra o repertório cuida do financeiro.')
    await db.delete(setlistEntry).where(eq(setlistEntry.id, id))
    return c.body(null, 204)
  })

  // Resumo do mês: os shows (com data no mês) dos repertórios que a pessoa administra.
  .get(
    '/resumo',
    validate('query', z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) })),
    async (c) => {
      const uid = c.var.user.id
      const { mes } = c.req.valid('query')
      const [y, m] = mes.split('-').map(Number)
      // Mês no fuso de Brasília (UTC-3).
      const from = new Date(Date.UTC(y, m - 1, 1, 3))
      const to = new Date(Date.UTC(y, m, 1, 3))
      const shows = await db
        .selectDistinct({ id: setlist.id, name: setlist.name, eventDate: setlist.eventDate })
        .from(setlist)
        .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, uid)))
        .where(
          and(
            gte(setlist.eventDate, from),
            lt(setlist.eventDate, to),
            sql`(${setlist.ownerId} = ${uid} or ${setlistMember.permission} = 'admin')`,
          ),
        )
        .orderBy(asc(setlist.eventDate))
      const entries = shows.length
        ? await db
            .select({
              setlistId: setlistEntry.setlistId,
              kind: setlistEntry.kind,
              amountCents: setlistEntry.amountCents,
              settledAt: setlistEntry.settledAt,
            })
            .from(setlistEntry)
            .where(
              inArray(
                setlistEntry.setlistId,
                shows.map((s) => s.id),
              ),
            )
        : []
      const rows = shows
        .map((s) => {
          const mine = entries.filter((e) => e.setlistId === s.id)
          const sum = (k: string, open = false) =>
            mine.filter((e) => e.kind === k && (!open || !e.settledAt)).reduce((n, e) => n + e.amountCents, 0)
          return {
            ...s,
            receita: sum('receita'),
            despesa: sum('despesa'),
            cache: sum('cache'),
            aReceber: sum('receita', true),
            aPagar: sum('despesa', true) + sum('cache', true),
          }
        })
        .filter((r) => r.receita || r.despesa || r.cache)
      return c.json(rows)
    },
  )
