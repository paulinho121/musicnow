// Transposição de cifras no formato "acordes sobre a letra" (o padrão das cifras brasileiras).
//
// Uma linha é tratada como linha de acordes quando quase todos os seus tokens são acordes.
// Ao transpor, cada acorde mantém a coluna original sempre que possível, para não
// desalinhar da sílaba da letra logo abaixo.

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}

/** Tons em que a grafia com bemóis é a convencional. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'])

/** Os 12 tons maiores, na grafia usada no seletor de tom. */
export const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
export const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'] as const

// Raiz + sufixo (qualidade/extensões) + baixo opcional. O sufixo aceita a notação
// brasileira: 7M, 7(9), m7(b5), 4, 9, °, º, ø, +, sus4, add9, dim, aug...
const CHORD_RE =
  /^([A-G])([#b]?)((?:maj|min|dim|aug|sus|add|m|M|[0-9]|[#b+\-°º◦ø]|\/(?:9|11|13)(?![0-9])|\((?:[0-9#b+\-,/ ]|maj|add)*\))*)(?:\/([A-G])([#b]?))?$/

export interface ParsedChord {
  root: string
  suffix: string
  bass?: string
}

export function parseChord(token: string): ParsedChord | null {
  const m = CHORD_RE.exec(token)
  if (!m) return null
  return {
    root: m[1] + m[2],
    suffix: m[3] ?? '',
    bass: m[4] ? m[4] + (m[5] ?? '') : undefined,
  }
}

export function isChord(token: string): boolean {
  return parseChord(token) !== null
}

function mod12(n: number) {
  return ((n % 12) + 12) % 12
}

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const idx = NOTE_INDEX[note]
  if (idx === undefined) return note
  return (useFlats ? FLATS : SHARPS)[mod12(idx + semitones)]
}

/** Decide sharps/bemóis a partir do tom de destino (ex.: "Bb" → bemóis). */
export function prefersFlats(key: string | null | undefined): boolean {
  if (!key) return false
  return FLAT_KEYS.has(key) || key[1] === 'b'
}

export function transposeChord(token: string, semitones: number, useFlats = false): string {
  const c = parseChord(token)
  if (!c) return token
  const root = transposeNote(c.root, semitones, useFlats)
  const bass = c.bass ? '/' + transposeNote(c.bass, semitones, useFlats) : ''
  return root + c.suffix + bass
}

/** Transpõe um tom ("A", "F#m", "Bb"), escolhendo a grafia convencional do resultado. */
export function transposeKey(key: string, semitones: number): string {
  const c = parseChord(key)
  if (!c) return key
  const minor = c.suffix.startsWith('m') && !c.suffix.startsWith('maj')
  const list = minor ? MINOR_KEYS : MAJOR_KEYS
  const idx = NOTE_INDEX[c.root]
  if (idx === undefined) return key
  return list[mod12(idx + semitones)]
}

/** Quantos semitons separam dois tons (sempre de 0 a 11). */
export function semitonesBetween(fromKey: string, toKey: string): number {
  const a = parseChord(fromKey)
  const b = parseChord(toKey)
  if (!a || !b) return 0
  return mod12(NOTE_INDEX[b.root] - NOTE_INDEX[a.root])
}

/** Normaliza um deslocamento para -5..+6, o caminho mais curto até o tom. */
export function normalizeOffset(semitones: number): number {
  const m = mod12(semitones)
  return m > 6 ? m - 12 : m
}

// ---------------------------------------------------------------------------
// Linhas e seções

/** Marcadores aceitos como início de seção: [Refrão], [Intro], Refrão:, etc. */
export const SECTION_TYPES = {
  intro: ['intro', 'introdução', 'introducao'],
  verso: ['verso', 'estrofe', 'parte'],
  pre_refrao: ['pré-refrão', 'pre-refrão', 'pré refrão', 'pre refrao', 'pré-refrao', 'pre-refrao'],
  refrao: ['refrão', 'refrao', 'coro'],
  ponte: ['ponte'],
  solo: ['solo'],
  interludio: ['interlúdio', 'interludio'],
  final: ['final', 'finalização', 'finalizacao', 'outro'],
} as const

export type SectionType = keyof typeof SECTION_TYPES

export const SECTION_LABELS: Record<SectionType, string> = {
  intro: 'Introdução',
  verso: 'Verso',
  pre_refrao: 'Pré-refrão',
  refrao: 'Refrão',
  ponte: 'Ponte',
  solo: 'Solo',
  interludio: 'Interlúdio',
  final: 'Final',
}

const SECTION_RE = /^\s*\[([^\]]+)\]\s*(.*)$/

