// Importação de cifras: converte ChordPro, OnSong, OpenSong e texto colado
// para o formato do Ensaio Fácil (acordes sobre a letra, seções entre colchetes).
import { guessKey, isChord, isChordLine, parseChord, sectionTypeFromLabel, transposeKey } from './chords'

export type ImportFormat = 'chordpro' | 'onsong' | 'opensong' | 'text'

export interface ImportedSong {
  title: string
  artist: string | null
  composer: string | null
  originalKey: string | null
  bpm: number | null
  timeSignature: string | null
  content: string
  format: ImportFormat
  /** Avisos para a pessoa revisar antes de salvar (capotraste, tom não detectado...). */
  warnings: string[]
}

// Nomes de seção em inglês (ChordPro/OnSong/OpenSong) → português.
const EN_SECTIONS: [RegExp, string][] = [
  [/^pre[\s-]?chorus/i, 'Pré-refrão'],
  [/^chorus/i, 'Refrão'],
  [/^refrain/i, 'Refrão'],
  [/^verse/i, 'Verso'],
  [/^bridge/i, 'Ponte'],
  [/^intro/i, 'Intro'],
  [/^(outro|ending|end)/i, 'Final'],
  [/^(interlude|instrumental)/i, 'Interlúdio'],
  [/^solo/i, 'Solo'],
  [/^tag/i, 'Tag'],
]

/** "Chorus 2" → "Refrão 2"; nomes em português ficam como estão. */
export function translateSectionLabel(label: string): string {
  const clean = label.trim().replace(/:$/, '')
  for (const [re, pt] of EN_SECTIONS) {
    const m = re.exec(clean)
    if (m) {
      const rest = clean.slice(m[0].length).trim()
      return rest ? `${pt} ${rest}` : pt
    }
  }
  return clean
}

function isSectionLabel(label: string) {
  const t = translateSectionLabel(label)
  return sectionTypeFromLabel(t) !== null || /^tag\b/i.test(t)
}

function toInt(v: string | null | undefined): number | null {
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) && n >= 20 && n <= 320 ? n : null
}

function normalizeKey(v: string | null | undefined): string | null {
  if (!v) return null
  const k = v.trim().replace(/maj(or)?$/i, '').replace(/\s*min(or)?$/i, 'm')
  const c = parseChord(k)
  if (!c) return null
  const minor = c.suffix.startsWith('m') && !c.suffix.startsWith('maj')
  return transposeKey(c.root + (minor ? 'm' : ''), 0)
}

const TIME_RE = /^(2|3|4|5|6|7|9|12)\/(2|4|8)$/

function cleanTitle(s: string) {
  return s.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function titleFromFileName(name?: string) {
  if (!name) return ''
  return cleanTitle(name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
}

// ---------------------------------------------------------------------------
// Acordes entre colchetes no meio da letra: "Qu[D]ando a [A/C#]luz"

const INLINE_CHORD_RE = /\[([^\]\s]+)\]/g

export function hasInlineChords(line: string): boolean {
  for (const m of line.matchAll(INLINE_CHORD_RE)) if (isChord(m[1])) return true
  return false
}

/** Converte uma linha com acordes embutidos em duas: acordes em cima, letra embaixo. */
export function inlineToChordsOverLyrics(line: string): string[] {
  let lyric = ''
  let chords = ''
  let last = 0
  for (const m of line.matchAll(INLINE_CHORD_RE)) {
    if (!isChord(m[1])) continue
    lyric += line.slice(last, m.index)
    last = m.index! + m[0].length
    // Se o acorde anterior ainda ocupa esta coluna, abre espaço na letra.
    const minCol = chords.length === 0 ? 0 : chords.length + 1
    if (lyric.length < minCol) lyric = lyric.padEnd(minCol, ' ')
    chords = chords.padEnd(lyric.length, ' ') + m[1]
  }
  lyric += line.slice(last)
  const lyricTrim = lyric.replace(/\s+$/, '')
  if (!lyricTrim.trim()) return [chords]
  // Sobrou só "(x2)", "|" etc.: isso faz parte da linha de acordes, não é letra.
  if (lyricTrim.trim().split(/\s+/).every((t) => NOISE_TOKEN.test(t))) {
    let merged = chords
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(lyricTrim))) {
      const col = Math.max(m.index, merged.length === 0 ? 0 : merged.length + 1)
      merged = merged.padEnd(col, ' ') + m[0]
    }
    return [merged]
  }
  return [chords, lyricTrim]
}

