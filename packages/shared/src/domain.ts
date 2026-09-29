// Vocabulário do domínio, compartilhado entre API (validação/banco) e app (rótulos).

export const MUSICIAN_ROLES = {
  musico: 'Músico',
  artista: 'Cantor ou artista',
  lider: 'Líder de banda ou ministério',
  regente: 'Regente ou produtor',
} as const
export type MusicianRole = keyof typeof MUSICIAN_ROLES

export const INSTRUMENTS = {
  voz: 'Voz',
  violao: 'Violão',
  guitarra: 'Guitarra',
  teclado: 'Teclado',
  baixo: 'Baixo',
  bateria: 'Bateria',
  percussao: 'Percussão',
  sopro: 'Sopro',
  cordas: 'Cordas',
} as const
export type Instrument = keyof typeof INSTRUMENTS

export const VISIBILITY = {
  private: 'Privada',
  shared: 'Compartilhada',
  public: 'Pública',
} as const
export type Visibility = keyof typeof VISIBILITY

export const SETLIST_STATUS = {
  rascunho: 'Rascunho',
  ensaio: 'Ensaio',
  pronto: 'Pronto',
  concluido: 'Concluído',
} as const
export type SetlistStatus = keyof typeof SETLIST_STATUS

/** Permissões em escada: cada nível inclui tudo o que o anterior pode. */
export const PERMISSIONS = {
  view: 'Apenas visualizar',
  suggest: 'Sugerir alterações',
  mark: 'Editar marcações',
  admin: 'Administrar',
} as const
export type Permission = keyof typeof PERMISSIONS
export type SetlistRole = Permission | 'owner'

export const PERMISSION_HINTS: Record<Permission, string> = {
  view: 'Vê o repertório e faz marcações só para si.',
  suggest: 'Também pode sugerir mudanças de tom e observações.',
  mark: 'Também cria marcações que toda a banda vê.',
  admin: 'Também edita músicas, ordem e tons, e convida ou remove músicos.',
}

const ROLE_RANK: Record<SetlistRole, number> = { view: 0, suggest: 1, mark: 2, admin: 3, owner: 4 }

/** Ex.: atLeast('mark', 'suggest') é verdadeiro; atLeast('view', 'admin') é falso. */
export function atLeast(role: SetlistRole | null | undefined, min: SetlistRole): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min]
}

export const SUGGESTION_STATUS = { open: 'Aberta', accepted: 'Aceita', rejected: 'Recusada' } as const
export type SuggestionStatus = keyof typeof SUGGESTION_STATUS

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '12/8'] as const

/** Normaliza texto para busca: minúsculas e sem acentos. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const LICENSES = {
  unknown: 'Não informada',
  own: 'Composição própria',
  public_domain: 'Domínio público',
  licensed: 'Tenho licença de uso',
} as const
export type License = keyof typeof LICENSES

/** Só músicas com direitos conhecidos podem ficar públicas no catálogo. */
export const PUBLIC_LICENSES: License[] = ['own', 'public_domain', 'licensed']

export const REPORT_REASONS = {
  copyright: 'Viola direitos autorais',
  wrong_content: 'Cifra ou dados errados',
  offensive: 'Conteúdo ofensivo',
  other: 'Outro motivo',
} as const
export type ReportReason = keyof typeof REPORT_REASONS
