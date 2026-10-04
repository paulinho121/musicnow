import type { ImportFormat, Instrument, License, MusicianRole, Permission, SetlistRole, SetlistStatus, Visibility } from '@ensaio/shared'

export interface SongListItem {
  id: string
  title: string
  artist: string | null
  originalKey: string | null
  bpm: number | null
  style: string | null
  tags: string[]
  visibility: Visibility
  ownerId: string
  ownerName: string
  isFavorite: boolean
  updatedAt: string
  /** Capa do álbum (Cover Art Archive); null/'' = capa gerada pelo app. */
  coverUrl: string | null
}

export type MarkType =
  | 'intro' | 'verso' | 'pre_refrao' | 'refrao' | 'ponte' | 'solo' | 'interludio' | 'final'
  | 'repeticao' | 'entrada' | 'saida' | 'dinamica' | 'parada' | 'vocal' | 'nota'

export interface SongMark {
  id: string
  songId: string
  authorId: string
  lineIndex: number
  type: MarkType
  text: string | null
  instrument: Instrument | null
  shared: boolean
  setlistId: string | null
  authorName: string
}

export interface SongInput {
  title: string
  artist: string | null
  composer: string | null
  originalKey: string | null
  bpm: number | null
  timeSignature: string | null
  style: string | null
  notes: string | null
  tags: string[]
  content: string
  lyricsAuthorized: boolean
  visibility: Visibility
  license: License
  referenceUrl: string | null
  /** Capa: link do Cover Art Archive, '' = capa gerada, null = o app procura sozinho. */
  coverUrl?: string | null
}

export interface ImportSongInput extends SongInput {
  importedFrom: ImportFormat | null
}

export interface ImportResult {
  created: { id: string; title: string }[]
  skipped: { title: string; reason: string }[]
}

/** Uma parte da partitura (grade, piano, sax alto...): páginas WebP servidas pela API. */
export interface ScorePart {
  id: string
  label: string
  instrument: Instrument | null
  pages: { w: number; h: number; bytes: number }[]
  totalBytes: number
}

export interface SongDetail extends SongInput {
  id: string
  ownerId: string
  ownerName: string
  isFavorite: boolean
  canEdit: boolean
  personalKey: string | null
  /** A letra foi removida pelo servidor (sem autorização de exibição). */
  lyricsHidden: boolean
  importedFrom: ImportFormat | null
  marks: SongMark[]
  /** Papel no repertório quando a música é aberta dentro de um. */
  setlistRole: SetlistRole | null
  canShareMarks: boolean
  /** Partituras anexadas (vazio = só cifra). */
  scores: ScorePart[]
  createdAt: string
  updatedAt: string
}

export interface Me {
  id: string
  name: string
  email: string
  image: string | null
  role: MusicianRole | null
  city: string | null
  bio: string | null
  viewerPrefs: Record<string, unknown>
  instruments: { instrument: Instrument; primary: boolean }[]
  onboarded: boolean
}

export interface Dashboard {
  recent: (SongListItem & { lastViewedAt: string })[]
  favorites: SongListItem[]
  upcoming: {
    id: string
    name: string
    eventDate: string | null
    location: string | null
    status: SetlistStatus
    isOwner: boolean
    songCount: number
    /** As primeiras músicas (para o mosaico de capas). */
    songs: { title: string; artist: string | null; coverUrl: string | null }[]
  }[]
  counts: { mySongs: number; library: number }
}

export interface SetlistSummary {
  id: string
  name: string
  eventDate: string | null
  location: string | null
  groupName: string | null
  status: SetlistStatus
  archived: boolean
  updatedAt: string
  ownerId: string
  ownerName: string
  role: SetlistRole
  itemCount: number
  memberCount: number
}

/** Bloco do repertório (barzinho, baile): "Bloco 2 · Marília · 130 BPM". */
export interface SetlistBlock {
  id: string
  name: string
  style: string | null
  bpm: number | null
  notes: string | null
}

export interface SetlistItem {
  id: string
  /** Bloco da música (null = sem bloco). */
  blockId: string | null
  position: number
  key: string | null
  bpm: number | null
  notes: string | null
  personalKey: string | null
  song: {
    id: string
    title: string
    artist: string | null
    originalKey: string | null
    bpm: number | null
    timeSignature: string | null
    coverUrl: string | null
    /** false = música só com nome e tom (ainda sem cifra). */
    hasContent: boolean
  }
}

export interface SetlistMember {
  userId: string
  name: string
  image: string | null
  permission: SetlistRole
  instrument: Instrument | null
  joinedAt: string
}

export interface SetlistInvite {
  id: string
  code: string
  url: string
  email: string | null
  permission: Permission
  uses: number
  maxUses: number | null
  expiresAt: string | null
}

export interface SetlistSuggestion {
  id: string
  itemId: string | null
  proposedKey: string | null
  message: string | null
  status: 'open' | 'accepted' | 'rejected'
  createdAt: string
  authorId: string
  authorName: string
}

export interface SetlistDetail {
  id: string
  ownerId: string
  ownerName: string
  parentId: string | null
  parent: { id: string; name: string } | null
  name: string
  eventDate: string | null
  location: string | null
  groupName: string | null
  notes: string | null
  status: SetlistStatus
  archived: boolean
  revision: number
  role: SetlistRole
  blocks: SetlistBlock[]
  items: SetlistItem[]
  members: SetlistMember[]
  suggestions: SetlistSuggestion[]
  invites: SetlistInvite[]
  createdAt: string
  updatedAt: string
}

export interface SetlistInput {
  name: string
  eventDate: string | null
  location: string | null
  groupName: string | null
  notes: string | null
  status: SetlistStatus
}

export interface InvitePreview {
  setlistId: string
  name: string
  eventDate: string | null
  location: string | null
  groupName: string | null
  ownerName: string
  permission: Permission
  songCount: number
  alreadyMember: boolean
}

export interface HistoryEntry {
  id: string
  action: string
  diff: Record<string, unknown> | null
  createdAt: string
  userName: string | null
}

export interface CatalogResult {
  id: string
  title: string
  artist: string | null
  year: number | null
  album: string | null
}

export interface CatalogDetails {
  title: string
  artist: string | null
  composer: string | null
  year: number | null
  source: string
}