const NOISE_TOKEN = /^(\||\|\||\(?x\d+\)?|\(?\d+x\)?|%|-+|\.+|:)$/i

/** "[Intro]" seguido de uma linha só de acordes (sem letra embaixo) vira "[Intro] G  D  Em". */
function joinSectionChords(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    const next = lines[i + 1]
    const after = lines[i + 2]
    const isLabel = /^\[[^\]]+\]$/.test(cur.trim())
    const nextIsChords = next !== undefined && next.trim() !== '' && isChordLine(next)
    const nothingBelow = after === undefined || after.trim() === '' || /^\[[^\]]+\]/.test(after.trim())
    if (isLabel && nextIsChords && nothingBelow) {
      out.push(`${cur.trim()} ${next.trim()}`)
      i++
    } else out.push(cur)
  }
  return out
}

// ---------------------------------------------------------------------------
// ChordPro / OnSong

const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i

const SECTION_DIRECTIVES: Record<string, string> = {
  start_of_chorus: 'Refrão', soc: 'Refrão',
  start_of_verse: 'Verso', sov: 'Verso',
  start_of_bridge: 'Ponte', sob: 'Ponte',
  start_of_intro: 'Intro',
  start_of_outro: 'Final',
  start_of_tab: 'Tab', sot: 'Tab',
  start_of_grid: 'Grade', sog: 'Grade',
}

// Metadados no topo de arquivos OnSong / texto: "Key: G", "Tom: G", "Tempo: 72"...
const META_RE = /^\s*(title|título|titulo|artist|artista|author|autor|composer|compositor|key|tom|tempo|bpm|time|compasso|capo|capotraste|afinação|afinacao|tuning|ccli|copyright)\s*:\s*(.*)$/i

interface Meta {
  title?: string
  artist?: string
  composer?: string
  key?: string
  bpm?: string
  time?: string
}

function applyMeta(meta: Meta, name: string, value: string, warnings: string[]) {
  const n = name.toLowerCase()
  const v = value.trim()
  if (!v) return
  if (['title', 'título', 'titulo', 't'].includes(n)) meta.title ??= v
  else if (['artist', 'artista', 'subtitle', 'st', 'author', 'autor'].includes(n)) meta.artist ??= v
  else if (['composer', 'compositor', 'lyricist'].includes(n)) meta.composer ??= v
  else if (['key', 'tom'].includes(n)) meta.key ??= v
  else if (['tempo', 'bpm'].includes(n)) meta.bpm ??= v
  else if (['time', 'compasso'].includes(n)) meta.time ??= v
  else if (['capo', 'capotraste'].includes(n)) warnings.push(`Usa capotraste (${v}). Os acordes foram mantidos como no original.`)
}

