// Afinador: detecção da nota tocada (método de McLeod, NSDF) e afinações dos instrumentos.
// Funções puras (sem áudio do navegador) para poderem ser testadas com sons sintéticos.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const NOTE_PT: Record<string, string> = {
  C: 'Dó',
  'C#': 'Dó#',
  D: 'Ré',
  'D#': 'Ré#',
  E: 'Mi',
  F: 'Fá',
  'F#': 'Fá#',
  G: 'Sol',
  'G#': 'Sol#',
  A: 'Lá',
  'A#': 'Lá#',
  B: 'Si',
}
const FLAT_TO_SHARP: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }

/** "E2" → número MIDI (40). Aceita bemóis: "Eb2". */
export function midiOf(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note)
  if (!m) throw new Error(`Nota inválida: ${note}`)
  const name = FLAT_TO_SHARP[m[1] + m[2]] ?? m[1] + m[2]
  return NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number]) + (Number(m[3]) + 1) * 12
}

export const freqOfMidi = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12)
export const freqOf = (note: string, a4 = 440) => freqOfMidi(midiOf(note), a4)

/** Nota mais próxima de uma frequência e quantos cents está fora (−50 a +50). */
export function noteFromFreq(freq: number, a4 = 440) {
  const exact = 69 + 12 * Math.log2(freq / a4)
  const midi = Math.round(exact)
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  return { midi, name, octave: Math.floor(midi / 12) - 1, namePt: NOTE_PT[name], cents: Math.round((exact - midi) * 1000) / 10 }
}

/** Cents entre a frequência e uma nota alvo (positivo = agudo demais). */
export const centsOff = (freq: number, target: number) => 1200 * Math.log2(freq / target)

/**
 * Frequência fundamental de um trecho de áudio (método de McLeod, NSDF).
 * Devolve null quando há silêncio ou o som não tem altura definida (ruído).
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  opts: { minFreq?: number; maxFreq?: number; minRms?: number; minClarity?: number } = {},
): { freq: number; clarity: number } | null {
  const { minFreq = 30, maxFreq = 1500, minRms = 0.008, minClarity = 0.8 } = opts
  let rms = 0
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / buf.length)
  if (rms < minRms) return null

  const maxLag = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2))
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq))
  const window = buf.length - maxLag
  const nsdf = new Float32Array(maxLag + 1)
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0
    let m = 0
    for (let i = 0; i < window; i++) {
      const a = buf[i]
      const b = buf[i + tau]
      acf += a * b
      m += a * a + b * b
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0
  }

  // Picos depois de cada cruzamento por zero; fica com o primeiro perto do maior (evita oitavas).
  const peaks: number[] = []
  let tau = minLag
  while (tau < maxLag && nsdf[tau] > 0) tau++
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++
    let best = tau
    while (tau < maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > nsdf[best]) best = tau
      tau++
    }
    if (best < maxLag && nsdf[best] > 0) peaks.push(best)
  }
  if (!peaks.length) return null
  const highest = Math.max(...peaks.map((p) => nsdf[p]))
  if (highest < minClarity) return null
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * highest)!

  // Interpolação parabólica para precisão abaixo de uma amostra.
  const y0 = nsdf[chosen - 1] ?? nsdf[chosen]
  const y1 = nsdf[chosen]
  const y2 = nsdf[chosen + 1] ?? nsdf[chosen]
  const denom = y0 - 2 * y1 + y2
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0
  const freq = sampleRate / (chosen + shift)
  if (freq < minFreq || freq > maxFreq) return null
  return { freq, clarity: y1 }
}

/**
 * Reduz a taxa de amostragem (média de cada grupo de amostras): a detecção fica até 16× mais
 * leve no celular. Use um fator que mantenha bastante folga acima da nota mais aguda.
 */
export function decimate(buf: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return buf
  const out = new Float32Array(Math.floor(buf.length / factor))
  for (let i = 0; i < out.length; i++) {
    let sum = 0
    for (let j = 0; j < factor; j++) sum += buf[i * factor + j]
    out[i] = sum / factor
  }
  return out
}

/** Fator de redução para uma faixa: até 4×, com a taxa final ≥ 16× a nota mais aguda. */
export const decimationFor = (sampleRate: number, maxFreq: number) => Math.max(1, Math.min(4, Math.floor(sampleRate / (maxFreq * 16))))

// ---------------------------------------------------------------- instrumentos

export interface Tuning {
  id: string
  label: string
  /** Da corda mais grave para a mais aguda. */
  strings: string[]
}

