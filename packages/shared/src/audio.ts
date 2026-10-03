// Detecção de acordes, tom e BPM a partir de áudio (protótipo).
//
// Roda no aparelho do músico (num Web Worker): o áudio nunca vai para o servidor.
// Método clássico de reconhecimento de acordes:
//  1. cromagrama: quanto de cada uma das 12 notas soa em cada instante (FFT);
//  2. comparação com o "desenho" de cada acorde maior e menor (24 + silêncio);
//  3. suavização (Viterbi): evita trocar de acorde a cada ruído;
//  4. tom pelo perfil de Krumhansl; BPM pela autocorrelação dos ataques.
// Entrada: áudio mono já reamostrado para SAMPLE_RATE.
import { MAJOR_KEYS, MINOR_KEYS, prefersFlats } from './chords'

export const SAMPLE_RATE = 11025

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export interface ChordSegment {
  start: number
  end: number
  /** "G", "Em" ou "N" (sem acorde: silêncio ou ruído). */
  chord: string
  /** 0 a 1: quão bem o som bateu com o acorde. */
  confidence: number
}

export interface AudioAnalysis {
  duration: number
  key: string | null
  bpm: number | null
  segments: ChordSegment[]
}

// ---------------------------------------------------------------- FFT

/** FFT radix-2 in-place (re/im de tamanho potência de 2). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

function hann(n: number) {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

// ---------------------------------------------------------------- cromagrama

const FRAME = 4096 // ~0,37 s: resolução de ~2,7 Hz, suficiente para notas graves
const HOP = 1024 // ~0,093 s entre análises

interface ChromaFrame {
  treble: Float64Array // 12 notas, 110 Hz – 1,8 kHz (harmonia)
  bass: Float64Array // 12 notas, 41 Hz – 220 Hz (fundamental do acorde)
  energy: number
}

function chromagram(samples: Float32Array, onProgress?: (p: number) => void): ChromaFrame[] {
  const win = hann(FRAME)
  const re = new Float64Array(FRAME)
  const im = new Float64Array(FRAME)
  const binHz = SAMPLE_RATE / FRAME
  // Para cada faixa da FFT: qual nota e com que peso (perto do centro do semitom pesa mais).
  const map: { bin: number; pc: number; w: number; bass: boolean; treble: boolean }[] = []
  for (let k = 1; k < FRAME / 2; k++) {
    const f = k * binHz
    if (f < 41 || f > 1800) continue
    const midi = 69 + 12 * Math.log2(f / 440)
    const near = Math.round(midi)
    const w = Math.max(0, 1 - 2 * Math.abs(midi - near))
    if (w <= 0) continue
    map.push({ bin: k, pc: ((near % 12) + 12) % 12, w, bass: f <= 220, treble: f >= 110 })
  }
  const frames: ChromaFrame[] = []
  const total = Math.max(0, Math.floor((samples.length - FRAME) / HOP) + 1)
  for (let t = 0; t < total; t++) {
    const off = t * HOP
    let energy = 0
    for (let i = 0; i < FRAME; i++) {
      const s = samples[off + i]
      energy += s * s
      re[i] = s * win[i]
      im[i] = 0
    }
    fft(re, im)
    const treble = new Float64Array(12)
    const bass = new Float64Array(12)
    for (const m of map) {
      // Raiz da magnitude: comprime picos e dá peso às notas mais fracas do acorde.
      const mag = Math.sqrt(Math.hypot(re[m.bin], im[m.bin]))
      if (m.treble) treble[m.pc] += mag * m.w
      if (m.bass) bass[m.pc] += mag * m.w
    }
    frames.push({ treble, bass, energy: energy / FRAME })
    if (onProgress && t % 200 === 0) onProgress((0.75 * t) / total)
  }
  return frames
}

function normalize(v: Float64Array) {
  let s = 0
  for (const x of v) s += x * x
  const n = Math.sqrt(s) || 1
  return v.map((x) => x / n)
}

// ---------------------------------------------------------------- acordes

/** 24 acordes: 0–11 maiores (C..B), 12–23 menores; 24 = sem acorde. */
const N_STATE = 24
const TEMPLATES: Float64Array[] = []
for (let q = 0; q < 2; q++) {
  for (let root = 0; root < 12; root++) {
    const t = new Float64Array(12)
    t[root] = 1
    t[(root + (q === 0 ? 4 : 3)) % 12] = 1
    t[(root + 7) % 12] = 1
    TEMPLATES.push(normalize(t))
  }
}

function chordName(state: number, useFlats: boolean) {
  if (state === N_STATE) return 'N'
  const names = useFlats ? FLATS : SHARPS
  return names[state % 12] + (state >= 12 ? 'm' : '')
}

