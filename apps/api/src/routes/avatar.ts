// Foto de perfil. O aparelho recorta e reduz a foto (quadrada, WebP) antes de enviar; o
// servidor só guarda e devolve. Fica em user.image, que a banda vê nos repertórios: o
// endereço tem um código aleatório (não dá para adivinhar a foto de ninguém).
import { eq, like } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { db, schema } from '../db'
import { env } from '../env'
import { notFound, requireUser, type AppEnv } from '../http'

const { user } = schema

const MAX_BYTES = 400 * 1024
const PREFIX = '/api/avatars/'
const FILE_RE = /^[A-Za-z0-9_-]{8,80}\.webp$/

const avatarDir = () => path.resolve(env.UPLOAD_DIR, 'avatars')
const isWebp = (b: Uint8Array) =>
  b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP'

/** Nome do arquivo da foto enviada pelo app (null para foto do Google ou nenhuma). */
const ownFile = (image: string | null | undefined) => {
  const name = image?.startsWith(PREFIX) ? image.slice(PREFIX.length) : null
  return name && FILE_RE.test(name) ? name : null
}

async function removeOld(image: string | null | undefined) {
  const name = ownFile(image)
  if (name) await unlink(path.join(avatarDir(), name)).catch(() => {})
}

/** Enviar e remover a própria foto (/api/me/avatar). */
export const avatarRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .post('/', async (c) => {
    const uid = c.var.user.id
    const form = await c.req.parseBody()
    const file = form.image
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'Escolha uma foto.' })
    if (file.size > MAX_BYTES) throw new HTTPException(413, { message: 'A foto ficou grande demais.' })
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isWebp(bytes)) throw new HTTPException(400, { message: 'A foto não está no formato esperado.' })

    const [before] = await db.select({ image: user.image }).from(user).where(eq(user.id, uid))
    const name = `${uid.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}-${randomBytes(9).toString('base64url')}.webp`
    await mkdir(avatarDir(), { recursive: true })
    await writeFile(path.join(avatarDir(), name), bytes)
    const image = PREFIX + name
    await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, uid))
    await removeOld(before?.image)
    return c.json({ image }, 201)
  })

  .delete('/', async (c) => {
    const uid = c.var.user.id
    const [before] = await db.select({ image: user.image }).from(user).where(eq(user.id, uid))
    await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, uid))
    await removeOld(before?.image)
    return c.json({ image: null })
  })

/** A foto em si (/api/avatars/:arquivo): pública, como a de qualquer rede social. */
export const avatarFilesRoutes = new Hono<AppEnv>().get('/:file', async (c) => {
  const name = c.req.param('file')
  if (!FILE_RE.test(name)) notFound('Foto')
  const file = path.join(avatarDir(), name)
  const info = await stat(file).catch(() => null)
  if (!info) notFound('Foto')
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(info.size), 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

/** Limpeza: fotos que nenhuma conta usa mais (conta apagada, envio interrompido). */
export async function sweepAvatars() {
  const files = await readdir(avatarDir()).catch(() => [] as string[])
  if (!files.length) return
  const used = new Set(
    (await db.select({ image: user.image }).from(user).where(like(user.image, `${PREFIX}%`))).map((u) => ownFile(u.image)),
  )
  for (const f of files) {
    if (used.has(f)) continue
    const info = await stat(path.join(avatarDir(), f)).catch(() => null)
    // Margem de 1 hora: não apaga uma foto que acabou de ser enviada.
    if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) await unlink(path.join(avatarDir(), f)).catch(() => {})
  }
}
