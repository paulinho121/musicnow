// Dicionário de acordes: quais notas formam um acorde (notação brasileira de cifra)
// e como montá-lo no violão/guitarra. As posições são CALCULADAS, então funciona
// para qualquer acorde — não só os de uma tabela.
import { isChord, isChordLine, parseChord, type SheetLine } from './chords'

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const NOTE_PC: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}

export const PT_NOTE: Record<string, string> = {
  C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si',
}

/** "F#" → "Fá sustenido", "Bb" → "Si bemol". */
export function noteNamePt(note: string) {
  const base = PT_NOTE[note[0]] ?? note
  return note[1] === '#' ? `${base} sustenido` : note[1] === 'b' ? `${base} bemol` : base
}

export interface ChordInfo {
  symbol: string
  root: number
  bass: number | null
  /** Intervalos em semitons a partir da fundamental (0 = fundamental). */
  intervals: number[]
  /** Notas que precisam soar (sem elas o acorde muda); as demais podem ser omitidas. */
  required: number[]
  /** Nome do tipo, em português ("menor com sétima"). */
  quality: string
  /** Notas na grafia do acorde (sustenidos ou bemóis conforme a fundamental). */
  notes: string[]
  bassNote: string | null
}

/**
 * Interpreta o sufixo do acorde no padrão das cifras brasileiras:
 * m, 7, 7M (maj7), 6, 9 (= com nona, sem sétima), 7(9), 4 (= sus4), sus2,
 * °/dim, ø ou m7(b5), +/aug, 5 (power chord), 11, 13, b9, #9, #11, b13, add9.
 */