function parseChordProLike(text: string, format: 'chordpro' | 'onsong', fileName?: string): ImportedSong {
  const warnings: string[] = []
  const meta: Meta = {}
  const out: string[] = []
  let inTab = false
  let headerDone = false
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n')

  // OnSong: as primeiras linhas sem ":" são título e artista.
  if (format === 'onsong') {
    let i = 0
    while (i < rawLines.length && !rawLines[i].trim()) i++
    const first = rawLines[i]?.trim()
    if (first && !META_RE.test(first) && !hasInlineChords(first) && !DIRECTIVE_RE.test(first)) {
      meta.title = first
      rawLines[i] = ''
      const second = rawLines[i + 1]?.trim()
      if (second && !META_RE.test(second) && !hasInlineChords(second) && !/:$/.test(second)) {
        meta.artist = second
        rawLines[i + 1] = ''
      }
    }
  }

  for (const raw of rawLines) {
    const line = raw.replace(/\s+$/, '')
    if (/^\s*#/.test(line)) continue

    const d = DIRECTIVE_RE.exec(line)
    if (d) {
      const name = d[1].toLowerCase()
      const value = d[2] ?? ''
      if (name in SECTION_DIRECTIVES) {
        const label = value ? translateSectionLabel(value) : SECTION_DIRECTIVES[name]
        if (out.length && out[out.length - 1] !== '') out.push('')
        out.push(`[${label}]`)
        inTab = name === 'start_of_tab' || name === 'sot'
      } else if (name.startsWith('end_of_') || ['eoc', 'eov', 'eob', 'eot', 'eog'].includes(name)) {
        inTab = false
        out.push('')
      } else if (['comment', 'c', 'ci', 'comment_italic', 'cb', 'comment_box', 'highlight'].includes(name)) {
        if (isSectionLabel(value)) {
          if (out.length && out[out.length - 1] !== '') out.push('')
          out.push(`[${translateSectionLabel(value)}]`)
        } else if (value) out.push(`(${value})`)
      } else {
        applyMeta(meta, name, value, warnings)
      }
      continue
    }

    if (!headerDone) {
      const m = META_RE.exec(line)
      if (m) {
        applyMeta(meta, m[1], m[2], warnings)
        continue
      }
    }

    // OnSong: "Verse 1:" / "Chorus:" viram seções.
    const sectionColon = /^\s*([^:[\]{}]{2,30}):\s*$/.exec(line)
    if (sectionColon && isSectionLabel(sectionColon[1])) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      out.push(`[${translateSectionLabel(sectionColon[1])}]`)
      headerDone = true
      continue
    }

    if (line.trim()) headerDone = true
    if (!inTab && hasInlineChords(line)) out.push(...inlineToChordsOverLyrics(line))
    else out.push(line)
  }

  const content = tidy(joinSectionChords(out).join('\n'))
  return finish({ meta, content, format, warnings, fileName })
}

// ---------------------------------------------------------------------------
// OpenSong (XML)

const OPENSONG_CODES: Record<string, string> = {
  V: 'Verso', C: 'Refrão', B: 'Ponte', P: 'Pré-refrão', I: 'Intro', O: 'Final', E: 'Final', T: 'Tag',
}

function xmlTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  if (!m) return null
  return decodeXml(m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1'))
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

function parseOpenSong(xml: string, fileName?: string): ImportedSong {
  const warnings: string[] = []
  const meta: Meta = {
    title: xmlTag(xml, 'title') ?? undefined,
    artist: xmlTag(xml, 'author') ?? undefined,
    key: xmlTag(xml, 'key') ?? undefined,
    bpm: xmlTag(xml, 'tempo') ?? undefined,
    time: xmlTag(xml, 'time_sig') ?? undefined,
  }
  const capo = xmlTag(xml, 'capo')
  if (capo && capo.trim() && capo.trim() !== '0') warnings.push(`Usa capotraste (${capo.trim()}). Os acordes foram mantidos como no original.`)

  const out: string[] = []
  for (const raw of (xmlTag(xml, 'lyrics') ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const sec = /^\[([A-Za-z]+)(\d*)\]$/.exec(line.trim())
    if (sec) {
      const code = sec[1].toUpperCase()
      const label = OPENSONG_CODES[code] ?? translateSectionLabel(sec[1])
      if (out.length && out[out.length - 1] !== '') out.push('')
      out.push(`[${label}${sec[2] ? ' ' + sec[2] : ''}]`)
    } else if (line.startsWith('.')) out.push(line.slice(1))
    else if (line.startsWith(';')) continue
    else out.push(line.replace(/^[ \d]/, '').replace(/[_|]/g, ''))
  }
  return finish({ meta, content: tidy(out.join('\n')), format: 'opensong', warnings, fileName })
}

// ---------------------------------------------------------------------------
// Texto colado (sites de cifra, bloco de notas...)

function parsePlainText(text: string, fileName?: string): ImportedSong {
  const warnings: string[] = []
  const meta: Meta = {}
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Cabeçalho = linhas antes da primeira linha de acordes ou seção.
  let start = 0
  const header: string[] = []
  for (; start < lines.length; start++) {
    const l = lines[start].trim()
    if (!l) {
      if (header.length) continue
      continue
    }
    if (isChordLine(l) || /^\[[^\]]+\]/.test(l)) break
    const m = META_RE.exec(l)
    if (m) applyMeta(meta, m[1], m[2], warnings)
    else header.push(l)
    // Cabeçalho longo demais: provavelmente é letra sem acordes, não cabeçalho.
    if (header.length > 4) {
      start = 0
      header.length = 0
      break
    }
  }
  if (header[0]) meta.title ??= header[0]
  if (header[1]) meta.artist ??= header[1]

  const out: string[] = []
  for (const raw of lines.slice(start)) {
    const line = raw.replace(/\s+$/, '')
    // "Refrão:" sozinho na linha vira seção.
    const sectionColon = /^\s*([^:[\]{}]{2,30}):\s*$/.exec(line)
    if (sectionColon && isSectionLabel(sectionColon[1])) out.push(`[${translateSectionLabel(sectionColon[1])}]`)
    else if (hasInlineChords(line)) out.push(...inlineToChordsOverLyrics(line))
    else out.push(line)
  }
  return finish({ meta, content: tidy(out.join('\n')), format: 'text', warnings, fileName })
}

// ---------------------------------------------------------------------------

/** Remove linhas em branco repetidas e no início/fim. */
function tidy(content: string) {
  return content.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}

function finish({
  meta,
  content,
  format,
  warnings,
  fileName,
}: {
  meta: Meta
  content: string
  format: ImportFormat
  warnings: string[]
  fileName?: string
}): ImportedSong {
  const title = cleanTitle(meta.title ?? '') || titleFromFileName(fileName) || 'Sem título'
  if (!meta.title && !fileName) warnings.push('Título não encontrado: confira antes de salvar.')
  const declaredKey = normalizeKey(meta.key)
  if (meta.key && !declaredKey) warnings.push(`Tom "${meta.key}" não reconhecido.`)
  const originalKey = declaredKey ?? guessKey(content)
  if (!originalKey) warnings.push('Nenhum acorde reconhecido: confira se o arquivo tem cifra.')
  const time = meta.time?.trim() ?? null
  return {
    title,
    artist: meta.artist ? cleanTitle(meta.artist) : null,
    composer: meta.composer ? cleanTitle(meta.composer) : null,
    originalKey,
    bpm: toInt(meta.bpm),
    timeSignature: time && TIME_RE.test(time) ? time : null,
    content,
    format,
    warnings,
  }
}

export function detectFormat(text: string, fileName = ''): ImportFormat {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (/<song[\s>]/i.test(text) && /<lyrics[\s>]/i.test(text)) return 'opensong'
  if (['cho', 'chopro', 'chordpro', 'crd', 'pro'].includes(ext)) return 'chordpro'
  if (/^\s*\{\s*(title|t|start_of_|soc|sov|key|artist|subtitle|st)\b/im.test(text)) return 'chordpro'
  if (ext === 'onsong') return 'onsong'
  const lines = text.split(/\r?\n/)
  const inline = lines.filter(hasInlineChords).length
  if (inline >= 2 && lines.some((l) => META_RE.test(l) || /^\s*[^:[\]{}]{2,30}:\s*$/.test(l))) return 'onsong'
  return 'text'
}

/** Ponto de entrada: detecta o formato e converte. */
export function parseSongFile(text: string, fileName?: string): ImportedSong {
  const format = detectFormat(text, fileName)
  if (format === 'opensong') return parseOpenSong(text, fileName)
  if (format === 'chordpro' || format === 'onsong') return parseChordProLike(text, format, fileName)
  return parsePlainText(text, fileName)
}
