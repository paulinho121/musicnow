// Caderno de cifras do Word (.docx): várias músicas seguidas, com acordes em cima da letra,
// muitas vezes sem título. Aqui o texto do Word vira parágrafos e os parágrafos viram músicas.
// Funções puras: a leitura do arquivo (zip) fica no app.
import { guessKey, isChordLine } from './chords'
import type { ImportedSong } from './import'

export interface DocParagraph {
  text: string
  /** Estilo do parágrafo no Word (mudança de estilo costuma marcar outra música). */
  style: string
  /** Quebra de página antes/dentro do parágrafo. */
  pageBreak: boolean
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')

/**
 * word/document.xml → parágrafos. Espaços "não quebráveis" (comuns em cifra copiada de
 * site) viram espaços normais, senão os acordes saem do lugar.
 */
export function docxParagraphs(xml: string): DocParagraph[] {
  const body = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '') // texto apagado (controle de alterações)
  const out: DocParagraph[] = []
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let text = ''
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>/g)) {
      if (m[0].startsWith('<w:tab')) text += '    '
      else if (m[0].startsWith('<w:br')) text += m[0].includes('type="page"') ? '' : '\n'
      else text += decodeXml(m[1])
    }
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    const pageBreak = /<w:br [^>]*w:type="page"/.test(p) || /<w:pageBreakBefore\/>/.test(p)
    // Quebras de linha dentro do parágrafo viram parágrafos (cada linha da cifra conta).
    text
      .replace(/ /g, ' ')
      .split('\n')
      .forEach((line, i) => out.push({ text: line.replace(/\s+$/, ''), style, pageBreak: pageBreak && i === 0 }))
  }
  return out
}

const INTRO = /^\s*(\[?\s*intro(du[cç][aã]o)?\s*\]?\s*:?)(\s|$)/i
/** "[Primeira Parte]", "[Refrão]"... */
const SECTION = /^\s*\[([^\]]+)\]\s*$/

const KEEP_CAPITALIZED = /\b(deus|senhor|jesus|cristo|maria|espírito|santo|pai|filho|nossa senhora)\b/gi

/** "EIS-ME AQUI SENHOR!" → "Eis-me aqui Senhor"; até ~45 letras, sem cortar palavra. */
export function titleFromLine(line: string) {
  let t = line
    .replace(/^\s*\d+\s*[.)-]\s*/, '') // "1. O Senhor..."
    .replace(/\(\s*\d+\s*x\s*\)/gi, '') // "(4x)"
    .replace(/[_]+/g, '')
    .replace(/[!?.,;:…]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t === t.toUpperCase()) t = t.toLowerCase()
  t = t.replace(KEEP_CAPITALIZED, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (t.length > 45) t = `${t.slice(0, 45).replace(/\s+\S*$/, '')}…`
  return t || 'Música sem título'
}

interface Draft {
  lines: string[]
  /** Já tem letra (uma linha que não é acorde nem seção)? */
  hasLyrics: boolean
}

const isLyric = (line: string) => Boolean(line.trim()) && !isChordLine(line) && !SECTION.test(line) && !INTRO.test(line)

/**
 * Separa o caderno em músicas. Começa uma música nova quando a atual já tem letra e aparece:
 * uma introdução ("INTRO:", "[Intro]"), três ou mais linhas em branco (duas aparecem no meio
 * de música, entre estrofes), quebra de página,
 * mudança de estilo do Word ou "[Primeira Parte]" (início de música). O que não der para
 * saber (músicas coladas sem nada entre elas) a pessoa separa na prévia.
 */
export function splitSongBook(paragraphs: DocParagraph[]): ImportedSong[] {
  const songs: Draft[] = []
  let cur: Draft = { lines: [], hasLyrics: false }
  let blanks = 0
  let lastStyle: string | null = null
  /** A linha anterior (com texto) era de acordes: a próxima é a letra dela, da mesma música. */
  let afterChords = false

  const flush = () => {
    if (cur.lines.some((l) => l.trim())) songs.push(cur)
    cur = { lines: [], hasLyrics: false }
  }

  for (const p of paragraphs) {
    const line = p.text
    if (!line.trim()) {
      blanks++
      cur.lines.push('')
      continue
    }
    const section = SECTION.exec(line)?.[1]
    const startsSong =
      INTRO.test(line) ||
      blanks >= 3 ||
      p.pageBreak ||
      (lastStyle !== null && p.style !== lastStyle) ||
      (section != null && /primeira\s+parte|^parte\s*1$/i.test(section))
    if (cur.hasLyrics && startsSong && !(afterChords && blanks === 0 && isLyric(line))) flush()
    blanks = 0
    lastStyle = p.style
    afterChords = isChordLine(line)
    cur.lines.push(line)
    if (isLyric(line)) cur.hasLyrics = true
  }
  flush()
  return songs.map(toSong)
}

/** Junta duas músicas da prévia (separadas por engano). */
export function joinSongs(a: ImportedSong, b: ImportedSong): ImportedSong {
  return { ...a, content: `${a.content}\n\n${b.content}`, warnings: [] }
}

/** Separa uma música da prévia na linha escolhida (essa linha começa a nova música). */
export function splitSongAt(song: ImportedSong, lineIndex: number): [ImportedSong, ImportedSong] {
  const lines = song.content.split('\n')
  const first = toSong({ lines: lines.slice(0, lineIndex), hasLyrics: true })
  const second = toSong({ lines: lines.slice(lineIndex), hasLyrics: true })
  return [{ ...first, title: song.title, artist: song.artist }, second]
}

function toSong(d: Draft): ImportedSong {
  // Tira linhas em branco das pontas e junta brancos repetidos.
  const content = d.lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\n+|\n+\s*$/g, '')
  const firstLyric = content.split('\n').find(isLyric)
  const key = guessKey(content)
  const warnings: string[] = []
  if (!firstLyric) warnings.push('Não achamos a letra: confira o título.')
  if (!key) warnings.push('Tom não detectado: escolha o tom.')
  return {
    title: firstLyric ? titleFromLine(firstLyric) : 'Música sem título',
    artist: null,
    composer: null,
    originalKey: key,
    bpm: null,
    timeSignature: null,
    content,
    format: 'word',
    warnings,
  }
}
