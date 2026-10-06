// Páginas públicas do dicionário de acordes (para o Google): uma por acorde, com endereço
// legível em português. Ex.: C#m → /acordes/c-sustenido-menor, Bb7M → /acordes/b-bemol-7-maior.
import { chordInfo } from './dictionary'

export const CHORD_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export interface ChordType {
  suffix: string
  /** Parte do endereço. */
  slug: string
  /** Rótulo curto (botões). */
  label: string
}

export const CHORD_TYPES: ChordType[] = [
  { suffix: '', slug: 'maior', label: 'Maior' },
  { suffix: 'm', slug: 'menor', label: 'Menor' },
  { suffix: '7', slug: '7', label: '7' },
  { suffix: 'm7', slug: 'm7', label: 'm7' },
  { suffix: '7M', slug: '7-maior', label: '7M' },
  { suffix: 'm7M', slug: 'm7-maior', label: 'm7M' },
  { suffix: '6', slug: '6', label: '6' },
  { suffix: 'm6', slug: 'm6', label: 'm6' },
  { suffix: '9', slug: '9', label: '9' },
  { suffix: 'm9', slug: 'm9', label: 'm9' },
  { suffix: '7(9)', slug: '7-9', label: '7(9)' },
  { suffix: '4', slug: 'sus4', label: '4 (sus)' },
  { suffix: '7(4)', slug: '7-sus4', label: '7(4)' },
  { suffix: 'sus2', slug: 'sus2', label: 'sus2' },
  { suffix: '°', slug: 'diminuto', label: '° (dim)' },
  { suffix: 'm7(b5)', slug: 'meio-diminuto', label: 'ø · m7(b5)' },
  { suffix: '+', slug: 'aumentado', label: '+ (aum)' },
  { suffix: '5', slug: '5', label: '5 (power)' },
]

const rootSlug = (root: string) => root[0].toLowerCase() + (root[1] === '#' ? '-sustenido' : root[1] === 'b' ? '-bemol' : '')

/** "C#m" → "c-sustenido-menor"; acordes fora da lista (C/E, A7(13)...) → null. */
export function chordSlug(symbol: string): string | null {
  const root = CHORD_ROOTS.find((r) => symbol.startsWith(r) && !(r.length === 1 && /^[#b]/.test(symbol.slice(1))))
  if (!root) return null
  const type = CHORD_TYPES.find((t) => t.suffix === symbol.slice(root.length))
  return type ? `${rootSlug(root)}-${type.slug}` : null
}

/** "c-sustenido-menor" → "C#m". */
export function chordFromSlug(slug: string): string | null {
  for (const root of CHORD_ROOTS) {
    const prefix = `${rootSlug(root)}-`
    if (!slug.startsWith(prefix)) continue
    const type = CHORD_TYPES.find((t) => t.slug === slug.slice(prefix.length))
    if (type) return root + type.suffix
  }
  return null
}

/** Todos os acordes com página própria (12 notas × tipos que o dicionário sabe montar). */
export function allChordPages(): { symbol: string; slug: string }[] {
  return CHORD_ROOTS.flatMap((root) =>
    CHORD_TYPES.filter((t) => chordInfo(root + t.suffix)).map((t) => ({ symbol: root + t.suffix, slug: chordSlug(root + t.suffix)! })),
  )
}
