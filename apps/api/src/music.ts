// Spotify e Deezer: resolve os links curtos dos apps e lê playlists/álbuns públicos
// (só nome da música, artista e link) para montar um repertório.
import { isShortMusicLink, parseMusicLink, SHORT_MUSIC_HOSTS, type MusicLink } from '@ensaio/shared'
import { HTTPException } from 'hono/http-exception'
import { env } from './env'

const MAX_TRACKS = 200
const TIMEOUT = 10_000
const fail = (message: string, status: 400 | 502 | 503 = 400): never => {
  throw new HTTPException(status, { message })
}

// Só segue redirecionamentos para os próprios serviços (nunca para endereços internos).
const FOLLOW_HOSTS = new Set([...SHORT_MUSIC_HOSTS, 'deezer.com', 'www.deezer.com', 'open.spotify.com'])
const LINK_IN_PAGE =
  /https:\/\/(?:www\.)?(?:deezer\.com\/(?:[a-z]{2}\/)?(?:track|album|playlist)\/\d+|open\.spotify\.com\/(?:track|album|playlist)\/[A-Za-z0-9]{22})/

/** Link curto do botão "Compartilhar" (link.deezer.com, spotify.link) → endereço completo. */
export async function resolveShortLink(raw: string): Promise<string> {
  let url = raw.trim()
  for (let hop = 0; hop < 5; hop++) {
    if (parseMusicLink(url)) return url
    const u = new URL(url)
    if (u.protocol !== 'https:' || !FOLLOW_HOSTS.has(u.hostname.toLowerCase())) break
    const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null)
    if (!res) break
    const next = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, u).toString()
      continue
    }
    // Algumas páginas de link curto redirecionam pelo navegador: procura o link na página.
    const found = LINK_IN_PAGE.exec((await res.text()).slice(0, 200_000))?.[0]
    if (found) return found
    break
  }
  return fail('Não conseguimos abrir esse link. Copie o link completo da música no app (Compartilhar → Copiar link).')
}

/** Gravação de referência: aceita link curto; guarda o endereço limpo (sem rastreamento). */
export async function normalizeReference(raw: string | null | undefined): Promise<string | null | undefined> {
  if (!raw) return raw
  const url = isShortMusicLink(raw) ? await resolveShortLink(raw) : raw
  const link = parseMusicLink(url)
  if (!link) return fail('Use um link do YouTube, Spotify, Deezer ou Apple Music.')
  return link.service === 'youtube' ? url.trim() : link.openUrl
}

export interface PlaylistTrack {
  title: string
  artist: string | null
  url: string
}

export interface ImportedPlaylist {
  service: 'spotify' | 'deezer'
  name: string
  tracks: PlaylistTrack[]
  /** Passou do limite e parte das músicas ficou de fora. */
  truncated: boolean
}

/** "Evidências - Ao Vivo" → "Evidências"; "Song (feat. X)" → "Song". O link guarda a versão. */
export function cleanTrackTitle(title: string): string {
  const version = /ao vivo|live|remaster|vers[aã]o|version|ac[uú]stic|edit|radio|mono|stereo|mix|deluxe|bonus/i
  let t = title.replace(/\s*[([](?:feat\.?|ft\.?|part\.?|participação)[^)\]]*[)\]]/gi, '')
  const dash = t.lastIndexOf(' - ')
  if (dash > 0 && version.test(t.slice(dash))) t = t.slice(0, dash)
  t = t.replace(/\s*[([][^)\]]*[)\]]\s*$/, (m) => (version.test(m) ? '' : m))
  return t.trim() || title.trim()
}

async function getJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null)
  if (!res) return { status: 0, body: null }
  return { status: res.status, body: (await res.json().catch(() => null)) as T | null }
}

// ---------------------------------------------------------------------------
// Deezer (API pública, sem chave)

interface DeezerTrack {
  title: string
  title_short?: string
  link: string
  artist?: { name: string }
}
interface DeezerPage {
  data?: DeezerTrack[]
  next?: string
  error?: { message: string }
}

async function deezerPlaylist(link: MusicLink): Promise<ImportedPlaylist> {
  const base = `https://api.deezer.com/${link.kind}/${link.id}`
  const { body: info } = await getJson<{ title?: string; error?: unknown }>(base)
  if (!info || info.error || !info.title) fail('Não achamos essa playlist no Deezer. Confira se ela é pública.')
  const tracks: PlaylistTrack[] = []
  let next: string | undefined = `${base}/tracks?limit=100&index=0`
  while (next && tracks.length < MAX_TRACKS) {
    // A paginação sempre aponta para a própria API do Deezer.
    if (!next.startsWith('https://api.deezer.com/')) break
    const { body: page }: { body: DeezerPage | null } = await getJson<DeezerPage>(next)
    if (!page?.data) break
    for (const t of page.data) {
      tracks.push({ title: cleanTrackTitle(t.title_short || t.title), artist: t.artist?.name ?? null, url: t.link })
    }
    next = page.next
  }
  return {
    service: 'deezer',
    name: info!.title!,
    tracks: tracks.slice(0, MAX_TRACKS),
    truncated: Boolean(next) || tracks.length > MAX_TRACKS,
  }
}

