// Dados das músicas (artista, compositor, ano) vindos do MusicBrainz — um banco aberto
// de METADADOS musicais (não de letras ou cifras), liberado para qualquer uso.
// https://musicbrainz.org/doc/MusicBrainz_API
//
// As consultas passam pelo servidor para:
//  - respeitar o limite do MusicBrainz (1 consulta/s para o app inteiro) e identificar o app;
//  - guardar respostas (mais rápido e menos consultas);
//  - não expor ao MusicBrainz quem são os usuários.
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { findCover } from '../covers'
import { requireUser, validate, type AppEnv } from '../http'

const MB = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'EnsaioFacil/0.1 ( https://github.com/paulinho121/musicnow )'
const MIN_GAP_MS = 1100
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 500

// Fila global: uma consulta por vez, com intervalo mínimo entre elas.
let chain: Promise<unknown> = Promise.resolve()
let lastCall = 0
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()
    return fn()
  })
  chain = run.catch(() => {})
  return run
}

const cache = new Map<string, { at: number; value: unknown }>()
export async function mbGet<T>(path: string): Promise<T> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T
  // O MusicBrainz responde 503 quando está cheio ou limitando o IP (IPs de nuvem são
  // compartilhados). Tenta de novo com espera crescente antes de desistir.
  let value: unknown
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() =>
      fetch(`${MB}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null),
    )
    if (res?.ok) {
      value = await res.json()
      break
    }
    const retryable = !res || res.status === 503 || res.status === 429
    if (!retryable || attempt >= 3) {
      if (!res) throw new HTTPException(504, { message: 'O MusicBrainz não respondeu. Tente de novo.' })
      if (retryable) throw new HTTPException(503, { message: 'O MusicBrainz está ocupado. Tente em alguns segundos.' })
      throw new HTTPException(502, { message: 'Não foi possível consultar o MusicBrainz.' })
    }
    await new Promise((r) => setTimeout(r, 1200 * 2 ** attempt))
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(path, { at: Date.now(), value })
  return value as T
}

// Limite por pessoa, para ninguém monopolizar a fila do app.
const perUser = new Map<string, number[]>()
function checkUserRate(userId: string) {
  const now = Date.now()
  const recent = (perUser.get(userId) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= 20) throw new HTTPException(429, { message: 'Muitas buscas seguidas. Aguarde um minuto.' })
  recent.push(now)
  perUser.set(userId, recent)
}

/** Escapa caracteres especiais da busca do MusicBrainz (sintaxe Lucene). */
export const lucene = (s: string) => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')

interface MbArtistCredit {
  name: string
  joinphrase?: string
}
interface MbRecording {
  id: string
  title: string
  score?: number
  'artist-credit'?: MbArtistCredit[]
  'first-release-date'?: string
  releases?: { title: string }[]
  relations?: { type: string; work?: { id: string; title: string } }[]
}
interface MbWork {
  title: string
  relations?: { type: string; artist?: { name: string } }[]
}

interface CatalogItem {
  id: string
  title: string
  artist: string | null
  year: number | null
  album: string | null
}

const credit = (ac?: MbArtistCredit[]) => (ac ?? []).map((a) => a.name + (a.joinphrase ?? '')).join('').trim() || null
const year = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null)

export const catalogRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get(
    '/search',
    validate(
      'query',
      z.object({
        title: z.string().trim().min(2, 'Digite pelo menos 2 letras do título').max(120),
        artist: z.string().trim().max(120).optional(),
      }),
    ),
    async (c) => {
      checkUserRate(c.var.user.id)
      const { title, artist } = c.req.valid('query')
      const q = `recording:"${lucene(title)}"` + (artist ? ` AND artist:"${lucene(artist)}"` : '')
      const data = await mbGet<{ recordings?: MbRecording[] }>(
        `/recording?fmt=json&limit=60&query=${encodeURIComponent(q)}`,
      )
      // Várias gravações da mesma música (ao vivo, remaster, coletânea...) viram um resultado
      // por título + artista. O MusicBrainz não tem "popularidade", mas sucessos aparecem em
      // muitos discos: o total de lançamentos ordena os resultados (desempate pela relevância).
      const groups = new Map<string, { item: CatalogItem; releases: number; score: number }>()
      for (const r of data.recordings ?? []) {
        const score = r.score ?? 100
        if (score < 60) continue
        const a = credit(r['artist-credit'])
        const key = `${r.title.toLowerCase()}|${(a ?? '').toLowerCase()}`
        const releases = r.releases?.length ?? 0
        const g = groups.get(key)
        if (g) {
          g.releases += releases
          g.score = Math.max(g.score, score)
          // Fica com a gravação mais antiga (costuma ser a original).
          const y = year(r['first-release-date'])
          if (y && (!g.item.year || y < g.item.year)) g.item = { ...g.item, id: r.id, year: y, album: r.releases?.[0]?.title ?? g.item.album }
        } else {
          groups.set(key, {
            item: { id: r.id, title: r.title, artist: a, year: year(r['first-release-date']), album: r.releases?.[0]?.title ?? null },
            releases,
            score,
          })
        }
      }
      const results = [...groups.values()]
        .sort((x, y) => Math.round(y.score / 10) - Math.round(x.score / 10) || y.releases - x.releases)
        .slice(0, 8)
        .map((g) => g.item)
      return c.json(results)
    },
  )

  // Capa do álbum para título + artista (botão "Buscar capa" no editor).
  .get(
    '/cover',
    validate('query', z.object({ title: z.string().trim().min(1).max(200), artist: z.string().trim().min(1).max(200) })),
    async (c) => {
      checkUserRate(c.var.user.id)
      const { title, artist } = c.req.valid('query')
      return c.json({ url: await findCover(title, artist) })
    },
  )

  .get('/recording/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    checkUserRate(c.var.user.id)
    const { id } = c.req.valid('param')
    const rec = await mbGet<MbRecording>(`/recording/${id}?fmt=json&inc=artist-credits+work-rels`)
    const workId = rec.relations?.find((r) => r.type === 'performance' && r.work)?.work?.id
    let composers: string[] = []
    let lyricists: string[] = []
    if (workId) {
      const work = await mbGet<MbWork>(`/work/${workId}?fmt=json&inc=artist-rels`)
      const names = (types: string[]) => [
        ...new Set((work.relations ?? []).filter((r) => types.includes(r.type) && r.artist).map((r) => r.artist!.name)),
      ]
      composers = names(['composer', 'writer'])
      lyricists = names(['lyricist'])
    }
    const authors = [...new Set([...composers, ...lyricists])]
    return c.json({
      title: rec.title,
      artist: credit(rec['artist-credit']),
      composer: authors.length ? authors.join(', ') : null,
      year: year(rec['first-release-date']),
      source: `https://musicbrainz.org/recording/${id}`,
    })
  })
