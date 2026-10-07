// Links das plataformas de música (YouTube, Spotify, Deezer, Apple Music): gravação de
// referência tocada no player oficial de cada uma e busca da música em cada serviço.
import { mainArtist, type SongRef } from './links'
import { youtubeId } from './domain'

export const MUSIC_SERVICES = ['youtube', 'spotify', 'deezer', 'apple'] as const
export type MusicService = (typeof MUSIC_SERVICES)[number]

export const MUSIC_SERVICE_LABEL: Record<MusicService, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  deezer: 'Deezer',
  apple: 'Apple Music',
}

/** Cor de cada serviço (ícones e botões). */
export const MUSIC_SERVICE_COLOR: Record<MusicService, string> = {
  youtube: '#ff4e45',
  spotify: '#1ed760',
  deezer: '#a238ff',
  apple: '#fa2d48',
}

export type MusicKind = 'track' | 'album' | 'playlist'

export interface MusicLink {
  service: MusicService
  kind: MusicKind
  id: string
  /** Endereço do player oficial (iframe). */
  embedUrl: string
  /** Altura do player (o YouTube usa 16:9). */
  embedHeight: number | null
  /** Link para abrir no app/site do serviço. */
  openUrl: string
}

/** Links curtos dos apps (botão "Compartilhar"): o servidor descobre o endereço completo. */
export const SHORT_MUSIC_HOSTS = ['link.deezer.com', 'deezer.page.link', 'spotify.link', 'spotify.app.link']

function toUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

export function isShortMusicLink(raw: string | null | undefined) {
  const u = toUrl(raw)
  return Boolean(u && SHORT_MUSIC_HOSTS.includes(u.hostname.toLowerCase()))
}

/**
 * Reconhece um link de música/álbum/playlist do YouTube, Spotify, Deezer ou Apple Music.
 * Devolve null para qualquer outro endereço (inclusive links curtos, que o servidor resolve).
 */
export function parseMusicLink(raw: string | null | undefined): MusicLink | null {
  const yt = youtubeId(raw)
  if (yt) {
    return {
      service: 'youtube',
      kind: 'track',
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`,
      embedHeight: null,
      openUrl: `https://www.youtube.com/watch?v=${yt}`,
    }
  }
  const u = toUrl(raw)
  if (!u) return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const parts = u.pathname.split('/').filter(Boolean)

  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    if (/^intl-/.test(parts[0] ?? '')) parts.shift()
    const [kind, id] = parts
    if (!['track', 'album', 'playlist'].includes(kind) || !/^[A-Za-z0-9]{22}$/.test(id ?? '')) return null
    return {
      service: 'spotify',
      kind: kind as MusicKind,
      id,
      embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
      embedHeight: kind === 'track' ? 152 : 352,
      openUrl: `https://open.spotify.com/${kind}/${id}`,
    }
  }

  if (host === 'deezer.com') {
    if (/^[a-z]{2}$/.test(parts[0] ?? '')) parts.shift()
    const [kind, id] = parts
    if (!['track', 'album', 'playlist'].includes(kind) || !/^\d{1,20}$/.test(id ?? '')) return null
    return {
      service: 'deezer',
      kind: kind as MusicKind,
      id,
      embedUrl: `https://widget.deezer.com/widget/auto/${kind}/${id}`,
      embedHeight: kind === 'track' ? 150 : 300,
      openUrl: `https://www.deezer.com/${kind}/${id}`,
    }
  }

  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    // /br/album/nome/123?i=456 (música de um álbum), /br/song/nome/456, /br/playlist/nome/pl.xxx
    const [country, type, ...rest] = parts
    const id = rest.at(-1) ?? ''
    if (!/^[a-z]{2}$/.test(country ?? '') || !['album', 'song', 'playlist'].includes(type) || !/^(\d+|pl\.[\w-]+)$/.test(id)) return null
    const track = u.searchParams.get('i')
    const kind: MusicKind = type === 'playlist' ? 'playlist' : type === 'song' || (track && /^\d+$/.test(track)) ? 'track' : 'album'
    const path = `/${country}/${type}/${rest.map(encodeURIComponent).join('/')}${track && /^\d+$/.test(track) ? `?i=${track}` : ''}`
    return {
      service: 'apple',
      kind,
      id: kind === 'track' && track ? track : id,
      embedUrl: `https://embed.music.apple.com${path}`,
      embedHeight: kind === 'track' ? 175 : 450,
      openUrl: `https://music.apple.com${path}`,
    }
  }
  return null
}

const q = (s: string) => encodeURIComponent(s.replace(/\s+/g, ' ').trim())
const terms = (s: SongRef) => [s.title, s.artist ? mainArtist(s.artist) : ''].filter(Boolean).join(' ')

/** Busca a música pelo nome e artista no serviço escolhido. */
export function musicSearchUrl(service: MusicService, song: SongRef): string {
  const t = q(terms(song))
  switch (service) {
    case 'spotify':
      return `https://open.spotify.com/search/${t}`
    case 'deezer':
      return `https://www.deezer.com/search/${t}`
    case 'apple':
      return `https://music.apple.com/br/search?term=${t}`
    default:
      return `https://www.youtube.com/results?search_query=${t}`
  }
}

/**
 * Onde ouvir a música no serviço da pessoa: a gravação de referência, se for desse serviço;
 * se não, a busca pelo nome e artista nele.
 */
export function listenLink(service: MusicService, song: SongRef & { referenceUrl?: string | null }) {
  const ref = parseMusicLink(song.referenceUrl)
  if (ref && ref.service === service) return { url: ref.openUrl, isReference: true }
  return { url: musicSearchUrl(service, song), isReference: false }
}
