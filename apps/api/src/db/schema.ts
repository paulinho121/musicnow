import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// ---------------------------------------------------------------------------
// Autenticação (tabelas no formato esperado pelo Better Auth)

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: text().notNull().default('user'),
  banned: boolean().notNull().default(false),
  ...timestamps,
})

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Perfil musical

export const musicianRole = pgEnum('musician_role', ['musico', 'artista', 'lider', 'regente'])
export const instrument = pgEnum('instrument', [
  'voz', 'violao', 'guitarra', 'teclado', 'baixo', 'bateria', 'percussao', 'sopro', 'cordas',
])

export const profile = pgTable('profile', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: musicianRole(),
  city: text(),
  bio: text(),
  /** Preferências do visualizador (fonte, espaçamento, rolagem...). */
  viewerPrefs: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
})

export const userInstrument = pgTable(
  'user_instrument',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    instrument: instrument().notNull(),
    primary: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.instrument] })],
)

// ---------------------------------------------------------------------------
// Músicas

export const visibility = pgEnum('visibility', ['private', 'shared', 'public'])
/** Origem dos direitos: só músicas com licença conhecida podem ser públicas. */
export const songLicense = pgEnum('song_license', ['unknown', 'own', 'public_domain', 'licensed'])
export const reportReason = pgEnum('report_reason', ['copyright', 'wrong_content', 'offensive', 'other'])
export const reportStatus = pgEnum('report_status', ['open', 'resolved', 'dismissed'])

export const song = pgTable(
  'song',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    artist: text(),
    composer: text(),
    originalKey: text(),
    bpm: integer(),
    timeSignature: text(),
    style: text(),
    notes: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    /** Cifra em texto: acordes sobre a letra, seções entre colchetes. */
    content: text().notNull().default(''),
    /** Gravação de referência (link do YouTube), tocada no player oficial do YouTube. */
    referenceUrl: text(),
    /**
     * Capa do álbum (link do Cover Art Archive). null = ainda não procurada;
     * '' = a pessoa preferiu a capa gerada pelo app (não procurar de novo).
     */
    coverUrl: text(),
    /** Quando a capa foi procurada pela última vez (para não repetir a busca toda hora). */
    coverCheckedAt: timestamp({ withTimezone: true }),
    /** Letra liberada para exibição (direitos autorais). */
    lyricsAuthorized: boolean().notNull().default(false),
    visibility: visibility().notNull().default('private'),
    license: songLicense().notNull().default('unknown'),
    /** Formato de origem quando a música veio de importação (chordpro, onsong, opensong, text). */
    importedFrom: text(),
    /** Texto normalizado (sem acento, minúsculo) usado na busca. */
    searchText: text().notNull().default(''),
    ...timestamps,
  },
  (t) => [
    index().on(t.ownerId),
    index().on(t.visibility),
    index('song_search_trgm').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
)

/** Denúncias de músicas públicas (direitos autorais, conteúdo errado...). */
export const songReport = pgTable(
  'song_report',
  {
    id: uuid().primaryKey().defaultRandom(),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    reporterId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: reportReason().notNull(),
    details: text(),
    status: reportStatus().notNull().default('open'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.songId), index().on(t.status), uniqueIndex().on(t.songId, t.reporterId)],
)

/**
 * Partitura de uma música (uma "parte": grade, piano, sax alto em Mi♭...).
 * O PDF/foto original NUNCA chega ao servidor: o aparelho converte cada página numa
 * imagem WebP leve e limpa, e só ela é guardada em disco (UPLOAD_DIR/scores/<id>/<n>.webp).
 * O banco guarda só os dados.
 */
