import { describe, expect, it } from 'vitest'
import { docxParagraphs, joinSongs, splitSongAt, splitSongBook, titleFromLine } from './songbook'

const NB = ' '
/** Parágrafo do Word (com estilo opcional e espaços "não quebráveis", como vem de site de cifra). */
const p = (text: string, style = '') =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</w:t></w:r></w:p>`
const blank = (style = '') => p('', style)
const doc = (...paras: string[]) => `<w:document><w:body>${paras.join('')}</w:body></w:document>`

// Caderno da missa resumido: músicas sem título, separadas de jeitos diferentes.
const XML = doc(
  p('INTRO: E A E B'),
  blank(),
  p('E               E7'),
  p('EIS-ME AQUI SENHOR!'),
  // Muda o estilo do Word: outra música (sem título, começa nos acordes).
  p(`G${NB.repeat(5)}Bm${NB.repeat(6)}C`, 'NormalWeb'),
  p(`Confesso${NB}a${NB}Deus`, 'NormalWeb'),
  p(`${NB.repeat(8)}C${NB.repeat(12)}D`, 'NormalWeb'),
  // Última linha da letra com outro estilo: continua na mesma música.
  p('Que rogueis por mim a Deus'),
  blank(),
  blank(),
  blank(),
  p('[Intro] C  Am  F  G'),
  p('[Primeira Parte]'),
  p(' C             Am'),
  p('Santo, Santo, Santo'),
  blank(),
  blank(),
  p('  Dm                 G'),
  p('Senhor, Deus do universo'),
  p('[Primeira Parte]'),
  p(' E                            G#m7'),
  p('Senhor, fazei-me instrumento de vossa paz'),
)

describe('caderno de cifras do Word', () => {
  it('lê os parágrafos e troca os espaços "não quebráveis" (acordes no lugar)', () => {
    const paras = docxParagraphs(XML)
    expect(paras[4].text).toBe('G     Bm      C')
    expect(paras[4].style).toBe('NormalWeb')
    expect(docxParagraphs(doc(p('Fé &amp; vida'.replace('&amp;', '&'))))[0].text).toBe('Fé & vida')
  })

  it('separa as músicas e dá título pela primeira linha da letra', () => {
    const songs = splitSongBook(docxParagraphs(XML))
    expect(songs.map((s) => s.title)).toEqual([
      'Eis-me aqui Senhor',
      'Confesso a Deus',
      'Santo, Santo, Santo',
      'Senhor, fazei-me instrumento de vossa paz',
    ])
    expect(songs.map((s) => s.originalKey)).toEqual(['E', 'G', 'C', 'E'])
    // A última linha do "Confesso" (outro estilo) ficou na mesma música.
    expect(songs[1].content.split('\n').at(-1)).toBe('Que rogueis por mim a Deus')
    // Duas linhas em branco no meio do Santo não quebram a música.
    expect(songs[2].content).toContain('Senhor, Deus do universo')
    expect(songs[0].content.split('\n')[0]).toBe('INTRO: E A E B')
    expect(songs.every((s) => s.format === 'word')).toBe(true)
  })

  it('títulos limpos', () => {
    expect(titleFromLine('1. O SENHOR É O PASTOR QUE ME CONDUZ')).toBe('O Senhor é o pastor que me conduz')
    expect(titleFromLine('NA GLÓRIA DE DEUS PAI. AMÉM!  (4X)')).toBe('Na glória de Deus Pai. amém')
    expect(titleFromLine('Dai-nos a pa_______z')).toBe('Dai-nos a paz')
    expect(titleFromLine('   ')).toBe('Música sem título')
  })

  it('separa e junta músicas na prévia', () => {
    const [eis] = splitSongBook(docxParagraphs(XML))
    const [a, b] = splitSongAt(eis, 2)
    expect(a.title).toBe('Eis-me aqui Senhor')
    expect(a.content).toBe('INTRO: E A E B')
    expect(b.title).toBe('Eis-me aqui Senhor')
    expect(b.content.startsWith('E               E7')).toBe(true)
    expect(joinSongs(a, b).content).toBe(`INTRO: E A E B\n\n${b.content}`)
  })
})