// ---------------------------------------------------------------------------
// Spotify (precisa do cadastro grátis em developer.spotify.com: SPOTIFY_CLIENT_ID/SECRET)

let spotifyToken: { value: string; expires: number } | null = null

async function spotifyAuth(): Promise<string> {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    return fail('A importação do Spotify ainda não foi ativada. Por enquanto, use uma playlist do Deezer.', 503)
  }
  if (spotifyToken && spotifyToken.expires > Date.now()) return spotifyToken.value
  const { body } = await getJson<{ access_token?: string; expires_in?: number }>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!body?.access_token) return fail('O Spotify não respondeu agora. Tente de novo em instantes.', 502)
  spotifyToken = { value: body.access_token, expires: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 }
  return spotifyToken.value
}

interface SpotifyTrack {
  name: string
  artists?: { name: string }[]
  external_urls?: { spotify?: string }
  id?: string
  type?: string
}
interface SpotifyPage {
  items?: ({ track?: SpotifyTrack | null; item?: SpotifyTrack | null } & Partial<SpotifyTrack>)[]
  next?: string | null
}

const spotifyTrack = (t: SpotifyTrack): PlaylistTrack | null =>
  t?.name && t.type !== 'episode'
    ? {
        title: cleanTrackTitle(t.name),
        artist: t.artists?.map((a) => a.name).join(', ') || null,
        url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
      }
    : null

async function spotifyPlaylist(link: MusicLink): Promise<ImportedPlaylist> {
  const token = await spotifyAuth()
  const headers = { authorization: `Bearer ${token}` }
  const api = 'https://api.spotify.com/v1'
  const notFound =
    'Não achamos essa playlist no Spotify. Ela precisa ser pública (playlists feitas pelo próprio Spotify não podem ser lidas).'

  if (link.kind === 'track') {
    const { body } = await getJson<SpotifyTrack>(`${api}/tracks/${link.id}`, { headers })
    const t = body && spotifyTrack({ ...body, type: 'track' })
    if (!t) fail(notFound)
    return { service: 'spotify', name: t!.title, tracks: [t!], truncated: false }
  }

  const { body: info } = await getJson<{ name?: string }>(`${api}/${link.kind}s/${link.id}?fields=name`, { headers })
  if (!info?.name) fail(notFound)
  // Playlists: endpoint "/items" (novo) com recuo para "/tracks"; álbuns: "/tracks".
  const paths = link.kind === 'playlist' ? ['items', 'tracks'] : ['tracks']
  const tracks: PlaylistTrack[] = []
  let next: string | null = null
  for (const path of paths) {
    next = `${api}/${link.kind}s/${link.id}/${path}?limit=${link.kind === 'album' ? 50 : 100}&offset=0`
    const first = await getJson<SpotifyPage>(next, { headers })
    if (first.status === 404 || first.status === 410 || !first.body?.items) continue
    let page: SpotifyPage | null = first.body
    while (page?.items) {
      for (const it of page.items) {
        const t = spotifyTrack((it.track ?? it.item ?? (it as SpotifyTrack)) as SpotifyTrack)
        if (t) tracks.push(t)
      }
      next = page.next ?? null
      if (!next || tracks.length >= MAX_TRACKS || !next.startsWith(api)) break
      page = (await getJson<SpotifyPage>(next, { headers })).body
    }
    break
  }
  if (!tracks.length) fail(notFound)
  return {
    service: 'spotify',
    name: info!.name!,
    tracks: tracks.slice(0, MAX_TRACKS),
    truncated: Boolean(next) || tracks.length > MAX_TRACKS,
  }
}

/** Link de playlist ou álbum (Spotify ou Deezer) → nome e músicas na ordem. */
export async function importPlaylist(raw: string): Promise<ImportedPlaylist> {
  const url = isShortMusicLink(raw) ? await resolveShortLink(raw) : raw
  const link = parseMusicLink(url)
  if (!link || (link.service !== 'spotify' && link.service !== 'deezer')) {
    return fail('Cole o link de uma playlist do Spotify ou do Deezer.')
  }
  return link.service === 'deezer' ? deezerPlaylist(link) : spotifyPlaylist(link)
}