export const songScore = pgTable(
  'song_score',
  {
    id: uuid().primaryKey().defaultRandom(),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    uploadedBy: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Nome da parte ("Sax alto em Mi♭", "Grade", "Piano"). */
    label: text().notNull(),
    /** Instrumento do perfil que abre esta parte automaticamente. */
    instrument: instrument(),
    /** Largura e altura de cada página (para o leitor já reservar o espaço certo). */
    pages: jsonb().$type<{ w: number; h: number; bytes: number }[]>().notNull(),
    totalBytes: integer().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.songId), index().on(t.uploadedBy)],
)

/** Partituras e PDFs anexados a uma música (reservado; as partituras usam song_score). */
export const songFile = pgTable(
  'song_file',
  {
    id: uuid().primaryKey().defaultRandom(),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    uploadedBy: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    storagePath: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.songId)],
)

export const markType = pgEnum('mark_type', [
  'intro', 'verso', 'pre_refrao', 'refrao', 'ponte', 'solo', 'interludio', 'final',
  'repeticao', 'entrada', 'saida', 'dinamica', 'parada', 'vocal', 'nota',
])

/**
 * Marcações e anotações presas a uma linha da cifra. Privadas (só o autor vê)
 * ou compartilhadas; opcionalmente valem só dentro de um repertório.
 */
export const songMark = pgTable(
  'song_mark',
  {
    id: uuid().primaryKey().defaultRandom(),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    setlistId: uuid().references(() => setlist.id, { onDelete: 'cascade' }),
    authorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    lineIndex: integer().notNull(),
    type: markType().notNull(),
    text: text(),
    instrument: instrument(),
    shared: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index().on(t.songId), index().on(t.setlistId)],
)

export const favorite = pgTable(
  'favorite',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] })],
)

/** Tom pessoal e último acesso de cada usuário a uma música (histórico). */
export const songUserState = pgTable(
  'song_user_state',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    personalKey: text(),
    lastViewedAt: timestamp({ withTimezone: true }),
    viewCount: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] }), index().on(t.userId, t.lastViewedAt)],
)

// ---------------------------------------------------------------------------
// Repertórios

export const setlistStatus = pgEnum('setlist_status', ['rascunho', 'ensaio', 'pronto', 'concluido'])
export const permission = pgEnum('permission', ['view', 'mark', 'suggest', 'admin'])

export const setlist = pgTable(
  'setlist',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Repertório de origem quando este é uma versão/duplicata. */
    parentId: uuid(),
    name: text().notNull(),
    eventDate: timestamp({ withTimezone: true }),
    location: text(),
    groupName: text(),
    notes: text(),
    status: setlistStatus().notNull().default('rascunho'),
    archived: boolean().notNull().default(false),
    /** Incrementa a cada alteração: os clientes usam para saber se estão atualizados. */
    revision: integer().notNull().default(1),
    ...timestamps,
  },
  (t) => [index().on(t.ownerId), index().on(t.eventDate)],
)

/**
 * Bloco do repertório (barzinho, baile): "Bloco 2 · Marília · 130 BPM".
 * Opcional: repertório sem blocos continua uma lista simples.
 */
export const setlistBlock = pgTable(
  'setlist_block',
  {
    id: uuid().primaryKey().defaultRandom(),
    setlistId: uuid()
      .notNull()
      .references(() => setlist.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    name: text().notNull(),
    /** Estilo, ritmo ou artista de referência do bloco ("Sertanejo", "Xote", "Marília"). */
    style: text(),
    bpm: integer(),
    notes: text(),
  },
  (t) => [index().on(t.setlistId, t.position)],
)

export const setlistItem = pgTable(
  'setlist_item',
  {
    id: uuid().primaryKey().defaultRandom(),
    setlistId: uuid()
      .notNull()
      .references(() => setlist.id, { onDelete: 'cascade' }),
    songId: uuid()
      .notNull()
      // 'no action' (verificado no fim do comando): apagar uma conta leva junto os repertórios
      // e as músicas dela sem travar; apagar só a música continua bloqueado se ela estiver em uso.
      .references(() => song.id, { onDelete: 'no action' }),
    /** Bloco da música (null = sem bloco). Apagar o bloco não tira as músicas do repertório. */
    blockId: uuid().references(() => setlistBlock.id, { onDelete: 'set null' }),
    position: integer().notNull(),
    key: text(),
    bpm: integer(),
    notes: text(),
  },
  (t) => [index().on(t.setlistId, t.position)],
)

export const setlistMember = pgTable(
  'setlist_member',
  {
    setlistId: uuid()
      .notNull()
      .references(() => setlist.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: permission().notNull().default('view'),
    /** Instrumento com que a pessoa participa deste repertório. */
    instrument: instrument(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.setlistId, t.userId] }), index().on(t.userId)],
)

