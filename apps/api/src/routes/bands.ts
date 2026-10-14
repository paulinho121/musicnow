// Página pública da banda e pedidos de orçamento. A página e o formulário são abertos (sem
// login); criar, editar e ver os pedidos é só de quem é dono da página.
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { getRole } from '../access'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'
import { sendQuoteRequestEmail } from '../mail'
import { allow } from './analytics'

const { bandPage, quoteRequest, setlistItem, song, user } = schema

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
// Endereços do próprio app não viram nome de banda.
const RESERVED = new Set(['admin', 'api', 'app', 'ensaio-facil', 'ensaiofacil', 'suporte', 'ajuda', 'teste', 'www'])

const text = (max: number) => z.string().trim().max(max).nullish()
const pageInput = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, 'Use de 3 a 40 letras minúsculas, números ou hífen (ex.: banda-sol-maior).')
    .refine((s) => !RESERVED.has(s), 'Esse endereço não está disponível.'),
  name: z.string().trim().min(2, 'Dê o nome da banda.').max(80),
  city: text(80),
  bio: text(1500),
  genres: text(160),
  whatsapp: text(30),
  instagram: text(80),
  youtube: z.union([z.literal(''), z.string().trim().url('Link do YouTube inválido.').max(300)]).nullish(),
  setlistId: z.string().uuid().nullish(),
  published: z.boolean().default(true),
})

const quoteInput = z.object({
  name: z.string().trim().min(2, 'Diga o seu nome.').max(80),
  contact: z.string().trim().min(6, 'Deixe um WhatsApp ou e-mail para a banda responder.').max(120),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  eventType: text(60),
  location: text(160),
  message: text(1500),
  /** Campo escondido: só robô preenche. */
  website: z.string().max(200).optional(),
})

const idParam = z.object({ id: z.string().uuid() })
const slugParam = z.object({ slug: z.string().min(1).max(60) })

async function ownPage(id: string, userId: string) {
  const [p] = await db.select().from(bandPage).where(eq(bandPage.id, id))
  if (!p || p.ownerId !== userId) notFound('Página')
  return p
}

/** O repertório mostrado precisa ser de quem é dono da página (ou de quem administra). */
async function assertSetlist(setlistId: string | null | undefined, userId: string) {
  if (!setlistId) return
  const access = await getRole(setlistId, userId)
  if (!access) throw new HTTPException(400, { message: 'Repertório não encontrado.' })
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const [taken] = await db
    .select({ id: bandPage.id })
    .from(bandPage)
    .where(and(eq(bandPage.slug, slug), exceptId ? ne(bandPage.id, exceptId) : undefined))
  if (taken) throw new HTTPException(409, { message: 'Esse endereço já é de outra banda. Tente outro.' })
}

/** Rotas abertas: a página e o formulário de orçamento. */
export const publicBandsRoutes = new Hono()
  .get('/:slug', validate('param', slugParam), async (c) => {
    const { slug } = c.req.valid('param')
    const [p] = await db
      .select({
        id: bandPage.id,
        slug: bandPage.slug,
        name: bandPage.name,
        city: bandPage.city,
        bio: bandPage.bio,
        genres: bandPage.genres,
        whatsapp: bandPage.whatsapp,
        instagram: bandPage.instagram,
        youtube: bandPage.youtube,
        setlistId: bandPage.setlistId,
        image: user.image,
      })
      .from(bandPage)
      .innerJoin(user, eq(user.id, bandPage.ownerId))
      .where(and(eq(bandPage.slug, slug.toLowerCase()), eq(bandPage.published, true)))
    if (!p) notFound('Página')
    // Só o nome e o artista de cada música: a letra nunca sai daqui.
    const songs = p.setlistId
      ? await db
          .selectDistinct({ title: song.title, artist: song.artist, position: setlistItem.position })
          .from(setlistItem)
          .innerJoin(song, eq(song.id, setlistItem.songId))
          .where(eq(setlistItem.setlistId, p.setlistId))
          .orderBy(asc(setlistItem.position))
      : []
    const { setlistId: _s, id: _id, ...page } = p
    c.header('cache-control', 'public, max-age=60')
    return c.json({ ...page, songs: songs.map(({ title, artist }) => ({ title, artist })) })
  })

  .post('/:slug/orcamento', validate('param', slugParam), validate('json', quoteInput), async (c) => {
    const { slug } = c.req.valid('param')
    const { website, ...input } = c.req.valid('json')
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
    if (!allow(`orc:${ip}`, 5, 60 * 60_000))
      throw new HTTPException(429, { message: 'Muitos pedidos seguidos. Tente de novo mais tarde ou chame a banda no WhatsApp.' })
    const [p] = await db
      .select({ id: bandPage.id, name: bandPage.name, email: user.email })
      .from(bandPage)
      .innerJoin(user, eq(user.id, bandPage.ownerId))
      .where(and(eq(bandPage.slug, slug.toLowerCase()), eq(bandPage.published, true)))
    if (!p) notFound('Página')
    // Robô (preencheu o campo escondido): finge que deu certo e não grava.
    if (website) return c.json({ ok: true }, 201)
    await db.insert(quoteRequest).values({
      bandPageId: p.id,
      name: input.name,
      contact: input.contact,
      eventDate: input.eventDate ?? null,
      eventType: input.eventType || null,
      location: input.location || null,
      message: input.message || null,
    })
    sendQuoteRequestEmail(p.email, p.name, input, `${env.APP_URL}/minha-banda`).catch((e) => console.error('[orçamento] e-mail não enviado:', e))
    return c.json({ ok: true }, 201)
  })

