import { describe, expect, it } from 'vitest'
import {
  guessKey,
  isChord,
  isChordLine,
  wrapChordPair,
  moveChordInLine,
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
    expect(isChordLine('| Gm7   | C7(9)  | F7M  | Bb7M |')).toBe(true) // tensão entre parênteses no fim
    expect(isChordLine('Dm7(9)  (G7)  A7(b13)')).toBe(true)
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

describe('quebra de linha em tela pequena', () => {
  it('não quebra o que já cabe', () => {
    expect(wrapChordPair('C     G', 'Letra curta', 40)).toEqual([{ chords: 'C     G', lyrics: 'Letra curta' }])
  })

  it('corta acorde e letra no mesmo ponto, num espaço', () => {
    const chords = 'C              G              Am           F'
    const lyrics = 'Quando eu olho pro céu e vejo as estrelas a brilhar'
    const rows = wrapChordPair(chords, lyrics, 24)
    expect(rows.length).toBeGreaterThan(1)
    for (const r of rows) expect(Math.max(r.chords!.length, r.lyrics!.length)).toBeLessThanOrEqual(24)
    // Cada acorde continua sobre a mesma sílaba
    const syllableUnder = (chord: string) => {
      const r = rows.find((x) => x.chords!.includes(chord))!
      const i = r.chords!.indexOf(chord)
      return r.lyrics!.slice(i, i + 3)
    }
    expect(syllableUnder('G')).toBe(lyrics.slice(chords.indexOf('G')).slice(0, 3))
    expect(syllableUnder('Am')).toBe(lyrics.slice(chords.indexOf('Am')).slice(0, 3))
    expect(rows.map((r) => r.lyrics).join(' ').replace(/\s+/g, ' ')).toBe(lyrics)
  })

  it('linha só de acordes quebra entre os acordes', () => {
    const rows = wrapChordPair('| Dm7(9)   | Dm7(9)   | Em7(b5)  A7(b13) | Dm7(9) |', null, 20)
    for (const r of rows) {
      expect(r.lyrics).toBeNull()
      expect(r.chords!.length).toBeLessThanOrEqual(20)
    }
    expect(rows.map((r) => r.chords).join(' ').split(/\s+/).filter((t) => t !== '|')).toEqual([
      'Dm7(9)', 'Dm7(9)', 'Em7(b5)', 'A7(b13)', 'Dm7(9)',
    ])
  })
})

describe('ajustar a posição do acorde', () => {
  it('move só o acorde escolhido, mantendo os outros no lugar', () => {
    //         0123456789012345678901
    const l = 'E                  E7'
    expect(moveChordInLine(l, 19, 15)).toEqual({ line: 'E              E7', col: 15 })
    expect(moveChordInLine(l, 0, 4)).toEqual({ line: '    E              E7', col: 4 })
  })

  it('não encosta nem pula o vizinho', () => {
    const l = 'A            E  B'
    // B não pode ir para antes do E: para a 1 espaço dele.
    expect(moveChordInLine(l, 16, 2)).toEqual({ line: 'A            E B', col: 15 })
    // E não pode passar o B.
    expect(moveChordInLine(l, 13, 30).col).toBe(14)
    // Nem antes do começo da linha.
    expect(moveChordInLine(l, 0, -5).col).toBe(0)
  })

  it('coluna sem acorde: nada muda', () => {
    expect(moveChordInLine('C   G', 2, 0)).toEqual({ line: 'C   G', col: 2 })
  })
})

describe('seção escrita com dois-pontos', () => {
  it('"INTRO: E A E B" vira seção com acordes (e transpõe)', () => {
    const [l] = parseSheet('INTRO: E A E B', 1, 'F')
    expect(l).toEqual({ kind: 'section', label: 'Intro', type: 'intro', chords: 'F Bb F C' })
    expect(transposeSheet('INTRO: E A E B', 2, 'F#')).toBe('INTRO: F# B F# C#')
  })

  it('"Refrão:" sozinho vira seção; "Tom: C" e letra com dois-pontos continuam como estão', () => {
    expect(parseSheet('Refrão:')[0]).toMatchObject({ kind: 'section', label: 'Refrão', type: 'refrao' })
    expect(parseSheet('Tom: C')[0].kind).toBe('lyrics')
    expect(parseSheet('Solo: agora todos juntos')[0].kind).toBe('lyrics')
  })
})

describe('grafia do tom', () => {
  it('no tom original, a cifra segue a grafia do tom (A# vira Bb no tom de Bb)', () => {
    const lines = parseSheet('[Intro] A#7+ F#7+ D#m7 F#/G# D#/F\n  A#7+   D#m7\nWith all my heart', 0, 'Bb')
    expect(lines[0]).toMatchObject({ kind: 'section', chords: 'Bb7+ Gb7+ Ebm7 Gb/Ab Eb/F' })
    expect(lines[1]).toEqual({ kind: 'chords', text: '  Bb7+   Ebm7' })
  })

  it('tom com sustenidos troca bemóis por sustenidos; tom sem acidentes deixa como está', () => {
    expect(parseSheet('Gb Db', 0, 'F#')[0]).toEqual({ kind: 'chords', text: 'F# C#' })
    expect(parseSheet('A# Bb', 0, 'C')[0]).toEqual({ kind: 'chords', text: 'A# Bb' })
    expect(parseSheet('A# Bb', 0, null)[0]).toEqual({ kind: 'chords', text: 'A# Bb' })
  })
})
