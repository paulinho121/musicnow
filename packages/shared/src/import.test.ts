import { describe, expect, it } from 'vitest'
import { detectFormat, inlineToChordsOverLyrics, parseSongFile, translateSectionLabel } from './import'

describe('acordes embutidos', () => {
  it('põe cada acorde sobre a sílaba certa', () => {
    expect(inlineToChordsOverLyrics('Qu[D]ando a [A/C#]luz da manhã')).toEqual([
      '  D      A/C#',
      'Quando a luz da manhã',
    ])
  })
  it('abre espaço quando os acordes ficam colados', () => {
    const [chords, lyric] = inlineToChordsOverLyrics('[C#m7(b5)][F#7]Sol')
    expect(chords).toBe('C#m7(b5) F#7')
    expect(lyric.trim()).toBe('Sol')
    expect(lyric.indexOf('Sol')).toBe(chords.indexOf('F#7'))
  })
  it('linha só com acordes', () => {
    expect(inlineToChordsOverLyrics('[G] [D] [Em]')).toEqual(['G D Em'])
  })
})

describe('seções', () => {
  it('traduz nomes em inglês', () => {
    expect(translateSectionLabel('Chorus')).toBe('Refrão')
    expect(translateSectionLabel('Verse 2')).toBe('Verso 2')
    expect(translateSectionLabel('Pre-Chorus')).toBe('Pré-refrão')
    expect(translateSectionLabel('Refrão')).toBe('Refrão')
  })
})

describe('ChordPro', () => {
  const cho = `{title: Canção de Teste}
{artist: Banda Exemplo}
{key: G}
{tempo: 96}
{time: 4/4}
{capo: 2}

{start_of_verse: Verse 1}
[G]Primeira [D]linha
[Em]Segunda [C]linha
{end_of_verse}

{soc}
[C]Refrão [G]aqui
{eoc}
{c: Repetir 2x}`

  it('lê metadados e converte o corpo', () => {
    expect(detectFormat(cho, 'musica.cho')).toBe('chordpro')
    const s = parseSongFile(cho, 'musica.cho')
    expect(s).toMatchObject({
      title: 'Canção de Teste',
      artist: 'Banda Exemplo',
      originalKey: 'G',
      bpm: 96,
      timeSignature: '4/4',
      format: 'chordpro',
    })
    expect(s.warnings.join()).toContain('capotraste')
    expect(s.content).toContain('[Verso 1]\nG        D\nPrimeira linha')
    expect(s.content).toContain('[Refrão]\nC      G\nRefrão aqui')
    expect(s.content).toContain('(Repetir 2x)')
  })
})

describe('OnSong', () => {
  const onsong = `Luz do Dia
Grupo Exemplo
Key: D
Tempo: 70

Verse 1:
[D]Quando o [A]dia nasce
[Bm]Tudo se [G]refaz

Chorus:
[G]Luz do [A]dia`

  it('usa as primeiras linhas como título e artista', () => {
    expect(detectFormat(onsong)).toBe('onsong')
    const s = parseSongFile(onsong)
    expect(s).toMatchObject({ title: 'Luz do Dia', artist: 'Grupo Exemplo', originalKey: 'D', bpm: 70 })
    expect(s.content.startsWith('[Verso 1]')).toBe(true)
    expect(s.content).toContain('[Refrão]')
    expect(s.content).toContain('D        A\nQuando o dia nasce')
  })
})

describe('OpenSong', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>Hino &amp; Louvor</title>
  <author>Autor Antigo</author>
  <key>F</key>
  <tempo>84</tempo>
  <lyrics>[V1]
.F        C
 Primeira linha
;comentário ignorado
[C]
.Bb   F
 Refrão</lyrics>
</song>`

  it('converte XML do OpenSong', () => {
    expect(detectFormat(xml, 'Hino')).toBe('opensong')
    const s = parseSongFile(xml, 'Hino')
    expect(s).toMatchObject({ title: 'Hino & Louvor', artist: 'Autor Antigo', originalKey: 'F', bpm: 84 })
    expect(s.content).toBe('[Verso 1]\nF        C\nPrimeira linha\n\n[Refrão]\nBb   F\nRefrão')
  })
})

describe('texto colado', () => {
  it('reconhece cabeçalho de sites de cifra', () => {
    const txt = `Noite Clara
Artista Demo

Tom: Am

[Intro] Am  F  C  G

[Primeira Parte]
Am           F
Letra da primeira linha`
    const s = parseSongFile(txt)
    expect(s).toMatchObject({ title: 'Noite Clara', artist: 'Artista Demo', originalKey: 'Am', format: 'text' })
    expect(s.content.startsWith('[Intro] Am  F  C  G')).toBe(true)
  })

  it('sem cabeçalho usa o nome do arquivo e detecta o tom', () => {
    const s = parseSongFile('E        B\nLetra qualquer\n', 'minha_musica.txt')
    expect(s.title).toBe('minha musica')
    expect(s.originalKey).toBe('E')
  })

  it('avisa quando não há acordes', () => {
    const s = parseSongFile('Só uma letra\nsem acordes\nnenhum', 'x.txt')
    expect(s.warnings.join()).toContain('Nenhum acorde')
  })
})
