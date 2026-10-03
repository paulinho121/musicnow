// Capas das músicas: a capa do álbum vem do Cover Art Archive, o acervo aberto de capas
// ligado ao MusicBrainz (https://coverartarchive.org). Guardamos só o LINK da imagem;
// quem a serve é o próprio acervo. Sem capa encontrada, o app desenha uma capa gerada.
import { normalizeSearch } from '@ensaio/shared'
import { and, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { lucene, mbGet } from './routes/catalog'

const { song } = schema
const CAA = 'https://coverartarchive.org'
export const COVER_URL_RE = /^https:\/\/coverartarchive\.org\/release-group\/[0-9a-f-]{36}\/front-250$/

interface MbRelease {
  status?: string
  date?: string
  'release-group'?: { id: string; 'primary-type'?: string; 'secondary-types'?: string[] }
}
interface MbRecording {
  score?: number
  'artist-credit'?: { name: string; joinphrase?: string }[]
  releases?: MbRelease[]
}

/** O acervo tem imagem para este álbum? (responde com redirecionamento quando tem) */
async function hasFront(releaseGroupId: string) {
  const res = await fetch(`${CAA}/release-group/${releaseGroupId}/front-250`, {
    method: 'HEAD',
    redirect: 'manual',
    headers: { 'User-Agent': 'EnsaioFacil/0.1 ( https://github.com/paulinho121/musicnow )' },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  return Boolean(res && (res.status === 307 || res.status === 302 || res.status === 200))
}

/**
 * Procura a capa de uma música pelo título e artista. Só aceita resultados em que o
 * artista confere: uma música autoral com nome comum não ganha a capa de outra pessoa.
 */
export async function findCover(title: string, artist: string): Promise<string | null> {
  const q = `recording:"${lucene(title)}" AND artist:"${lucene(artist)}"`
  const data = await mbGet<{ recordings?: MbRecording[] }>(`/recording?fmt=json&limit=15&query=${encodeURIComponent(q)}`)
  const want = normalizeSearch(artist)
  const groups: { id: string; rank: number; date: string }[] = []
  for (const r of data.recordings ?? []) {
    if ((r.score ?? 0) < 90) continue
    const credit = normalizeSearch((r['artist-credit'] ?? []).map((a) => a.name + (a.joinphrase ?? '')).join(''))
    if (!credit.includes(want) && !want.includes(credit)) continue
    for (const rel of r.releases ?? []) {
      const rg = rel['release-group']
      if (!rg) continue
      // Prefere o álbum/single oficial original a coletâneas e ao vivo.
      const secondary = rg['secondary-types'] ?? []
      const rank =
        (rel.status === 'Official' ? 0 : 2) +
        (rg['primary-type'] === 'Album' ? 0 : rg['primary-type'] === 'Single' ? 1 : 2) +
        (secondary.length ? 3 : 0)
      groups.push({ id: rg.id, rank, date: rel.date ?? '9999' })
    }
  }
  const seen = new Set<string>()
  const ordered = groups
    .sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date))
    .filter((g) => !seen.has(g.id) && seen.add(g.id))
    .slice(0, 4)
  for (const g of ordered) if (await hasFront(g.id)) return `${CAA}/release-group/${g.id}/front-250`
  return null
}

// ---------------------------------------------------------------- busca em segundo plano

const RETRY_AFTER_DAYS = 30
let running = false

/** Uma música por vez: as que ainda não têm capa decidida e têm artista. */
async function step() {
  const [next] = await db
    .select({ id: song.id, title: song.title, artist: song.artist })
    .from(song)
    .where(
      and(
        isNull(song.coverUrl),
        isNotNull(song.artist),
        or(isNull(song.coverCheckedAt), lt(song.coverCheckedAt, sql`now() - make_interval(days => ${RETRY_AFTER_DAYS})`)),
      ),
    )
    .orderBy(desc(song.updatedAt))
    .limit(1)
  if (!next) return false
  let url: string | null = null
  try {
    url = await findCover(next.title, next.artist!)
  } catch (e) {
    console.error('Capa: falha ao consultar', (e as Error).message)
  }
  // Marca como procurada mesmo sem achar (tenta de novo em 30 dias).
  // Não mexe se a pessoa escolheu outra capa enquanto a busca rodava.
  await db
    .update(song)
    .set({ coverUrl: url, coverCheckedAt: new Date() })
    .where(and(eq(song.id, next.id), isNull(song.coverUrl)))
  return true
}

/** Liga o preenchimento automático das capas (devagar, para respeitar o MusicBrainz). */
export function startCoverWorker() {
  const tick = async () => {
    if (running) return
    running = true
    try {
      const didWork = await step()
      setTimeout(tick, didWork ? 4000 : 60_000)
    } catch (e) {
      console.error('Capa: erro no preenchimento', e)
      setTimeout(tick, 60_000)
    } finally {
      running = false
    }
  }
  setTimeout(tick, 10_000)
}