export const invite = pgTable(
  'invite',
  {
    id: uuid().primaryKey().defaultRandom(),
    setlistId: uuid()
      .notNull()
      .references(() => setlist.id, { onDelete: 'cascade' }),
    code: text().notNull(),
    email: text(),
    permission: permission().notNull().default('view'),
    createdBy: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    maxUses: integer(),
    uses: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.code), index().on(t.setlistId)],
)

export const suggestionStatus = pgEnum('suggestion_status', ['open', 'accepted', 'rejected'])

/** Sugestões de músicos com permissão "sugerir": o líder aceita (aplica) ou recusa. */
export const setlistSuggestion = pgTable(
  'setlist_suggestion',
  {
    id: uuid().primaryKey().defaultRandom(),
    setlistId: uuid()
      .notNull()
      .references(() => setlist.id, { onDelete: 'cascade' }),
    itemId: uuid().references(() => setlistItem.id, { onDelete: 'cascade' }),
    authorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    proposedKey: text(),
    message: text(),
    status: suggestionStatus().notNull().default('open'),
    resolvedBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.setlistId, t.status)],
)

/** Histórico de alterações (músicas e repertórios). */
export const changeLog = pgTable(
  'change_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    action: text().notNull(),
    diff: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entityType, t.entityId, t.createdAt)],
)

/** Registro de visitas / telemetria de tráfego interno. */
export const pageVisit = pgTable(
  'page_visit',
  {
    id: uuid().primaryKey().defaultRandom(),
    path: text().notNull(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    ip: text(),
    userAgent: text(),
    referrer: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt), index().on(t.path), index().on(t.userId)],
)

// ---------------------------------------------------------------------------
// Relações (para consultas com `with`)

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profile, { fields: [user.id], references: [profile.userId] }),
  instruments: many(userInstrument),
  songs: many(song),
}))

export const userInstrumentRelations = relations(userInstrument, ({ one }) => ({
  user: one(user, { fields: [userInstrument.userId], references: [user.id] }),
}))

export const songRelations = relations(song, ({ one, many }) => ({
  owner: one(user, { fields: [song.ownerId], references: [user.id] }),
  files: many(songFile),
  marks: many(songMark),
}))

export const songFileRelations = relations(songFile, ({ one }) => ({
  song: one(song, { fields: [songFile.songId], references: [song.id] }),
}))

export const songMarkRelations = relations(songMark, ({ one }) => ({
  song: one(song, { fields: [songMark.songId], references: [song.id] }),
}))

export const setlistRelations = relations(setlist, ({ one, many }) => ({
  owner: one(user, { fields: [setlist.ownerId], references: [user.id] }),
  items: many(setlistItem),
  members: many(setlistMember),
}))

export const setlistItemRelations = relations(setlistItem, ({ one }) => ({
  setlist: one(setlist, { fields: [setlistItem.setlistId], references: [setlist.id] }),
  song: one(song, { fields: [setlistItem.songId], references: [song.id] }),
}))

export const setlistMemberRelations = relations(setlistMember, ({ one }) => ({
  setlist: one(setlist, { fields: [setlistMember.setlistId], references: [setlist.id] }),
  user: one(user, { fields: [setlistMember.userId], references: [user.id] }),
}))
