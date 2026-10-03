import { describe, expect, it } from 'vitest'
import { parseSheet } from './chords'
import { chordInfo, chordsInSheet, guitarVoicings, keyboardNotes, noteNamePt, splitChordLine } from './dictionary'

const notes = (s: string) => chordInfo(s)?.notes.join(' ')
const shape = (frets: number[]) => frets.map((f) => (f < 0 ? 'x' : String(f))).join('')

describe('notas de cada acorde', () => {
  it.each([
    ['C', 'C E G'],
    ['Am', 'A C E'],
    ['G7', 'G B D F'],
    ['C7M', 'C E G B'],
    ['Dm7', 'D F A C'],
    ['F#m7(b5)', 'F# A C E'],
    ['Bø', 'B D F A'],
    ['C°', 'C D# F# A'],
    ['Caug', 'C E G#'],
    ['Csus4', 'C F G'],
    ['D4', 'D G A'],
    ['Asus2', 'A B E'],
    ['C9', 'C E G D'], // no Brasil, C9 = dó com nona (sem sétima)
    ['G7(9)', 'G B D F A'],
    ['A7(13)', 'A C# E G F#'],
    ['E7(b9)', 'E G# B D F'],
    ['C6', 'C E G A'],
    ['C6/9', 'C E G A D'],
    ['E5', 'E B'],
  ])('%s → %s', (sym, expected) => expect(notes(sym)).toBe(expected))

  it('acorde com baixo invertido', () => {
    const i = chordInfo('D/F#')!
    expect(i.notes.join(' ')).toBe('D F# A')
    expect(i.bassNote).toBe('F#')
  })

  it('nomes em português', () => {
    expect(chordInfo('Am7')!.quality).toBe('menor, com sétima')
    expect(chordInfo('C7M')!.quality).toBe('com sétima maior')
    expect(chordInfo('G')!.quality).toBe('maior')
    expect(noteNamePt('F#')).toBe('Fá sustenido')
    expect(noteNamePt('Bb')).toBe('Si bemol')
  })

  it('acorde inválido', () => expect(chordInfo('Xyz')).toBeNull())
})

describe('posições no violão', () => {
  // As formas que todo violonista aprende primeiro precisam aparecer em primeiro lugar.
  it.each([
    ['C', 'x32010'],
    ['Am', 'x02210'],
    ['E', '022100'],
    ['Em', '022000'],
    ['D', 'xx0232'],
    ['A', 'x02220'],
    ['Dm', 'xx0231'],
    ['A7', 'x02020'],
    ['E7', '020100'],
    ['Bm', 'x24432'],
    ['B', 'x24442'],
    ['C#m', 'x46654'],
    ['Eb', 'xx1343'],
  ])('%s → %s', (sym, expected) => expect(shape(guitarVoicings(sym)[0].frets)).toBe(expected))

  it('G aparece numa das formas abertas', () => {
    expect(['320003', '320033', '320000']).toContain(shape(guitarVoicings('G')[0].frets))
  })

  it('F e Bm: forma sem pestana fácil ou a pestana clássica entre as primeiras', () => {
    const f = guitarVoicings('F').map((v) => shape(v.frets))
    expect(f.slice(0, 3).some((s) => s === '133211' || s === 'xx3211')).toBe(true)
    const bm = guitarVoicings('Bm').map((v) => shape(v.frets))
    expect(bm.slice(0, 3)).toContain('x24432')
  })

  it('pestana é marcada', () => {
    const v = guitarVoicings('Bm').find((x) => shape(x.frets) === 'x24432')!
    expect(v.barre).toEqual({ fret: 2, from: 1, to: 5 })
  })

  it('baixo invertido fica na corda mais grave', () => {
    const v = guitarVoicings('D/F#')[0]
    const first = v.frets.findIndex((f) => f >= 0)
    expect((([40, 45, 50, 55, 59, 64][first] + v.frets[first]) % 12)).toBe(6) // F#
  })

  it('acordes com tensões também têm posição', () => {
    for (const sym of ['G7(9)', 'F#m7(b5)', 'C7M', 'A7(13)', 'Bb', 'C#m', 'Eb7M']) {
      expect(guitarVoicings(sym).length, sym).toBeGreaterThan(0)
    }
  })

  it('nenhuma posição pede mais de 4 dedos ou abertura maior que 4 casas', () => {
    for (const sym of ['C', 'F', 'Bm', 'G7(9)', 'Ab', 'F#m7(b5)']) {
      for (const v of guitarVoicings(sym)) {
        const fretted = v.frets.filter((f) => f > 0)
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('teclado', () => {
  it('C a partir do Dó central; D/F# com o baixo embaixo', () => {
    expect(keyboardNotes('C')).toEqual([60, 64, 67])
    expect(keyboardNotes('D/F#')).toEqual([54, 62, 66, 69])
  })
})

describe('acordes da cifra', () => {
  it('divide a linha sem mudar as colunas', () => {
    const parts = splitChordLine('  C   (G7)  Am/C x2')
    expect(parts.map((p) => p.text).join('')).toBe('  C   (G7)  Am/C x2')
    expect(parts.filter((p) => p.chord).map((p) => p.chord)).toEqual(['C', 'G7', 'Am/C'])
  })

  it('lista os acordes da música sem repetir', () => {
    const lines = parseSheet('[Intro] C G\n\nC     G\nLetra aqui\nAm  F  C\n', 2, 'D')
    expect(chordsInSheet(lines)).toEqual(['D', 'A', 'Bm', 'G'])
  })
})
