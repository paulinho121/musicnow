// Áudio guia da música (Sala de ensaio): um arquivo por música, enviado por quem cadastrou.
// Fica em disco (UPLOAD_DIR/audio/<id>), o banco guarda os dados (song_file) e o arquivo é
// servido só para quem pode ver a música, com Range (o Safari do iPhone exige para tocar).
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { assertCanCreate } from '../billing'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'
import { canViewSong } from './songs'

const { song, songFile } = schema

export const AUDIO_LIMITS = {
  /** Por arquivo (um MP3 de 5 minutos tem uns 10 MB). */
  fileBytes: 25 * 1024 * 1024,
  /** Espaço total por pessoa. */
  userBytes: 300 * 1024 * 1024,
}

const audioDir = () => path.resolve(env.UPLOAD_DIR, 'audio')
const audioFile = (id: string) => path.join(audioDir(), id)

/** Tipo pelo conteúdo (não pelo nome): só guardamos áudio de verdade. */
function audioType(b: Uint8Array): string | null {
  const s = (a: number, n: number) => String.fromCharCode(...b.slice(a, a + n))
  if (b.length < 12) return null
  if (s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (s(4, 4) === 'ftyp') return 'audio/mp4'
  if (s(0, 4) === 'OggS') return 'audio/ogg'
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WAVE') return 'audio/wav'
  if (s(0, 4) === 'fLaC') return 'audio/flac'
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm'
  return null
}

const columns = { id: songFile.id, fileName: songFile.fileName, mimeType: songFile.mimeType, sizeBytes: songFile.sizeBytes }

export const audioRoutes = new Hono<AppEnv>()
  .use(requireUser)

  // Áudio guia da música (ou null), para quem pode ver a música.
  .get('/song/:songId', validate('param', z.object({ songId: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { songId } = c.req.valid('param')
    const [visible] = await db
      .select({ ownerId: song.ownerId })
      .from(song)
      .where(and(eq(song.id, songId), canViewSong(uid)))
    if (!visible) notFound('Música')
    const [row] = await db.select(columns).from(songFile).where(eq(songFile.songId, songId))
    return c.json({ audio: row ?? null, canEdit: visible.ownerId === uid })
  })

  // Envio (substitui o anterior): formulário com songId e file.
  .post('/', async (c) => {
    const uid = c.var.user.id
    const form = await c.req.parseBody({ all: false })
    const songId = z.string().uuid().safeParse(form.songId)
    const file = form.file
    if (!songId.success || !(file instanceof File)) throw new HTTPException(400, { message: 'Escolha um arquivo de áudio.' })
    if (file.size > AUDIO_LIMITS.fileBytes) throw new HTTPException(413, { message: 'Arquivo grande demais (máximo de 25 MB). Use MP3.' })

    const [own] = await db.select({ ownerId: song.ownerId }).from(song).where(eq(song.id, songId.data))
    if (!own) notFound('Música')
    if (own.ownerId !== uid) forbidden('Só quem cadastrou a música pode enviar o áudio guia.')
    await assertCanCreate(uid)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const mimeType = audioType(bytes)
    if (!mimeType) throw new HTTPException(400, { message: 'Formato não reconhecido. Envie MP3, M4A, OGG, WAV ou FLAC.' })

    const [old] = await db.select({ id: songFile.id, size: songFile.sizeBytes }).from(songFile).where(eq(songFile.songId, songId.data))
    const [{ used }] = await db
      .select({ used: sql<number>`coalesce(sum(${songFile.sizeBytes}), 0)::int` })
      .from(songFile)
      .where(eq(songFile.uploadedBy, uid))
    if (used - (old?.size ?? 0) + bytes.length > AUDIO_LIMITS.userBytes)
      throw new HTTPException(413, { message: 'Você atingiu o espaço para áudios. Apague áudios de músicas que não usa mais.' })

    await mkdir(audioDir(), { recursive: true })
    const [row] = await db
      .insert(songFile)
      .values({
        songId: songId.data,
        uploadedBy: uid,
        fileName: file.name.slice(0, 200) || 'audio',
        mimeType,
        sizeBytes: bytes.length,
        storagePath: 'audio',
      })
      .returning(columns)
    try {
      await writeFile(audioFile(row.id), bytes)
    } catch (e) {
      await db.delete(songFile).where(eq(songFile.id, row.id))
      throw e
    }
    // O anterior sai só depois que o novo está salvo.
    if (old) {
      await db.delete(songFile).where(eq(songFile.id, old.id))
      await rm(audioFile(old.id), { force: true })
    }
    return c.json(row, 201)
  })

  .delete('/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const { id } = c.req.valid('param')
    const [row] = await db
      .select({ ownerId: song.ownerId })
      .from(songFile)
      .innerJoin(song, eq(song.id, songFile.songId))
      .where(eq(songFile.id, id))
    // Quem não é dono nem fica sabendo que o áudio existe.
    if (!row || row.ownerId !== c.var.user.id) notFound('Áudio')
    await db.delete(songFile).where(eq(songFile.id, id))
    await rm(audioFile(id), { force: true })
    return c.body(null, 204)
  })

  // O arquivo, com Range (pular para um ponto da música sem baixar tudo de novo).
  .get('/:id/arquivo', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const uid = c.var.user.id
    const { id } = c.req.valid('param')
    const [row] = await db
      .select({ mimeType: songFile.mimeType })
      .from(songFile)
      .innerJoin(song, eq(song.id, songFile.songId))
      .where(and(eq(songFile.id, id), canViewSong(uid)))
    if (!row) notFound('Áudio')
    const file = audioFile(id)
    const info = await stat(file).catch(() => null)
    if (!info) notFound('Áudio')
    const size = info.size
    const headers: Record<string, string> = {
      'Content-Type': row.mimeType,
      'Accept-Ranges': 'bytes',
      // Cada envio tem um id novo: o arquivo nunca muda.
      'Cache-Control': 'private, max-age=31536000, immutable',
    }
    const range = c.req.header('range')?.match(/^bytes=(\d*)-(\d*)$/)
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2])
      let end = range[1] && range[2] ? Number(range[2]) : size - 1
      start = Math.max(0, start)
      end = Math.min(size - 1, end)
      if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      })
    }
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { ...headers, 'Content-Length': String(size) },
    })
  })

/** Arquivos sem registro no banco (música ou conta apagada) com mais de 1 hora. */
export async function sweepAudio() {
  const entries = await readdir(audioDir()).catch(() => [] as string[])
  if (!entries.length) return
  const known = new Set((await db.select({ id: songFile.id }).from(songFile)).map((r) => r.id))
  for (const name of entries) {
    if (known.has(name)) continue
    const info = await stat(path.join(audioDir(), name)).catch(() => null)
    if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) await rm(path.join(audioDir(), name), { force: true })
  }
}