/** Escolhe a sequência de acordes mais provável, com custo para trocar de acorde. */
function viterbi(emissions: Float64Array[], switchCost: number): number[] {
  const S = N_STATE + 1
  const T = emissions.length
  if (!T) return []
  const score = new Float64Array(S)
  const back: Uint8Array[] = []
  emissions[0].forEach((e, s) => (score[s] = e))
  for (let t = 1; t < T; t++) {
    let bestPrev = 0
    for (let s = 1; s < S; s++) if (score[s] > score[bestPrev]) bestPrev = s
    const next = new Float64Array(S)
    const bp = new Uint8Array(S)
    for (let s = 0; s < S; s++) {
      const stay = score[s]
      const change = score[bestPrev] - switchCost
      if (stay >= change) {
        next[s] = stay + emissions[t][s]
        bp[s] = s
      } else {
        next[s] = change + emissions[t][s]
        bp[s] = bestPrev
      }
    }
    back.push(bp)
    score.set(next)
  }
  let s = 0
  for (let i = 1; i < S; i++) if (score[i] > score[s]) s = i
  const path = new Array<number>(T)
  path[T - 1] = s
  for (let t = T - 1; t > 0; t--) {
    s = back[t - 1][s]
    path[t - 1] = s
  }
  return path
}

// ---------------------------------------------------------------- tom

// Perfis de Krumhansl–Kessler (peso de cada grau num tom maior / menor).
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlation(a: number[], b: number[]) {
  const ma = a.reduce((x, y) => x + y, 0) / a.length
  const mb = b.reduce((x, y) => x + y, 0) / b.length
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / (Math.sqrt(da * db) || 1)
}

export function estimateKey(chroma: number[]): string | null {
  if (chroma.every((x) => x === 0)) return null
  let best = { r: -Infinity, key: null as string | null }
  for (let root = 0; root < 12; root++) {
    const rotated = chroma.map((_, i) => chroma[(i + root) % 12])
    const rMaj = correlation(rotated, MAJOR_PROFILE)
    const rMin = correlation(rotated, MINOR_PROFILE)
    if (rMaj > best.r) best = { r: rMaj, key: MAJOR_KEYS[root] }
    if (rMin > best.r) best = { r: rMin, key: MINOR_KEYS[root] }
  }
  return best.key
}

// ---------------------------------------------------------------- BPM

const ONSET_FRAME = 512
const ONSET_HOP = 128 // ~11,6 ms: precisão suficiente para o andamento

export function estimateBpm(samples: Float32Array): number | null {
  const win = hann(ONSET_FRAME)
  const re = new Float64Array(ONSET_FRAME)
  const im = new Float64Array(ONSET_FRAME)
  let prev: Float64Array | null = null
  const flux: number[] = []
  for (let off = 0; off + ONSET_FRAME <= samples.length; off += ONSET_HOP) {
    for (let i = 0; i < ONSET_FRAME; i++) {
      re[i] = samples[off + i] * win[i]
      im[i] = 0
    }
    fft(re, im)
    const mag = new Float64Array(ONSET_FRAME / 2)
    for (let k = 0; k < mag.length; k++) mag[k] = Math.log1p(10 * Math.hypot(re[k], im[k]))
    let f = 0
    if (prev) for (let k = 0; k < mag.length; k++) f += Math.max(0, mag[k] - prev[k])
    flux.push(f)
    prev = mag
  }
  if (flux.length < 200) return null
  // Tira a média móvel: sobra só o "ataque" das notas e batidas.
  const env = flux.map((v, i) => {
    let s = 0
    let n = 0
    for (let j = Math.max(0, i - 20); j <= Math.min(flux.length - 1, i + 20); j++) {
      s += flux[j]
      n++
    }
    return Math.max(0, v - s / n)
  })
  const hopSec = ONSET_HOP / SAMPLE_RATE
  let best = { score: -Infinity, bpm: 0 }
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = 60 / bpm / hopSec
    const l0 = Math.floor(lag)
    const frac = lag - l0
    let acc = 0
    for (let i = 0; i + l0 + 1 < env.length; i++) acc += env[i] * (env[i + l0] * (1 - frac) + env[i + l0 + 1] * frac)
    // Preferência suave por andamentos comuns (evita escolher o dobro ou a metade).
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.8) ** 2)
    const score = acc * prior
    if (score > best.score) best = { score, bpm }
  }
  return best.bpm ? Math.round(best.bpm) : null
}

// ---------------------------------------------------------------- análise completa

