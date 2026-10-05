// Partituras: cada "parte" (grade, piano, sax alto em Mi♭...) é uma sequência de páginas WebP.
// O aparelho do músico converte o PDF/foto e manda só as páginas leves; o original nunca
// chega aqui. Os arquivos ficam em disco (UPLOAD_DIR/scores/<id>/<n>.webp), o banco guarda
// só os dados, e cada página é servida conferindo se a pessoa pode ver a música.
import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { db, schema } from '../db'
import { env } from '../env'
import { forbidden, notFound, requireUser, validate, type AppEnv } from '../http'
import { assertCanCreate } from '../billing'
import { sweepHeroImages } from './hero'
import { canViewSong } from './songs'

const { song, songScore } = schema

export const SCORE_LIMITS = {
  pages: 30,
  /** Por página, já convertida (uma página típica fica entre 60 e 250 KB). */
  pageBytes: 1024 * 1024,
  /** Espaço total por pessoa (~1.000 páginas). */
  userBytes: 150 * 1024 * 1024,
}

const scoresDir = () => path.resolve(env.UPLOAD_DIR, 'scores')
const scoreDir = (id: string) => path.join(scoresDir(), id)
const pageFile = (id: string, n: number) => path.join(scoreDir(id), `${n}.webp`)

/** WebP de verdade? (cabeçalho RIFF....WEBP) — não guardamos outro tipo de arquivo. */
const isWebp = (b: Uint8Array) =>
  b.length > 12 &&
  String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' &&
  String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP'

async function loadScoreForOwner(scoreId: string, userId: string) {
  const [row] = await db
    .select({ score: songScore, ownerId: song.ownerId })
    .from(songScore)
    .innerJoin(song, eq(song.id, songScore.songId))
    .where(eq(songScore.id, scoreId))
  if (!row) notFound('Partitura')
  if (row.ownerId !== userId) forbidden('Só quem cadastrou a música pode alterar as partituras.')
  return row.score
}

/** Partes de uma música, para a tela da música. */
export async function scoresOfSong(songId: string) {
  return db
    .select({
      id: songScore.id,
      label: songScore.label,
      instrument: songScore.instrument,
      pages: songScore.pages,
      totalBytes: songScore.totalBytes,
    })
    .from(songScore)
    .where(eq(songScore.songId, songId))
    .orderBy(asc(songScore.createdAt))
}

/** Apaga do disco as partituras das músicas indicadas (o banco já remove as linhas em cascata). */
export async function removeScoreFiles(scoreIds: string[]) {
  await Promise.all(scoreIds.map((id) => rm(scoreDir(id), { recursive: true, force: true })))
}

const meta = z.object({
  songId: z.string().uuid(),
  label: z.string().trim().min(1, 'Dê um nome à parte (ex.: Piano, Sax alto)').max(80),
  instrument: z.enum(schema.instrument.enumValues).nullish(),
  // Tamanho de cada página, na ordem: [[largura, altura], ...]
  sizes: z.array(z.tuple([z.number().int().min(50).max(6000), z.number().int().min(50).max(9000)])).min(1).max(SCORE_LIMITS.pages),
})