/** Rotas de quem é dono: criar, editar, ver e responder pedidos. */
export const bandsRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const uid = c.var.user.id
    const pages = await db
      .select({
        page: bandPage,
        newRequests: sql<number>`(select count(*)::int from ${quoteRequest} q where q.band_page_id = ${bandPage.id} and q.status = 'novo')`,
      })
      .from(bandPage)
      .where(eq(bandPage.ownerId, uid))
      .orderBy(asc(bandPage.createdAt))
    return c.json(pages.map(({ page, newRequests }) => ({ ...page, newRequests })))
  })

  .post('/', validate('json', pageInput), async (c) => {
    const uid = c.var.user.id
    const input = c.req.valid('json')
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(bandPage).where(eq(bandPage.ownerId, uid))
    if (n >= 5) forbidden('Limite de 5 páginas por conta.')
    await assertSlugFree(input.slug)
    await assertSetlist(input.setlistId, uid)
    const [p] = await db
      .insert(bandPage)
      .values({ ...input, youtube: input.youtube || null, ownerId: uid })
      .returning({ id: bandPage.id, slug: bandPage.slug })
    return c.json(p, 201)
  })

  .put('/:id', validate('param', idParam), validate('json', pageInput), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    await ownPage(id, uid)
    await assertSlugFree(input.slug, id)
    await assertSetlist(input.setlistId, uid)
    await db
      .update(bandPage)
      .set({ ...input, youtube: input.youtube || null })
      .where(eq(bandPage.id, id))
    return c.json({ ok: true })
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await ownPage(id, c.var.user.id)
    await db.delete(bandPage).where(eq(bandPage.id, id))
    return c.body(null, 204)
  })

  .get('/:id/pedidos', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    await ownPage(id, c.var.user.id)
    const rows = await db
      .select({
        id: quoteRequest.id,
        name: quoteRequest.name,
        contact: quoteRequest.contact,
        eventDate: quoteRequest.eventDate,
        eventType: quoteRequest.eventType,
        location: quoteRequest.location,
        message: quoteRequest.message,
        status: quoteRequest.status,
        createdAt: quoteRequest.createdAt,
      })
      .from(quoteRequest)
      .where(eq(quoteRequest.bandPageId, id))
      .orderBy(desc(quoteRequest.createdAt))
      .limit(200)
    return c.json(rows)
  })

  .patch(
    '/pedidos/:id',
    validate('param', idParam),
    validate('json', z.object({ status: z.enum(['novo', 'respondido', 'arquivado']) })),
    async (c) => {
      const { id } = c.req.valid('param')
      const { status } = c.req.valid('json')
      const [q] = await db
        .select({ ownerId: bandPage.ownerId })
        .from(quoteRequest)
        .innerJoin(bandPage, eq(bandPage.id, quoteRequest.bandPageId))
        .where(eq(quoteRequest.id, id))
      if (!q || q.ownerId !== c.var.user.id) notFound('Pedido')
      await db.update(quoteRequest).set({ status }).where(eq(quoteRequest.id, id))
      return c.json({ ok: true })
    },
  )

  // Endereço livre? (enquanto a pessoa digita)
  .get('/endereco/:slug', validate('param', slugParam), async (c) => {
    const slug = c.req.valid('param').slug.toLowerCase()
    if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return c.json({ free: false })
    const [taken] = await db
      .select({ ownerId: bandPage.ownerId })
      .from(bandPage)
      .where(eq(bandPage.slug, slug))
    return c.json({ free: !taken || taken.ownerId === c.var.user.id })
  })

