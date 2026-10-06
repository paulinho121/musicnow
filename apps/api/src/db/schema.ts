import { relations, sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
export const instrument = pgEnum('instrument', ['voz', 'violao', 'guitarra', 'teclado', 'baixo', 'bateria', 'percussao', 'sopro', 'cordas'])

export const profile = pgTable('profile', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: musicianRole(),
  city: text(),
  bio: text(),
  /** Preferências do visualizador (fonte, espaçamento, rolagem...). */
  viewerPrefs: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  /**
   * Imagens do destaque do início, escolhidas pela pessoa (até 5). Os arquivos ficam em
   * UPLOAD_DIR/hero/<userId>/<id>.webp; aqui só os dados.
   */
  heroImages: jsonb().$type<{ id: string; w: number; h: number }[]>().notNull().default([]),
  /** Lembretes por e-mail (show amanhã, fim do teste). Os de pagamento sempre vão. */
  emailReminders: boolean().notNull().default(true),
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
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    /** Código do link de compartilhamento (null = sem link ativo). Trocar o código invalida o link antigo. */
    shareCode: text().unique(),
    /**
     * Prova social: quantas vezes a música entrou em repertórios de OUTRAS pessoas e quantas
     * pessoas diferentes. A dona não conta. Atualizado a cada entrada (ver song_usage).
     */
    usageSetlists: integer().notNull().default(0),
    usagePeople: integer().notNull().default(0),
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
  (t) => [index().on(t.ownerId), index().on(t.visibility), index('song_search_trgm').using('gin', sql`${t.searchText} gin_trgm_ops`)],
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
 * Assinatura de cada pessoa (cobrança pelo Asaas). Quem cria conteúdo assina; quem só
 * toca repertórios dos outros nunca precisa pagar. O teste grátis começa no cadastro.
 */
export const billingAccount = pgTable('billing_account', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  /** trialing | active | past_due | canceled */
  status: text().notNull().default('trialing'),
  /** monthly | yearly (o plano assinado ou escolhido no pagamento pendente) */
  plan: text(),
  trialEndsAt: timestamp({ withTimezone: true }).notNull(),
  /** Acesso pago até esta data (renovada a cada pagamento confirmado). */
  currentPeriodEnd: timestamp({ withTimezone: true }),
  asaasCustomerId: text(),
  asaasSubscriptionId: text(),
  ...timestamps,
})

/**
 * Parceiros (músicos que divulgam o app): cada um tem um cupom (ex.: LUIZ) e o link /p/luiz.
 * Quem se cadastra com o cupom ganha mais dias de teste; o parceiro ganha uma comissão única
 * sobre o 1º pagamento de cada indicado. A conta do próprio parceiro (userId) não paga.
 */
export const partner = pgTable('partner', {
  id: uuid().primaryKey().defaultRandom(),
  /** Cupom, sempre em maiúsculas (LUIZ, LOUVOR10). */
  code: text().notNull().unique(),
  name: text().notNull(),
  /** Conta do parceiro no app (acesso grátis e painel do parceiro). */
  userId: text().references(() => user.id, { onDelete: 'set null' }),
  /** Chave Pix para receber a comissão. */
  pixKey: text(),
  /** Comissão sobre o 1º pagamento do indicado (%). */
  commissionPercent: integer().notNull().default(50),
  /** Dias de teste grátis de quem usa o cupom. */
  trialDays: integer().notNull().default(30),
  active: boolean().notNull().default(true),
  notes: text(),
  ...timestamps,
})

/**
 * Quem chegou por um parceiro e a comissão dessa indicação (uma só, no 1º pagamento).
 * status: signed (cadastrou) → converted (pagou; comissão liberada 8 dias depois, prazo do
 * direito de arrependimento) → paid (comissão paga ao parceiro); canceled = reembolso.
 */
export const partnerReferral = pgTable(
  'partner_referral',
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    partnerId: uuid()
      .notNull()
      .references(() => partner.id, { onDelete: 'cascade' }),
    status: text().notNull().default('signed'),
    plan: text(),
    paymentId: text(),
    /** Valor do 1º pagamento e da comissão, em centavos. */
    paymentCents: integer(),
    commissionCents: integer(),
    convertedAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.partnerId), index().on(t.status)],
)

/** Avisos do Asaas já processados (o Asaas pode reenviar o mesmo aviso). */
export const billingEvent = pgTable('billing_event', {
  id: text().primaryKey(),
  event: text().notNull(),
  userId: text(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

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

/**
 * Cada entrada de uma música num repertório (uma vez por repertório). Fica mesmo se o
 * repertório for apagado depois: conta quantas vezes a música "entrou no repertório de alguém".
 */
export const songUsage = pgTable(
  'song_usage',
  {
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    /** Sem chave estrangeira de propósito: o histórico continua se o repertório for apagado. */
    setlistId: uuid().notNull(),
    setlistOwnerId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.songId, t.setlistId] })],
)

/** Quem recebeu a música por link (vê e toca; só a dona edita). */
export const songShare = pgTable(
  'song_share',
  {
    songId: uuid()
      .notNull()
      .references(() => song.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.songId, t.userId] }), index().on(t.userId)],
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
  'intro',
  'verso',
  'pre_refrao',
  'refrao',
  'ponte',
  'solo',
  'interludio',
  'final',
  'repeticao',
  'entrada',
  'saida',
  'dinamica',
  'parada',
  'vocal',
  'nota',
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

/**
 * E-mails automáticos já enviados (boas-vindas, fim do teste, pagamento, show amanhã).
 * A chave (pessoa, tipo, referência) garante que o mesmo e-mail nunca sai duas vezes.
 */
export const emailLog = pgTable(
  'email_log',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    /** O que o e-mail se refere (id do pagamento, do repertório + data, fim do teste...). */
    ref: text().notNull().default(''),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.ref] })],
)

/**
 * Erros do app (telas e API), agrupados: o mesmo erro só soma no contador.
 * Aparecem no painel do administrador; não guardam IP nem dados digitados.
 */
export const appError = pgTable(
  'app_error',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** 'web' (tela do app) ou 'api' (servidor). */
    source: text().notNull(),
    /** Identifica o mesmo erro (origem + mensagem + primeira linha da pilha). */
    fingerprint: text().notNull().unique(),
    message: text().notNull(),
    stack: text(),
    /** Tela/rota onde aconteceu da última vez. */
    url: text(),
    userAgent: text(),
    /** Versão do app que estava rodando. */
    release: text(),
    count: integer().notNull().default(1),
    lastUserId: text().references(() => user.id, { onDelete: 'set null' }),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.lastSeenAt)],
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