export const scoresRoutes = new Hono<AppEnv>()
  .use(requireUser)

  // Envio: um formulário com os dados da parte e as páginas já convertidas (page0, page1...).
  .post('/', async (c) => {
    const uid = c.var.user.id
    const form = await c.req.parseBody({ all: false })
    let parsed: z.infer<typeof meta>
    try {
      parsed = meta.parse({
        songId: form.songId,
        label: form.label,
        instrument: form.instrument || null,
        sizes: JSON.parse(String(form.sizes ?? '[]')),
      })
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : null
      throw new HTTPException(400, { message: msg ?? 'Dados da partitura inválidos.' })
    }
    const { songId, label, instrument, sizes } = parsed

    const [own] = await db.select({ ownerId: song.ownerId }).from(song).where(eq(song.id, songId))
    if (!own) notFound('Música')
    if (own.ownerId !== uid) forbidden('Só quem cadastrou a música pode anexar partituras.')
    await assertCanCreate(uid)

    const pages: Uint8Array[] = []
    for (let i = 0; i < sizes.length; i++) {
      const f = form[`page${i}`]
      if (!(f instanceof File)) throw new HTTPException(400, { message: `Faltou a página ${i + 1}.` })
      if (f.size > SCORE_LIMITS.pageBytes) throw new HTTPException(413, { message: `A página ${i + 1} ficou grande demais.` })
      const bytes = new Uint8Array(await f.arrayBuffer())
      if (!isWebp(bytes)) throw new HTTPException(400, { message: `A página ${i + 1} não está no formato esperado.` })
      pages.push(bytes)
    }
    const total = pages.reduce((n, p) => n + p.length, 0)

    const [{ used }] = await db
      .select({ used: sql<number>`coalesce(sum(${songScore.totalBytes}), 0)::int` })
      .from(songScore)
      .where(eq(songScore.uploadedBy, uid))
    if (used + total > SCORE_LIMITS.userBytes) {
      throw new HTTPException(413, { message: 'Você atingiu o espaço para partituras. Apague partes que não usa mais.' })
    }

    // Grava numa pasta temporária e só "publica" (renomeia) depois de salvar no banco.
    const [row] = await db
      .insert(songScore)
      .values({
        songId,
        uploadedBy: uid,
        label,
        instrument: instrument ?? null,
        pages: sizes.map(([w, h], i) => ({ w, h, bytes: pages[i].length })),
        totalBytes: total,
      })
      .returning({ id: songScore.id })
    const tmp = `${scoreDir(row.id)}.tmp`
    try {
      await mkdir(tmp, { recursive: true })
      await Promise.all(pages.map((p, i) => writeFile(path.join(tmp, `${i}.webp`), p)))
      await rename(tmp, scoreDir(row.id))
    } catch (e) {
      await db.delete(songScore).where(eq(songScore.id, row.id))
      await rm(tmp, { recursive: true, force: true })
      throw e
    }
    return c.json({ id: row.id, pages: pages.length, totalBytes: total }, 201)
  })

  .patch(
    '/:id',
    validate('param', z.object({ id: z.string().uuid() })),
    validate('json', z.object({ label: z.string().trim().min(1).max(80), instrument: z.enum(schema.instrument.enumValues).nullish() })),
    async (c) => {
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      await loadScoreForOwner(id, c.var.user.id)
      await assertCanCreate(c.var.user.id)
      await db
        .update(songScore)
        .set({ label: input.label, instrument: input.instrument ?? null, updatedAt: new Date() })
        .where(eq(songScore.id, id))
      return c.json({ id })
    },
  )

  .delete('/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const { id } = c.req.valid('param')
    await loadScoreForOwner(id, c.var.user.id)
    await db.delete(songScore).where(eq(songScore.id, id))
    await removeScoreFiles([id])
    return c.body(null, 204)
  })

  // Página da partitura: só para quem pode ver a música (dona, pública ou da banda do repertório).
  .get(
    '/:id/:page{[0-9]+\\.webp}',
    validate('param', z.object({ id: z.string().uuid(), page: z.string() })),
    async (c) => {
      const uid = c.var.user.id
      const { id, page } = c.req.valid('param')
      const n = Number(page.replace('.webp', ''))
      const [row] = await db
        .select({ pages: songScore.pages })
        .from(songScore)
        .innerJoin(song, eq(song.id, songScore.songId))
        .where(and(eq(songScore.id, id), canViewSong(uid)))
      if (!row || n >= row.pages.length) notFound('Página')
      const file = pageFile(id, n)
      const info = await stat(file).catch(() => null)
      if (!info) notFound('Página')
      return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
        headers: {
          'Content-Type': 'image/webp',
          'Content-Length': String(info.size),
          // Cada parte tem um id novo a cada envio: a página nunca muda e pode ficar no aparelho.
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      })
    },
  )

/**
 * Limpeza: pastas sem partitura no banco (conta ou música apagada, envio interrompido).
 * Roda ao iniciar e uma vez por dia; só mexe em pastas com mais de 1 hora.
 */
export function startScoreSweeper() {
  const sweep = async () => {
    const entries = await readdir(scoresDir()).catch(() => [] as string[])
    if (!entries.length) return
    const known = new Set((await db.select({ id: songScore.id }).from(songScore)).map((r) => r.id))
    for (const name of entries) {
      const id = name.replace(/\.tmp$/, '')
      if (known.has(id) && !name.endsWith('.tmp')) continue
      const info = await stat(path.join(scoresDir(), name)).catch(() => null)
      if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) await rm(path.join(scoresDir(), name), { recursive: true, force: true })
    }
  }
  const run = () =>
    Promise.all([
      sweep().catch((e) => console.error('Partituras: falha na limpeza', e)),
      sweepHeroImages().catch((e) => console.error('Imagens do início: falha na limpeza', e)),
    ])
  setTimeout(run, 30_000)
  setInterval(run, 24 * 60 * 60 * 1000)
}
