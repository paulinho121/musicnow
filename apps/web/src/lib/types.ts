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
  /** Prova social: repertórios de outras pessoas em que a música entrou, e quantas pessoas. */
  usageSetlists: number
  usagePeople: number
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
  /** Recebida pelo link de compartilhamento (pode sair dela). */
  sharedWithMe?: boolean
  usageSetlists: number
  usagePeople: number
  createdAt: string
  updatedAt: string
}

/** Teste grátis / assinatura da pessoa. */
export interface BillingSummary {
  /** A cobrança está valendo (sem isso, tudo liberado). */
  enforced: boolean
  /** O pagamento (Asaas) já foi configurado no servidor. */
  configured: boolean
  active: boolean
  reason: 'admin' | 'free' | 'subscription' | 'trial' | 'expired'
  trialDaysLeft: number
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  plan: 'monthly' | 'yearly' | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  /** Escolheu um plano e a cobrança está esperando o pagamento. */
  pending: boolean
}

export interface BillingPayment {
  id: string
  value: number
  status: string
  dueDate: string
  paymentDate: string | null
  billingType: string
  invoiceUrl: string
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
  isAdmin?: boolean
  billing?: BillingSummary
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
    /** Gravação de referência (YouTube), se cadastrada. */
    referenceUrl: string | null
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

export interface AdminOverview {
  billing: {
    monthly: number
    yearly: number
    paying: number
    pastDue: number
    trialing: number
    canceling: number
    expired: number
    /** Receita mensal recorrente estimada (R$). */
    mrr: number
    enforced: boolean
  }
  users: {
    total: number
    newToday: number
    new7d: number
    new30d: number
    admins: number
  }
  songs: {
    total: number
    public: number
    private: number
    shared: number
  }
  setlists: {
    total: number
    active: number
  }
  scores: {
    totalParts: number
    totalBytes: number
  }
  reports: {
    open: number
    total: number
  }
  visits: {
    today: number
    last7d: number
    last30d: number
  }
  activeUsers: {
    dau: number
    mau: number
  }
  online: {
    count: number
    users: {
      userId: string
      name: string
      email: string
      image?: string | null
      path: string
      userAgent?: string | null
      lastSeen: number
    }[]
  }
}

export interface AdminTraffic {
  daily: {
    date: string
    visits: number
    uniqueIps: number
    registeredUsers: number
  }[]
  topPages: {
    path: string
    count: number
  }[]
  devices: {
    name: string
    count: number
  }[]
  browsers: {
    name: string
    count: number
  }[]
}

export interface AdminUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  banned: boolean
  createdAt: string
  city: string | null
  musicianRole: string | null
  songCount: number
  setlistCount: number
  lastSession: string | null
  isOnline?: boolean
  currentPath?: string | null
}

export interface AdminUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  totalPages: number
}

export interface AdminReport {
  id: string
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: string
  songId: string
  songTitle: string
  songArtist: string | null
  songVisibility: string
  reporterId: string
  reporterName: string
  reporterEmail: string
}