export interface TunerInstrument {
  id: string
  /** Para o endereço da página pública (/afinador-online/violao). */
  slug: string
  name: string
  tunings: Tuning[]
}

export const TUNER_INSTRUMENTS: TunerInstrument[] = [
  {
    id: 'guitar',
    slug: 'violao',
    name: 'Violão e guitarra',
    tunings: [
      { id: 'standard', label: 'Padrão (E A D G B E)', strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      { id: 'half-down', label: 'Meio tom abaixo (Eb)', strings: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
      { id: 'drop-d', label: 'Drop D (D A D G B E)', strings: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      { id: 'whole-down', label: 'Um tom abaixo (D G C F A D)', strings: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
    ],
  },
  {
    id: 'bass4',
    slug: 'baixo',
    name: 'Baixo 4 cordas',
    tunings: [
      { id: 'standard', label: 'Padrão (E A D G)', strings: ['E1', 'A1', 'D2', 'G2'] },
      { id: 'half-down', label: 'Meio tom abaixo (Eb)', strings: ['Eb1', 'Ab1', 'Db2', 'Gb2'] },
      { id: 'drop-d', label: 'Drop D (D A D G)', strings: ['D1', 'A1', 'D2', 'G2'] },
    ],
  },
  {
    id: 'bass5',
    slug: 'baixo-5-cordas',
    name: 'Baixo 5 cordas',
    tunings: [{ id: 'standard', label: 'Padrão (B E A D G)', strings: ['B0', 'E1', 'A1', 'D2', 'G2'] }],
  },
  {
    id: 'cavaquinho',
    slug: 'cavaquinho',
    name: 'Cavaquinho',
    tunings: [
      { id: 'standard', label: 'Padrão (D G B D)', strings: ['D4', 'G4', 'B4', 'D5'] },
      { id: 'portuguese', label: 'Natural (D G B E)', strings: ['D4', 'G4', 'B4', 'E5'] },
    ],
  },
  {
    id: 'ukulele',
    slug: 'ukulele',
    name: 'Ukulele',
    tunings: [
      { id: 'standard', label: 'Padrão (G C E A)', strings: ['G4', 'C4', 'E4', 'A4'] },
      { id: 'low-g', label: 'Sol grave (G C E A)', strings: ['G3', 'C4', 'E4', 'A4'] },
    ],
  },
  {
    id: 'viola',
    slug: 'viola-caipira',
    name: 'Viola caipira',
    tunings: [
      { id: 'cebolao-d', label: 'Cebolão em Ré (A D F# A D)', strings: ['A2', 'D3', 'F#3', 'A3', 'D4'] },
      { id: 'cebolao-e', label: 'Cebolão em Mi (B E G# B E)', strings: ['B2', 'E3', 'G#3', 'B3', 'E4'] },
      { id: 'rio-abaixo', label: 'Rio Abaixo (G D G B D)', strings: ['G2', 'D3', 'G3', 'B3', 'D4'] },
    ],
  },
  {
    id: 'violin',
    slug: 'violino',
    name: 'Violino',
    tunings: [{ id: 'standard', label: 'Padrão (G D A E)', strings: ['G3', 'D4', 'A4', 'E5'] }],
  },
  {
    id: 'mandolin',
    slug: 'bandolim',
    name: 'Bandolim',
    tunings: [{ id: 'standard', label: 'Padrão (G D A E)', strings: ['G3', 'D4', 'A4', 'E5'] }],
  },
  {
    id: 'chromatic',
    slug: 'cromatico',
    name: 'Cromático (qualquer nota)',
    tunings: [{ id: 'chromatic', label: 'Todas as notas', strings: [] }],
  },
]

/** Faixa de frequência para procurar (mais estreita = mais rápido e sem erros de oitava). */
export function tuningRange(t: Tuning) {
  if (!t.strings.length) return { minFreq: 28, maxFreq: 1400 }
  const fs = t.strings.map((s) => freqOf(s))
  return { minFreq: Math.min(...fs) * 0.7, maxFreq: Math.max(...fs) * 2.2 }
}

/** Corda mais próxima da frequência tocada (em cents). */
export function nearestString(freq: number, t: Tuning, a4 = 440) {
  let best = -1
  let bestCents = Infinity
  t.strings.forEach((s, i) => {
    const c = centsOff(freq, freqOf(s, a4))
    if (Math.abs(c) < Math.abs(bestCents)) {
      best = i
      bestCents = c
    }
  })
  return best < 0 ? null : { index: best, cents: bestCents }
}