export function chordInfo(symbol: string): ChordInfo | null {
  const c = parseChord(symbol.trim())
  if (!c) return null
  const root = NOTE_PC[c.root]
  const bass = c.bass ? NOTE_PC[c.bass] : null
  let s = c.suffix.replace(/º/g, '°').replace(/\s+/g, '')
  const set = new Set<number>([0])
  const required = new Set<number>([0])
  const names: string[] = []

  // Power chord: só fundamental e quinta.
  if (s === '5') {
    set.add(7)
    required.add(7)
    return build(symbol, root, bass, set, required, 'quinta (power chord)', c.root)
  }

  let third: number | null = 4
  let fifth: number | null = 7
  let fifthAltered = false

  const minor = /^m(?!aj)/.test(s)
  if (minor) {
    third = 3
    s = s.slice(1)
    names.push('menor')
  }
  if (/^(°|dim)/.test(s)) {
    third = 3
    fifth = 6
    fifthAltered = true
    s = s.replace(/^(°|dim)/, '')
    if (/^7/.test(s)) {
      set.add(9)
      required.add(9)
      s = s.slice(1)
      names.push('diminuto com sétima')
    } else {
      // No Brasil, "C°" costuma ser o diminuto de 4 notas.
      set.add(9)
      required.add(9)
      names.push('diminuto')
    }
  } else if (/^ø/.test(s)) {
    third = 3
    fifth = 6
    fifthAltered = true
    set.add(10)
    required.add(10)
    s = s.slice(1)
    names.push('meio-diminuto')
  } else if (/^(\+|aug)/.test(s)) {
    fifth = 8
    fifthAltered = true
    s = s.replace(/^(\+|aug)/, '')
    names.push('aumentado')
  }

  // Sétimas e sexta.
  if (/^(7M|maj7|7\+|M7)/.test(s)) {
    set.add(11)
    required.add(11)
    s = s.replace(/^(7M|maj7|7\+|M7)/, '')
    names.push('com sétima maior')
  } else if (/^7/.test(s)) {
    set.add(10)
    required.add(10)
    s = s.slice(1)
    names.push('com sétima')
  } else if (/^6/.test(s)) {
    set.add(9)
    required.add(9)
    s = s.slice(1)
    if (/^\/?9/.test(s)) {
      set.add(14)
      required.add(14)
      s = s.replace(/^\/?9/, '')
      names.push('com sexta e nona')
    } else names.push('com sexta')
  }

  // Suspensões: no Brasil, "C4" é o mesmo que Csus4.
  // (sus2 antes de sus: senão o "sus" de "sus2" seria lido como sus4)
  if (/^(sus2|2)/.test(s)) {
    third = 2
    s = s.replace(/^(sus2|2)/, '')
    names.push('com segunda (suspenso)')
  } else if (/^(sus4|sus|4)/.test(s)) {
    third = 5
    s = s.replace(/^(sus4|sus|4)/, '')
    names.push('com quarta (suspenso)')
  }

  // Tensões: 9, 11, 13 e alterações, com ou sem parênteses ("7(9)", "7/9", "9", "add9").
  const tensions = s.replace(/[()]/g, ',').replace(/add/g, ',').split(/[,/]/).filter(Boolean)
  for (const t of tensions) {
    const m = /^([#b+-]?)(5|9|11|13)([#b+-]?)$/.exec(t)
    if (!m) continue
    const acc = m[1] || m[3]
    const sharp = acc === '#' || acc === '+'
    const flat = acc === 'b' || acc === '-'
    const deg = m[2]
    if (deg === '5') {
      fifth = sharp ? 8 : flat ? 6 : 7
      fifthAltered = sharp || flat
      names.push(sharp ? 'quinta aumentada' : flat ? 'quinta diminuta' : '')
      continue
    }
    const base = deg === '9' ? 14 : deg === '11' ? 17 : 21
    const iv = base + (sharp ? 1 : flat ? -1 : 0)
    set.add(iv)
    required.add(iv)
    names.push(`${flat ? deg + ' bemol' : sharp ? deg + ' aumentada' : deg === '9' ? 'nona' : deg === '11' ? 'décima primeira' : 'décima terceira'}`.replace(/^(\d+)/, 'com $1'))
  }

  if (third !== null) {
    set.add(third)
    required.add(third)
  }
  if (fifth !== null) {
    set.add(fifth)
    if (fifthAltered) required.add(fifth)
  }

  const quality = names.filter(Boolean).join(', ') || (minor ? 'menor' : 'maior')
  return build(symbol, root, bass, set, required, quality, c.root)
}

function build(symbol: string, root: number, bass: number | null, set: Set<number>, required: Set<number>, quality: string, rootName: string): ChordInfo {
  const intervals = [...set].sort((a, b) => a - b)
  const flats = rootName.includes('b') || rootName === 'F'
  const names = flats ? FLATS : SHARPS
  return {
    symbol,
    root,
    bass,
    intervals,
    required: [...required].sort((a, b) => a - b),
    quality: quality === 'menor' ? 'menor' : quality,
    notes: intervals.map((iv) => names[(root + iv) % 12]),
    bassNote: bass !== null ? names[bass] : null,
  }
}

// ---------------------------------------------------------------- violão / guitarra

/** Afinação padrão (MIDI), da 6ª corda (Mi grave) para a 1ª (Mi agudo). */
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]

export interface Voicing {
  /** Casa de cada corda, da 6ª para a 1ª: -1 = não tocar, 0 = solta. */
  frets: number[]
  /** Primeira casa mostrada no desenho (1 = começo do braço). */
  baseFret: number
  /** Pestana: casa e cordas cobertas (índices 0–5). */
  barre: { fret: number; from: number; to: number } | null
}

/**
 * Calcula posições tocáveis para um acorde: até 4 dedos (ou pestana + 3),
 * no máximo 4 casas de abertura, com a nota do baixo (ou a fundamental) na
 * corda mais grave que soa. Ordena das mais fáceis para as mais difíceis.
 */
export function guitarVoicings(symbol: string, max = 6, tuning = GUITAR_TUNING): Voicing[] {
  const info = chordInfo(symbol)
  if (!info) return []
  const pcs = new Set(info.intervals.map((iv) => (info.root + iv) % 12))
  const required = new Set(info.required.map((iv) => (info.root + iv) % 12))
  const bassPc = info.bass ?? info.root
  if (info.bass !== null) pcs.add(info.bass)

  const found = new Map<string, { v: Voicing; score: number }>()
  const strings = tuning.length

  for (let start = 0; start <= 12; start++) {
    // Opções por corda nesta região do braço.
    const options: number[][] = tuning.map((open) => {
      const opts = [-1]
      if (start <= 3 && pcs.has(open % 12)) opts.push(0)
      for (let f = Math.max(1, start); f <= start + 3; f++) if (pcs.has((open + f) % 12)) opts.push(f)
      return opts
    })
    const frets = new Array<number>(strings).fill(-1)
    const walk = (i: number) => {
      if (i === strings) {
        const v = evaluate(frets, tuning, required, bassPc)
        if (v) {
          const key = v.v.frets.join(',')
          const prev = found.get(key)
          if (!prev || v.score < prev.score) found.set(key, v)
        }
        return
      }
      for (const f of options[i]) {
        frets[i] = f
        walk(i + 1)
      }
    }
    walk(0)
  }
  return [...found.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map((x) => x.v)
}

function evaluate(frets: number[], tuning: number[], required: Set<number>, bassPc: number): { v: Voicing; score: number } | null {
  const sounding = frets.map((f, i) => (f < 0 ? -1 : i)).filter((i) => i >= 0)
  if (sounding.length < 4) return null
  // Cordas abafadas só do lado grave (como em x32010 ou xx0232): nada abafado no meio.
  const first = sounding[0]
  for (let i = first; i < frets.length; i++) if (frets[i] < 0) return null
  // O baixo (nota mais grave) precisa ser a fundamental ou a nota indicada após a barra.
  if ((tuning[first] + frets[first]) % 12 !== bassPc) return null
  const present = new Set(sounding.map((i) => (tuning[i] + frets[i]) % 12))
  for (const r of required) if (!present.has(r)) return null

  const fretted = sounding.filter((i) => frets[i] > 0)
  const minF = fretted.length ? Math.min(...fretted.map((i) => frets[i])) : 0
  const maxF = fretted.length ? Math.max(...fretted.map((i) => frets[i])) : 0
  if (maxF - minF > 3) return null

  // Dedos: sem pestana, um por nota presa; com pestana, o indicador cobre a menor casa
  // da corda dela até a 1ª (e nenhuma corda nesse trecho pode estar solta).
  let fingers = fretted.length
  let barre: Voicing['barre'] = null
  if (fingers > 4) {
    const from = fretted.find((i) => frets[i] === minF)!
    if (frets.slice(from).some((f) => f === 0)) return null
    const atMin = fretted.filter((i) => frets[i] === minF && i >= from).length
    fingers = 1 + fretted.length - atMin
    if (fingers > 4) return null
    barre = { fret: minF, from, to: frets.length - 1 }
  }

  const opens = sounding.filter((i) => frets[i] === 0).length
  const muted = frets.length - sounding.length
  const score =
    fingers * 2 +
    (barre ? 2 : 0) +
    minF * 0.8 +
    (maxF - minF) * 1.1 -
    opens * 0.7 +
    // Corda solta é ótima perto da pestana do braço; junto com casas altas vira esticada estranha.
    (opens > 0 && maxF >= 4 ? 4 + opens * 1.5 : 0) +
    muted * 0.9 -
    sounding.length * 0.3
  const baseFret = maxF <= 4 ? 1 : minF
  return { v: { frets: [...frets], baseFret, barre }, score }
}

// ---------------------------------------------------------------- teclado

/** Notas MIDI para tocar o acorde no teclado, a partir do Dó central (ou do baixo, se houver). */
export function keyboardNotes(symbol: string): number[] {
  const info = chordInfo(symbol)
  if (!info) return []
  const base = 60 + info.root
  const notes = info.intervals.map((iv) => base + iv)
  if (info.bass !== null) {
    let b = 48 + info.bass
    if (b >= base) b -= 12
    notes.unshift(b)
  }
  return notes
}

// ---------------------------------------------------------------- acordes da cifra

export type ChordLinePart = { text: string; chord: string | null }

/**
 * Divide uma linha de acordes em pedaços, mantendo os espaços (as colunas não mudam):
 * "  C   (G7)" → ["  ", "C", "   (", "G7", ")"]. `chord` é o acorde do pedaço, se houver.
 */
export function splitChordLine(line: string): ChordLinePart[] {
  const parts: ChordLinePart[] = []
  const push = (text: string, chord: string | null = null) => {
    if (!text) return
    const last = parts[parts.length - 1]
    if (!chord && last && !last.chord) last.text += text
    else parts.push({ text, chord })
  }
  let pos = 0
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    push(line.slice(pos, m.index))
    const token = m[0]
    const lead = token.startsWith('(') ? '(' : ''
    const trail = token.endsWith(')') && !isChord(token) ? ')' : ''
    const core = token.slice(lead.length, token.length - trail.length)
    if (isChord(core)) {
      push(lead)
      push(core, core)
      push(trail)
    } else push(token)
    pos = m.index + token.length
  }
  push(line.slice(pos))
  return parts
}

/** Acordes usados na cifra (já no tom mostrado), na ordem em que aparecem, sem repetir. */
export function chordsInSheet(lines: SheetLine[]): string[] {
  const seen = new Set<string>()
  for (const l of lines) {
    const text = l.kind === 'chords' ? l.text : l.kind === 'section' && l.chords && isChordLine(l.chords) ? l.chords : ''
    for (const p of splitChordLine(text)) if (p.chord) seen.add(p.chord)
  }
  return [...seen]
}
