import { describe, expect, it } from 'vitest'
import { parseSheet } from './chords'
import { fileNameFor, mergeChordLine, songInKey, toChordPro, toChordProBook } from './export'
import { parseSongFile } from './import'

const SONG = {
  title: 'Luz da Manhã',
  artist: 'Ministério Demo',
  key: 'D',
  bpm: 72,
  timeSignature: '4/4',
  content: `[Intro] D  A/C#  Bm  G  (x2)

[Verso 1]
D                A/C#
Quando a luz da manhã
        Bm            G
Toca o chão da minha casa

[Refrão]
D            A
Luz da manhã, acende em mim
Bm           G
Canção que não tem fim

[Final] D  A/C#  Bm  G  D`,
}

describe('mergeChordLine', () => {
  it('põe cada acorde antes da sílaba certa', () => {
    expect(mergeChordLine('D                A/C#', 'Quando a luz da manhã')).toBe('[D]Quando a luz da m[A/C#]anhã')
    expect(mergeChordLine('        Bm            G', 'Toca o chão da minha casa')).toBe('Toca o c[Bm]hão da minha c[G]asa')
  })
  it('acorde depois do fim da letra', () => {
    expect(mergeChordLine('C        G', 'Oi')).toBe('[C]Oi       [G]')
  })
})

describe('toChordPro', () => {
  const cho = toChordPro(SONG)
  it('escreve os metadados', () => {
    expect(cho.startsWith('{title: Luz da Manhã}\n{artist: Ministério Demo}\n{key: D}\n{tempo: 72}\n{time: 4/4}')).toBe(true)
  })
  it('usa blocos do ChordPro para verso e refrão, e comentário para o resto', () => {
    // Os espaços entre os acordes mantêm as colunas originais em qualquer app que abrir o arquivo.
    expect(cho).toMatch(/\{comment: Intro\}\n\[D\] +\[A\/C#\] +\[Bm\] +\[G\] +\(x2\)/)
    expect(cho).toContain('{start_of_verse: Verso 1}\n[D]Quando a luz da m[A/C#]anhã')
    expect(cho).toContain('{start_of_chorus: Refrão}')
    expect(cho).toContain('{end_of_chorus}')
    expect(cho).toContain('{comment: Final}')
  })
  it('ida e volta: importar o que foi exportado devolve a mesma cifra', () => {
    const back = parseSongFile(cho, 'luz.cho')
    expect(back).toMatchObject({ title: 'Luz da Manhã', artist: 'Ministério Demo', originalKey: 'D', bpm: 72 })
    // Mesmos acordes e mesma letra, linha por linha (ignorando só espaços no fim).
    const norm = (c: string) =>
      parseSheet(c)
        .filter((l) => l.kind === 'chords' || l.kind === 'lyrics')
        .map((l) => ('text' in l ? l.text.trimEnd() : ''))
    expect(norm(back.content)).toEqual(norm(SONG.content))
    // A introdução volta numa linha só, com os acordes nas mesmas colunas e o (x2).
    expect(back.content.split('\n')[0]).toBe('[Intro] D  A/C#  Bm  G  (x2)')
  })
})

describe('exportar no tom do repertório', () => {
  it('transpõe antes de exportar', () => {
    const cho = toChordPro(songInKey(SONG, -2, 'C'))
    expect(cho).toContain('{key: C}')
    expect(cho).toContain('[C]Quando a luz da m[G/B]anhã')
  })
})

describe('repertório inteiro', () => {
  it('separa as músicas com {new_song}', () => {
    const book = toChordProBook([SONG, { ...SONG, title: 'Outra' }])
    expect(book.split('{new_song}')).toHaveLength(2)
    expect(book).toContain('{title: Outra}')
  })
})

describe('nome do arquivo', () => {
  it('tira caracteres que o Windows não aceita', () => {
    expect(fileNameFor('Luz: da/Manhã?', 'cho')).toBe('Luz da Manhã.cho')
  })
})
