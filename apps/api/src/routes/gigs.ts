// Agenda do músico: shows, apresentações e o cachê de cada um. Tudo só da própria pessoa.
import { and, asc, eq, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db, schema } from '../db'
import { notFound, requireUser, validate, type AppEnv } from '../http'

const { gig, setlist, setlistMember } = schema

const gigInput = z.object({
  title: z.string().trim().min(1, 'Dê um nome ao show.').max(120),
  startsAt: z.coerce.date(),
  location: z.string().trim().max(200).nullish(),
  contractor: z.string().trim().max(120).nullish(),
  contact: z.string().trim().max(40).nullish(),
  feeCents: z.number().int().min(0).max(100_000_000).nullish(),
  paidAt: z.coerce.date().nullish(),
  status: z.enum(['confirmed', 'tentative', 'canceled']).default('confirmed'),
  notes: z.string().trim().max(2000).nullish(),
  setlistId: z.string().uuid().nullish(),
})
const idParam = z.object({ id: z.string().uuid() })

/** O repertório ligado precisa ser da pessoa ou de uma banda em que ela toca. */
async function assertSetlistAccess(userId: string, setlistId: string | null | undefined) {
  if (!setlistId) return
  const [s] = await db
    .selectDistinct({ id: setlist.id })
    .from(setlist)
    .leftJoin(setlistMember, eq(setlistMember.setlistId, setlist.id))
    .where(and(eq(setlist.id, setlistId), or(eq(setlist.ownerId, userId), eq(setlistMember.userId, userId))))
  if (!s) throw new HTTPException(400, { message: 'Repertório não encontrado.' })
}

const columns = {
  id: gig.id,
  title: gig.title,
  startsAt: gig.startsAt,
  location: gig.location,
  contractor: gig.contractor,
  contact: gig.contact,
  feeCents: gig.feeCents,
  paidAt: gig.paidAt,
  status: gig.status,
  notes: gig.notes,
  setlistId: gig.setlistId,
  setlistName: setlist.name,
}

export const gigsRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const rows = await db
      .select(columns)
      .from(gig)
      .leftJoin(setlist, eq(setlist.id, gig.setlistId))
      .where(eq(gig.userId, c.var.user.id))
      .orderBy(asc(gig.startsAt))
      .limit(2000)
    return c.json({ gigs: rows })
  })

  .post('/', validate('json', gigInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    await assertSetlistAccess(uid, input.setlistId)
    const [row] = await db
      .insert(gig)
      .values({ ...input, userId: uid })
      .returning({ id: gig.id })
    return c.json({ id: row.id }, 201)
  })

  .put('/:id', validate('param', idParam), validate('json', gigInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    await assertSetlistAccess(uid, input.setlistId)
    const [row] = await db
      .update(gig)
      .set({
        ...input,
        location: input.location ?? null,
        contractor: input.contractor ?? null,
        contact: input.contact ?? null,
        feeCents: input.feeCents ?? null,
        paidAt: input.paidAt ?? null,
        notes: input.notes ?? null,
        setlistId: input.setlistId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(gig.id, c.req.valid('param').id), eq(gig.userId, uid)))
      .returning({ id: gig.id })
    if (!row) notFound('Show')
    return c.json({ id: row.id })
  })

  // Marcar o cachê como recebido (ou voltar para "a receber").
  .patch('/:id/paid', validate('param', idParam), validate('json', z.object({ paid: z.boolean() })), async (c) => {
    const [row] = await db
      .update(gig)
      .set({ paidAt: c.req.valid('json').paid ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(gig.id, c.req.valid('param').id), eq(gig.userId, c.var.user.id)))
      .returning({ id: gig.id, paidAt: gig.paidAt })
    if (!row) notFound('Show')
    return c.json(row)
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(gig)
      .where(and(eq(gig.id, c.req.valid('param').id), eq(gig.userId, c.var.user.id)))
      .returning({ id: gig.id })
    if (!row) notFound('Show')
    return c.body(null, 204)
  })
