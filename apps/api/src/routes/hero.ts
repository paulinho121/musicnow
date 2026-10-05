// Imagens do destaque do início, escolhidas pela pessoa (até 5, alternando).
// O aparelho reduz a foto para WebP antes de enviar; o servidor só guarda e devolve.
// Só a própria pessoa vê as suas imagens.
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { db, schema } from '../db'
import { env } from '../env'
import { notFound, requireUser, validate, type AppEnv } from '../http'

const { profile, user } = schema

export const HERO_LIMITS = { images: 5, bytes: 1.5 * 1024 * 1024 }

const heroRoot = () => path.resolve(env.UPLOAD_DIR, 'hero')
const userDir = (userId: string) => path.join(heroRoot(), userId.replace(/[^A-Za-z0-9_-]/g, ''))
const fileOf = (userId: string, id: string) => path.join(userDir(userId), `${id}.webp`)

const isWebp = (b: Uint8Array) =>
  b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP'

async function imagesOf(userId: string) {
  const [p] = await db.select({ heroImages: profile.heroImages }).from(profile).where(eq(profile.userId, userId))
  return p?.heroImages ?? []
}

async function saveImages(userId: string, heroImages: { id: string; w: number; h: number }[]) {
  await db
    .insert(profile)
    .values({ userId, heroImages })
    .onConflictDoUpdate({ target: profile.userId, set: { heroImages, updatedAt: new Date() } })
}

export const heroRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .post('/', async (c) => {
    const uid = c.var.user.id
    const form = await c.req.parseBody()
    const file = form.image
    const w = Number(form.w)
    const h = Number(form.h)
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'Escolha uma imagem.' })
    if (file.size > HERO_LIMITS.bytes) throw new HTTPException(413, { message: 'A imagem ficou grande demais.' })
    if (!(w >= 100 && w <= 4000 && h >= 100 && h <= 4000)) throw new HTTPException(400, { message: 'Tamanho da imagem inválido.' })
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isWebp(bytes)) throw new HTTPException(400, { message: 'A imagem não está no formato esperado.' })

    const images = await imagesOf(uid)
    if (images.length >= HERO_LIMITS.images) {
      throw new HTTPException(400, { message: `Você pode ter até ${HERO_LIMITS.images} imagens. Apague uma para colocar outra.` })
    }
    const id = randomUUID()
    await mkdir(userDir(uid), { recursive: true })
    await writeFile(fileOf(uid, id), bytes)
    const next = [...images, { id, w: Math.round(w), h: Math.round(h) }]
    await saveImages(uid, next)
    return c.json({ heroImages: next }, 201)
  })

  .delete('/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const images = await imagesOf(uid)
    if (!images.some((i) => i.id === id)) notFound('Imagem')
    const next = images.filter((i) => i.id !== id)
    await saveImages(uid, next)
    await unlink(fileOf(uid, id)).catch(() => {})
    return c.json({ heroImages: next })
  })

  // A própria pessoa vê as suas imagens (o id muda a cada envio: pode ficar no aparelho).
  .get('/:file{[0-9a-f-]{36}\\.webp}', async (c) => {
    const uid = c.var.user.id
    const id = c.req.param('file').replace(/\.webp$/, '')
    if (!(await imagesOf(uid)).some((i) => i.id === id)) notFound('Imagem')
    const file = fileOf(uid, id)
    const info = await stat(file).catch(() => null)
    if (!info) notFound('Imagem')
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { 'Content-Type': 'image/webp', 'Content-Length': String(info.size), 'Cache-Control': 'private, max-age=31536000, immutable' },
    })
  })

/** Limpeza: pastas de contas que não existem mais. */
export async function sweepHeroImages() {
  const dirs = await readdir(heroRoot()).catch(() => [] as string[])
  if (!dirs.length) return
  const ids = new Set((await db.select({ id: user.id }).from(user)).map((u) => u.id))
  for (const d of dirs) if (!ids.has(d)) await rm(path.join(heroRoot(), d), { recursive: true, force: true })
}
