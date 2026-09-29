import { describe, expect, it } from 'vitest'
import {
  guessKey,
  isChord,
  isChordLine,
  normalizeOffset,
  parseSheet,
  semitonesBetween,
  stripLyrics,
  transposeChord,
  transposeChordLine,
  transposeKey,
  transposeSheet,
} from './chords'

describe('isChord', () => {
  it.each(['C', 'Am', 'F#m7', 'Bb', 'C7M', 'G7(9)', 'Bm7(b5)', 'D/F#', 'Dsus4', 'E°', 'A4', 'C9', 'Cadd9', 'G/B', 'Ebmaj7', 'A7(13-)', 'F#m7(11)', 'Cº'])(
    'reconhece %s',
    (c) => expect(isChord(c)).toBe(true),
  )
  it.each(['Amor', 'Deus', 'Em cima', 'H', 'c', 'Cantar', 'Dó', 'Bom'])('rejeita %s', (c) =>
    expect(isChord(c)).toBe(false),
  )
})

describe('transposeChord', () => {
  it('sobe um tom inteiro', () => {
    expect(transposeChord('C', 2)).toBe('D')
    expect(transposeChord('Am7', 2)).toBe('Bm7')
  })
  it('transpõe o baixo junto', () => {
    expect(transposeChord('D/F#', 2)).toBe('E/G#')
    expect(transposeChord('C/E', -1, true)).toBe('B/Eb')
  })
  it('preserva extensões brasileiras', () => {
    expect(transposeChord('G7(9)', 5)).toBe('C7(9)')
    expect(transposeChord('Bm7(b5)', 1)).toBe('Cm7(b5)')
    expect(transposeChord('C7M', 3, true)).toBe('Eb7M')
  })
  it('dá a volta na oitava', () => {
    expect(transposeChord('B', 1)).toBe('C')
    expect(transposeChord('C', -1)).toBe('B')
  })
})

describe('tons', () => {
  it('usa grafia convencional', () => {
    expect(transposeKey('C', 3)).toBe('Eb')
    expect(transposeKey('G', 3)).toBe('Bb')
    expect(transposeKey('Am', 1)).toBe('Bbm')
    expect(transposeKey('Em', 2)).toBe('F#m')
  })
  it('calcula a distância entre tons', () => {
    expect(semitonesBetween('G', 'A')).toBe(2)
    expect(semitonesBetween('A', 'G')).toBe(10)
    expect(normalizeOffset(10)).toBe(-2)
  })
  it('adivinha o tom pelo primeiro acorde', () => {
    expect(guessKey('[Intro] Em  C  G  D\n\nletra')).toBe('Em')
    expect(guessKey('   G        D\nQuando eu cantar')).toBe('G')
  })
})

describe('linhas', () => {
  it('distingue linha de acordes de letra', () => {
    expect(isChordLine('G      D/F#     Em   C')).toBe(true)
    expect(isChordLine('| C  G | Am  F | (x2)')).toBe(true)
    expect(isChordLine('E a vida segue assim')).toBe(false)
    expect(isChordLine('A')).toBe(true)
  })
  it('mantém a coluna de cada acorde', () => {
    const line = 'G      D      Em     C'
    expect(transposeChordLine(line, 2, false)).toBe('A      E      F#m    D')
  })
  it('empurra só o necessário quando o acorde cresce', () => {
    expect(transposeChordLine('E F', 1, false)).toBe('F F#')
    expect(transposeChordLine('A B C', 1, false)).toBe('A# C C#')
  })
})

describe('cifra inteira', () => {
  const sheet = `[Intro] G  D  Em  C

[Verso 1]
G              D
Quando a manhã chegar
Em             C
Vou cantar de novo

[Refrão]
C     G/B    Am   D
Tudo em paz, tudo bem`

  it('classifica as linhas', () => {
    const lines = parseSheet(sheet)
    expect(lines[0]).toMatchObject({ kind: 'section', type: 'intro', chords: 'G  D  Em  C' })
    expect(lines[2]).toMatchObject({ kind: 'section', type: 'verso' })
    expect(lines[3].kind).toBe('chords')
    expect(lines[4]).toEqual({ kind: 'lyrics', text: 'Quando a manhã chegar' })
    expect(lines[8]).toMatchObject({ kind: 'section', type: 'refrao' })
  })

  it('transpõe acordes sem tocar na letra', () => {
    const out = transposeSheet(sheet, 2, 'A')
    // A coluna de cada acorde é preservada; F#m cresceu, então o D encosta nele.
    expect(out).toContain('[Intro] A  E  F#m D')
    expect(out).toContain('Quando a manhã chegar')
    expect(out).toContain('D     A/C#   Bm   E')
  })

  it('usa bemóis em tons bemolizados', () => {
    const out = transposeSheet(sheet, 3, 'Bb')
    expect(out).toContain('[Intro] Bb F  Gm  Eb')
  })
})

describe('stripLyrics', () => {
  it('tira a letra e mantém acordes, seções e número de linhas', () => {
    const src = '[Refrão]\nC     G\nLetra protegida\n\nAm   F\nOutra linha'
    const out = stripLyrics(src)
    expect(out).toBe('[Refrão]\nC     G\n\n\nAm   F\n')
    expect(out.split('\n')).toHaveLength(src.split('\n').length)
    expect(out).not.toContain('Letra')
  })
})
