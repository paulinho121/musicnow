import { describe, expect, it } from 'vitest'
import { analysisToChart, analyzeAudio, estimateKey, mainProgression, SAMPLE_RATE } from './audio'

// Notas MIDI dos acordes (voz média) e do baixo.
const CHORDS: Record<string, { notes: number[]; bass: number }> = {
  G: { notes: [55, 59, 62, 67], bass: 43 },
  D: { notes: [50, 54, 57, 62], bass: 38 },
  Em: { notes: [52, 55, 59, 64], bass: 40 },
  C: { notes: [48, 52, 55, 60], bass: 36 },
  Am: { notes: [57, 60, 64, 69], bass: 45 },
  F: { notes: [53, 57, 60, 65], bass: 41 },
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Simula uma banda: acordes com harmônicos (como violão/teclado), baixo e batida em cada tempo. */
function synth(progression: string[], secondsPerChord: number, bpm: number, repeats = 2) {
  const total = progression.length * secondsPerChord * repeats
  const out = new Float32Array(Math.round(total * SAMPLE_RATE))
  let seed = 42
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const chord = CHORDS[progression[Math.floor(t / secondsPerChord) % progression.length]]
    const inChord = t % secondsPerChord
    const env = Math.min(1, inChord * 20) * Math.exp(-inChord * 0.6)
    let s = 0
    for (const n of chord.notes) {
      const f = hz(n)
      // Fundamental + 2º e 3º harmônicos, como um instrumento real.
      s += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t)
    }
    s *= 0.08 * env
    s += 0.25 * Math.sin(2 * Math.PI * hz(chord.bass) * t) * env
    // Batida: estalo curto de ruído em cada tempo.
    const beat = (t * bpm) / 60
    const sinceBeat = (beat - Math.floor(beat)) * (60 / bpm)
    if (sinceBeat < 0.03) s += 0.6 * noise() * (1 - sinceBeat / 0.03)
    out[i] = s
  }
  return out
}

describe('detecção de acordes', () => {
  it('reconhece G – D – Em – C a 120 BPM, no tom de G', () => {
    const audio = synth(['G', 'D', 'Em', 'C'], 2, 120)
    const a = analyzeAudio(audio)
    const seq = a.segments.filter((s) => s.chord !== 'N').map((s) => s.chord)
    expect(seq).toEqual(['G', 'D', 'Em', 'C', 'G', 'D', 'Em', 'C'])
    expect(a.key).toBe('G')
    expect(a.bpm).toBeGreaterThanOrEqual(118)
    expect(a.bpm).toBeLessThanOrEqual(122)
    // As trocas caem perto dos tempos reais (a cada 2 s).
    const changes = a.segments.slice(1).map((s) => s.start)
    changes.forEach((t, i) => expect(Math.abs(t - 2 * (i + 1))).toBeLessThan(0.35))
  })

  it('reconhece acordes menores e outra progressão (Am – F – C – G)', () => {
    const a = analyzeAudio(synth(['Am', 'F', 'C', 'G'], 2.5, 96))
    expect(a.segments.map((s) => s.chord).slice(0, 4)).toEqual(['Am', 'F', 'C', 'G'])
    expect(['C', 'Am']).toContain(a.key)
  })

  it('silêncio não vira acorde', () => {
    const a = analyzeAudio(new Float32Array(SAMPLE_RATE * 3))
    expect(a.segments.every((s) => s.chord === 'N')).toBe(true)
  })
})

describe('para o editor', () => {
  it('monta um rascunho em compassos e acha o "loop" da música', () => {
    const a = analyzeAudio(synth(['G', 'D', 'Em', 'C'], 2, 120))
    const chart = analysisToChart(a)
    expect(chart.split('\n')[0]).toBe('[Acordes detectados]')
    expect(chart).toMatch(/\| G +\| D +\| Em +\| C +\|/)
    expect(mainProgression(a.segments)).toEqual(['G', 'D', 'Em', 'C'])
  })

  it('dois acordes por compasso não se perdem (80 BPM, 1,5 s por acorde)', () => {
    const a = analyzeAudio(synth(['G', 'D', 'Em', 'C'], 1.5, 80, 3))
    expect(a.bpm).toBeGreaterThanOrEqual(78)
    expect(a.bpm).toBeLessThanOrEqual(82)
    const chart = analysisToChart(a)
    expect(chart).toMatch(/\| G  D +\| Em  C +\|/)
    expect(chart).not.toMatch(/\| D +\| C +\|/)
  })
})

describe('tom', () => {
  it('perfil de Dó maior', () => {
    expect(estimateKey([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1])).toBe('C')
  })
})
