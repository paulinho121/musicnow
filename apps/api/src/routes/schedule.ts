// Escala de músicos: quem toca em cada repertório (culto, show), a resposta de cada um e as
// datas em que cada músico não pode tocar.
import { atLeast } from '@ensaio/shared'
import { and, asc, eq, gte, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getRole } from '../access'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'
import { sendAssignmentEmail } from '../mail'

const { setlist, setlistMember, setlistAssignment, unavailability, user, userInstrument } = schema

const idParam = z.object({ id: z.string().uuid() })
const memberParam = idParam.extend({ userId: z.string().min(1) })

/** A data do evento cai num período em que a pessoa avisou que não pode (no fuso de Brasília). */
const unavailableOn = (userId: typeof user.id, eventDate: typeof setlist.eventDate) => sql<string | null>`(
  select coalesce(nullif(u.note, ''), 'Indisponível') from ${unavailability} u
  where u.user_id = ${userId}
    and (${eventDate} at time zone 'America/Sao_Paulo')::date between u.starts_on and u.ends_on
  limit 1)`

const primaryInstrument = (userId: typeof user.id) =>
  sql<string | null>`(select ui.instrument::text from ${userInstrument} ui where ui.user_id = ${userId} and ui."primary" limit 1)`

async function requireAccess(setlistId: string, userId: string, admin = false) {
  const access = await getRole(setlistId, userId)
  if (!access) notFound('Repertório')
  if (admin && !atLeast(access.role, 'admin')) forbidden('Só quem administra o repertório monta a escala.')
  return access
}