export function analyzeAudio(samples: Float32Array, onProgress?: (p: number) => void): AudioAnalysis {
  const duration = samples.length / SAMPLE_RATE
  const frames = chromagram(samples, onProgress)
  if (!frames.length) return { duration, key: null, bpm: null, segments: [] }

  // Silêncio: abaixo de 2% da energia típica da música.
  const energies = frames.map((f) => f.energy).sort((a, b) => a - b)
  const typical = energies[Math.floor(energies.length * 0.75)] || 0
  const silent = (f: ChromaFrame) => f.energy < typical * 0.02

  const keyChroma = new Array(12).fill(0)
  const emissions = frames.map((f) => {
    const e = new Float64Array(N_STATE + 1)
    if (silent(f)) {
      e[N_STATE] = 1
      return e
    }
    const t = normalize(f.treble)
    const b = normalize(f.bass)
    t.forEach((v, i) => (keyChroma[i] += v))
    for (let s = 0; s < N_STATE; s++) {
      let dot = 0
      for (let i = 0; i < 12; i++) dot += t[i] * TEMPLATES[s][i]
      // A nota mais grave costuma ser a fundamental: pequeno bônus para o acorde dela.
      e[s] = dot + 0.15 * b[s % 12]
    }
    e[N_STATE] = 0.45
    return e
  })
  onProgress?.(0.8)

  const path = viterbi(emissions, 0.9)
  const key = estimateKey(keyChroma)
  const useFlats = prefersFlats(key)
  const frameSec = HOP / SAMPLE_RATE
  const center = FRAME / 2 / SAMPLE_RATE

  // Junta quadros iguais em trechos.
  let segments: ChordSegment[] = []
  for (let t = 0; t < path.length; t++) {
    const s = path[t]
    const start = Math.max(0, t * frameSec + center - frameSec / 2)
    const last = segments[segments.length - 1]
    const conf = Math.min(1, Math.max(0, emissions[t][s]))
    if (last && last.chord === chordName(s, useFlats)) {
      last.end = start + frameSec
      last.confidence += conf
    } else {
      if (last) last.confidence /= Math.max(1, Math.round((last.end - last.start) / frameSec))
      segments.push({ start, end: start + frameSec, chord: chordName(s, useFlats), confidence: conf })
    }
  }
  const tail = segments[segments.length - 1]
  if (tail) tail.confidence /= Math.max(1, Math.round((tail.end - tail.start) / frameSec))
  // Trechos muito curtos (< 0,4 s) são ruído: somem dentro do vizinho.
  segments = segments.reduce<ChordSegment[]>((acc, seg) => {
    const prev = acc[acc.length - 1]
    if (prev && (seg.end - seg.start < 0.4 || prev.chord === seg.chord)) prev.end = seg.end
    else acc.push({ ...seg })
    return acc
  }, [])
  if (segments.length) segments[segments.length - 1].end = duration

  onProgress?.(0.9)
  const bpm = estimateBpm(samples)
  onProgress?.(1)
  return { duration, key, bpm, segments }
}

// ---------------------------------------------------------------- para o editor

/**
 * Rascunho de cifra em compassos (4/4): "| G | D | Em | C |", 4 compassos por linha.
 * Sem BPM, uma entrada por troca de acorde.
 */
export function analysisToChart(a: AudioAnalysis): string {
  const chords = a.segments.filter((s) => s.chord !== 'N')
  if (!chords.length) return ''
  const lines: string[] = ['[Acordes detectados]']
  if (a.bpm) {
    const bar = 240 / a.bpm
    const first = chords[0].start
    const bars: string[] = []
    for (let t = first; t < a.duration - bar / 4; t += bar) {
      // Todos os acordes que ocupam um bom pedaço do compasso, na ordem em que soam
      // (músicas rápidas costumam ter 2 acordes por compasso: "| G  D |").
      const inBar: string[] = []
      for (const s of chords) {
        const overlap = Math.min(s.end, t + bar) - Math.max(s.start, t)
        if (overlap >= bar * 0.2 && inBar[inBar.length - 1] !== s.chord) inBar.push(s.chord)
      }
      bars.push(inBar.length ? inBar.join('  ') : '%')
    }
    const width = Math.max(4, ...bars.map((b) => b.length))
    for (let i = 0; i < bars.length; i += 4) {
      lines.push('| ' + bars.slice(i, i + 4).map((c) => c.padEnd(width, ' ')).join(' | ') + ' |')
    }
  } else {
    for (let i = 0; i < chords.length; i += 8) lines.push(chords.slice(i, i + 8).map((s) => s.chord).join('   '))
  }
  return lines.join('\n')
}

/** Sequência mais repetida de 4 acordes (o "loop" da música), para mostrar em destaque. */
export function mainProgression(segments: ChordSegment[], size = 4): string[] | null {
  const seq = segments.filter((s) => s.chord !== 'N' && s.end - s.start >= 0.6).map((s) => s.chord)
  if (seq.length < size) return seq.length ? seq : null
  const counts = new Map<string, number>()
  for (let i = 0; i + size <= seq.length; i++) {
    const k = seq.slice(i, i + size).join(' ')
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return best && best[1] > 1 ? best[0].split(' ') : null
}
