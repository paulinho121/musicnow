import { describe, expect, it } from 'vitest'
import {
  centsOff,
  decimate,
  decimationFor,
  detectPitch,
  freqOf,
  midiOf,
  nearestString,
  noteFromFreq,
  TUNER_INSTRUMENTS,
  tuningRange,
} from './tuning'

const SR = 48000

/** Som de corda sintético: fundamental + harmônicos (como um violão de verdade), com um pouco de ruído. */
function pluck(freq: number, n = 4096, harmonics = [1, 0.6, 0.4, 0.25], noise = 0.01) {
  const buf = new Float32Array(n)
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < n; i++) {
    let v = 0
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)))
    buf[i] = 0.3 * v + noise * rand()
  }
  return buf
}

describe('notas', () => {
  it('converte nomes e frequências', () => {
    expect(midiOf('A4')).toBe(69)
    expect(midiOf('E2')).toBe(40)
    expect(midiOf('Eb2')).toBe(midiOf('D#2'))
    expect(freqOf('A4')).toBe(440)
    expect(freqOf('E2')).toBeCloseTo(82.41, 1)
    expect(freqOf('A4', 442)).toBe(442)
  })

  it('acha a nota mais próxima e os cents', () => {
    expect(noteFromFreq(440)).toMatchObject({ name: 'A', octave: 4, namePt: 'Lá', cents: 0 })
    const sharp = noteFromFreq(freqOf('E2') * 2 ** (10 / 1200))
    expect(sharp).toMatchObject({ name: 'E', octave: 2 })
    expect(sharp.cents).toBeCloseTo(10, 0)
    expect(centsOff(445, 440)).toBeCloseTo(19.56, 1)
  })
})

describe('detecção da nota', () => {
  it('silêncio e ruído não viram nota', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull()
    expect(detectPitch(pluck(100, 4096, [], 0.3), SR)).toBeNull()
  })

  it.each([
    ['E2 (violão, 6ª corda)', 'E2'],
    ['A2', 'A2'],
    ['E4 (1ª corda)', 'E4'],
    ['E1 (baixo)', 'E1'],
    ['B0 (baixo 5 cordas)', 'B0'],
    ['D5 (cavaquinho)', 'D5'],
    ['E5 (violino)', 'E5'],
  ])('%s com precisão de 2 cents', (_, note) => {
    const f = freqOf(note)
    const r = detectPitch(pluck(f, 8192), SR, { minFreq: 25 })
    expect(r).not.toBeNull()
    expect(Math.abs(centsOff(r!.freq, f))).toBeLessThan(2)
  })

  it('não confunde a oitava quando o harmônico é mais forte que a fundamental', () => {
    const f = freqOf('A2')
    const r = detectPitch(pluck(f, 4096, [0.5, 1, 0.5, 0.3]), SR, tuningRange(TUNER_INSTRUMENTS[0].tunings[0]))
    expect(Math.abs(centsOff(r!.freq, f))).toBeLessThan(3)
  })
})

describe('instrumentos', () => {
  it('todas as afinações têm notas válidas', () => {
    for (const i of TUNER_INSTRUMENTS) for (const t of i.tunings) for (const s of t.strings) expect(() => midiOf(s)).not.toThrow()
    expect(new Set(TUNER_INSTRUMENTS.map((i) => i.slug)).size).toBe(TUNER_INSTRUMENTS.length)
  })

  it('acha a corda mais próxima', () => {
    const guitar = TUNER_INSTRUMENTS[0].tunings[0]
    expect(nearestString(freqOf('G3') * 1.01, guitar)).toMatchObject({ index: 3 })
    expect(nearestString(84, guitar)!.index).toBe(0)
    expect(nearestString(84, guitar)!.cents).toBeGreaterThan(0)
  })
})

describe('leve no celular (taxa reduzida)', () => {
  it.each(TUNER_INSTRUMENTS.flatMap((i) => i.tunings.filter((t) => t.strings.length).map((t) => [`${i.name} · ${t.label}`, t] as const)))(
    '%s: todas as cordas com precisão de 3 cents',
    (_, t) => {
      const range = tuningRange(t)
      const factor = decimationFor(SR, range.maxFreq)
      for (const s of t.strings) {
        const f = freqOf(s)
        const r = detectPitch(decimate(pluck(f, 8192), factor), SR / factor, range)
        expect(r, s).not.toBeNull()
        expect(Math.abs(centsOff(r!.freq, f)), s).toBeLessThan(3)
      }
    },
  )
})