export function sectionTypeFromLabel(label: string): SectionType | null {
  const l = label.trim().toLowerCase().replace(/\s*\d+$/, '')
  for (const [type, names] of Object.entries(SECTION_TYPES)) {
    if ((names as readonly string[]).includes(l)) return type as SectionType
  }
  return null
}

// Tokens que podem aparecer numa linha de acordes sem serem acordes.
const NOISE_RE = /^(\||\|\||\(|\)|x\d+|\d+x|%|-+|\/+|\.+|:)$/i

export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  let chords = 0
  let other = 0
  for (const t of tokens) {
    // "(G7)" vira "G7", mas "C7(9)" já é um acorde e fica como está.
    const clean = isChord(t) ? t : t.replace(/^\(|\)$/g, '')
    if (isChord(clean)) chords++
    else if (!NOISE_RE.test(t) && !NOISE_RE.test(clean)) other++
  }
  return chords > 0 && other === 0
}

/** Transpõe apenas os acordes de uma linha, preservando o alinhamento das colunas. */
export function transposeChordLine(line: string, semitones: number, useFlats: boolean): string {
  let out = ''
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const token = m[0]
    const lead = token.startsWith('(') ? '(' : ''
    const trail = token.endsWith(')') && !isChord(token) ? ')' : ''
    const core = token.slice(lead.length, token.length - trail.length)
    const next = isChord(core) ? lead + transposeChord(core, semitones, useFlats) + trail : token
    // Mantém a coluna original; se o acorde anterior cresceu, empurra só o necessário.
    const col = Math.max(m.index, out.length === 0 ? 0 : out.length + 1)
    out = out.padEnd(col, ' ') + next
  }
  return out
}

export type SheetLine =
  | { kind: 'section'; label: string; type: SectionType | null; chords?: string }
  | { kind: 'chords'; text: string }
  | { kind: 'lyrics'; text: string }
  | { kind: 'blank' }

/** Converte o texto da cifra em linhas classificadas, já transpostas. */
export function parseSheet(content: string, semitones = 0, targetKey?: string | null): SheetLine[] {
  const useFlats = prefersFlats(targetKey)
  const shift = (l: string) => (semitones === 0 ? l : transposeChordLine(l, semitones, useFlats))
  return content.replace(/\r\n?/g, '\n').split('\n').map((raw): SheetLine => {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') return { kind: 'blank' }
    const sec = SECTION_RE.exec(line)
    if (sec) {
      const rest = sec[2]
      return {
        kind: 'section',
        label: sec[1].trim(),
        type: sectionTypeFromLabel(sec[1]),
        chords: rest && isChordLine(rest) ? shift(rest) : rest || undefined,
      }
    }
    if (isChordLine(line)) return { kind: 'chords', text: shift(line) }
    return { kind: 'lyrics', text: line }
  })
}

/** Transpõe o texto inteiro da cifra (para exportar ou salvar em outro tom). */
export function transposeSheet(content: string, semitones: number, targetKey?: string | null): string {
  const useFlats = prefersFlats(targetKey)
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const sec = SECTION_RE.exec(line)
      if (sec && sec[2] && isChordLine(sec[2])) {
        const head = line.slice(0, line.length - sec[2].length)
        return head + transposeChordLine(sec[2], semitones, useFlats)
      }
      return isChordLine(line) ? transposeChordLine(line, semitones, useFlats) : line
    })
    .join('\n')
}

/** Tenta descobrir o tom pelo primeiro acorde da cifra. */
export function guessKey(content: string): string | null {
  for (const line of parseSheet(content)) {
    const text = line.kind === 'chords' ? line.text : line.kind === 'section' ? line.chords : undefined
    if (!text) continue
    for (const t of text.split(/\s+/)) {
      const c = parseChord(t.replace(/^\(|\)$/g, ''))
      if (c) {
        const minor = c.suffix.startsWith('m') && !c.suffix.startsWith('maj')
        return transposeKey(c.root + (minor ? 'm' : ''), 0)
      }
    }
  }
  return null
}

/**
 * Remove a letra, mantendo acordes, seções e a numeração das linhas
 * (as marcações apontam para o número da linha). Usado quando a letra
 * não tem autorização para ser exibida a outras pessoas.
 */
export function stripLyrics(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      if (!line.trim()) return ''
      if (SECTION_RE.test(line) || isChordLine(line)) return line
      return ''
    })
    .join('\n')
}
