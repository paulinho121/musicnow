import type { ImportFormat, Instrument, License, MusicianRole, SetlistStatus, Visibility } from '@ensaio/shared'

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
}

export interface ImportSongInput extends SongInput {
  importedFrom: ImportFormat | null
}

export interface ImportResult {
  created: { id: string; title: string }[]
  skipped: { title: string; reason: string }[]
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
  }[]
  counts: { mySongs: number; library: number }
}