export const scheduleRoutes = new Hono<AppEnv>()
  .use(requireUser)

  // Escala do repertório: quem está escalado e quem pode ser escalado (o dono e os músicos).
  .get('/setlist/:id', validate('param', idParam), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const { role, ownerId } = await requireAccess(id, uid)
    const isAdmin = atLeast(role, 'admin')

    const [s] = await db.select({ eventDate: setlist.eventDate }).from(setlist).where(eq(setlist.id, id))
    const [assignments, people] = await Promise.all([
      db
        .select({
          userId: setlistAssignment.userId,
          name: user.name,
          image: user.image,
          instrument: setlistAssignment.instrument,
          status: setlistAssignment.status,
          note: setlistAssignment.note,
          respondedAt: setlistAssignment.respondedAt,
          // Quem já está na escala mas avisou que não pode na data (só para quem administra).
          unavailable: isAdmin && s.eventDate ? unavailableOn(user.id, setlist.eventDate) : sql<string | null>`null`,
        })
        .from(setlistAssignment)
        .innerJoin(user, eq(user.id, setlistAssignment.userId))
        .innerJoin(setlist, eq(setlist.id, setlistAssignment.setlistId))
        .where(eq(setlistAssignment.setlistId, id))
        .orderBy(asc(setlistAssignment.createdAt)),
      // Quem administra vê quem avisou que não pode na data; os outros não veem a agenda alheia.
      isAdmin
        ? db
            .selectDistinct({
              userId: user.id,
              name: user.name,
              image: user.image,
              // O instrumento combinado no repertório; sem ele, o principal do perfil.
              instrument: sql<string | null>`coalesce(case when ${user.id} = ${setlistMember.userId} then ${setlistMember.instrument}::text end, ${primaryInstrument(user.id)})`,
              unavailable: s.eventDate ? unavailableOn(user.id, setlist.eventDate) : sql<string | null>`null`,
            })
            .from(setlist)
            .leftJoin(setlistMember, eq(setlistMember.setlistId, setlist.id))
            .innerJoin(user, or(eq(user.id, setlist.ownerId), eq(user.id, setlistMember.userId)))
            .where(eq(setlist.id, id))
        : Promise.resolve([]),
    ])
    return c.json({ eventDate: s.eventDate, ownerId, canEdit: isAdmin, assignments, people })
  })

  // Escalar (ou trocar o instrumento de) alguém do repertório.
  .put(
    '/setlist/:id/:userId',
    validate('param', memberParam),
    validate('json', z.object({ instrument: z.enum(schema.instrument.enumValues).nullish() })),
    async (c) => {
      const uid = c.var.user.id
      const { id, userId } = c.req.valid('param')
      const { instrument } = c.req.valid('json')
      const { ownerId } = await requireAccess(id, uid, true)
      if (userId !== ownerId) {
        const [m] = await db
          .select({ one: sql`1` })
          .from(setlistMember)
          .where(and(eq(setlistMember.setlistId, id), eq(setlistMember.userId, userId)))
        if (!m) forbidden('Só dá para escalar quem participa do repertório. Convide a pessoa primeiro.')
      }
      const [before] = await db
        .select({ one: sql`1` })
        .from(setlistAssignment)
        .where(and(eq(setlistAssignment.setlistId, id), eq(setlistAssignment.userId, userId)))
      await db
        .insert(setlistAssignment)
        // Quem se escala já está confirmado.
        .values({
          setlistId: id,
          userId,
          instrument: instrument ?? null,
          ...(userId === uid ? { status: 'confirmado' as const, respondedAt: new Date() } : {}),
        })
        .onConflictDoUpdate({
          target: [setlistAssignment.setlistId, setlistAssignment.userId],
          set: { instrument: instrument ?? null },
        })

      // Avisa por e-mail quem acabou de ser escalado (não a própria pessoa).
      if (!before && userId !== uid) {
        const [info] = await db
          .select({ email: user.email, name: setlist.name, eventDate: setlist.eventDate })
          .from(setlist)
          .innerJoin(user, eq(user.id, userId))
          .where(eq(setlist.id, id))
        if (info) {
          sendAssignmentEmail(info.email, c.var.user.name, info.name, info.eventDate, `${env.APP_URL}/repertorios/${id}`).catch(
            (err) => console.error('[escala] e-mail não enviado:', err),
          )
        }
      }
      return c.json({ ok: true })
    },
  )

  .delete('/setlist/:id/:userId', validate('param', memberParam), async (c) => {
    const { id, userId } = c.req.valid('param')
    await requireAccess(id, c.var.user.id, true)
    await db.delete(setlistAssignment).where(and(eq(setlistAssignment.setlistId, id), eq(setlistAssignment.userId, userId)))
    return c.body(null, 204)
  })

  // A própria pessoa responde: confirmo / não posso (com recado opcional).
  .post(
    '/setlist/:id/responder',
    validate('param', idParam),
    validate(
      'json',
      z.object({ status: z.enum(['confirmado', 'recusado']), note: z.string().trim().max(200).nullish() }),
    ),
    async (c) => {
      const uid = c.var.user.id
      const { id } = c.req.valid('param')
      const { status, note } = c.req.valid('json')
      const [row] = await db
        .update(setlistAssignment)
        .set({ status, note: note || null, respondedAt: new Date() })
        .where(and(eq(setlistAssignment.setlistId, id), eq(setlistAssignment.userId, uid)))
        .returning({ status: setlistAssignment.status })
      if (!row) notFound('Escala')
      return c.json({ ok: true })
    },
  )

  // Minhas escalas daqui para a frente (e as sem data).
  .get('/minhas', async (c) => {
    const uid = c.var.user.id
    const since = new Date(Date.now() - 12 * 3600 * 1000)
    const rows = await db
      .select({
        setlistId: setlist.id,
        setlistName: setlist.name,
        eventDate: setlist.eventDate,
        location: setlist.location,
        leaderName: user.name,
        instrument: setlistAssignment.instrument,
        status: setlistAssignment.status,
        note: setlistAssignment.note,
      })
      .from(setlistAssignment)
      .innerJoin(setlist, eq(setlist.id, setlistAssignment.setlistId))
      .innerJoin(user, eq(user.id, setlist.ownerId))
      .where(and(eq(setlistAssignment.userId, uid), eq(setlist.archived, false), or(isNull(setlist.eventDate), gte(setlist.eventDate, since))))
      .orderBy(sql`${setlist.eventDate} asc nulls last`)
    return c.json(rows)
  })

  // ---------------------------------------------------------------- indisponibilidade

  .get('/indisponivel', async (c) => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = await db
      .select({ id: unavailability.id, startsOn: unavailability.startsOn, endsOn: unavailability.endsOn, note: unavailability.note })
      .from(unavailability)
      .where(and(eq(unavailability.userId, c.var.user.id), gte(unavailability.endsOn, today)))
      .orderBy(asc(unavailability.startsOn))
    return c.json(rows)
  })

  .post(
    '/indisponivel',
    validate(
      'json',
      z
        .object({
          startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().trim().max(120).nullish(),
        })
        .refine((v) => v.endsOn >= v.startsOn, { message: 'A data final vem depois da inicial.', path: ['endsOn'] }),
    ),
    async (c) => {
      const { startsOn, endsOn, note } = c.req.valid('json')
      const [row] = await db
        .insert(unavailability)
        .values({ userId: c.var.user.id, startsOn, endsOn, note: note || null })
        .returning({ id: unavailability.id })
      return c.json(row, 201)
    },
  )

  .delete('/indisponivel/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await db.delete(unavailability).where(and(eq(unavailability.id, id), eq(unavailability.userId, c.var.user.id)))
    return c.body(null, 204)
  })
