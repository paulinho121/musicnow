// Lê um repertório escrito em texto, do jeito que os músicos já fazem no papel/WhatsApp:
//
//   BLOCO 2 (Marília - 130)
//   • Largado às traças - A
//   • Fada - A
//
// Vira blocos (nome, estilo, BPM) com as músicas e seus tons.
import { isChord } from './chords'

export interface TextSong {
  title: string
  key: string | null
}

export interface TextBlock {
  name: string
  style: string | null
  bpm: number | null
  songs: TextSong[]
}

export interface ParsedSetlistText {
  /** Músicas antes do primeiro bloco (ou todas, se a lista não tem blocos). */
  loose: TextSong[]
  blocks: TextBlock[]
}

const BLOCK_RE = /^(bloco|block|set|parte|sequ[eê]ncia|medley)\b\s*(\d+)?\s*[:.\-–—]?\s*(.*)$/i
const DASH = /\s+[-–—]\s+|\s+[-–—]$|^[-–—]\s+/
const BULLET = /^\s*(?:[•●▪◦·*\->]+|\d{1,3}\s*[.)\-–]|\(\d{1,3}\))\s*/

/** "(Ballada 3 - 80)" → estilo "Ballada 3", BPM 80. */
function blockDetails(rest: string): { style: string | null; bpm: number | null; extra: string } {
  let text = rest.trim()
  const paren = /\(([^)]*)\)/.exec(text)
  let inside = paren ? paren[1] : ''
  if (paren) text = (text.slice(0, paren.index) + text.slice(paren.index + paren[0].length)).trim()
  else {
    inside = text
    text = ''
  }
  let bpm: number | null = null
  const bpmMatch = /(?:^|[\s\-–—,])(\d{2,3})\s*(?:bpm)?\s*$/i.exec(inside)
  if (bpmMatch) {
    const n = Number(bpmMatch[1])
    if (n >= 40 && n <= 260) {
      bpm = n
      inside = inside.slice(0, bpmMatch.index)
    }
  }
  const style = inside.replace(/[\s\-–—,]+$/, '').trim() || null
  return { style, bpm, extra: text.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '') }
}

/** "Fada - A" → { title: "Fada", key: "A" }; "Fada" → sem tom. */
function songLine(line: string): TextSong | null {
  const text = line.replace(BULLET, '').trim()
  if (!text) return null
  const parts = text.split(DASH).map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    const last = parts[parts.length - 1].replace(/^tom:?\s*/i, '').replace(/[()]/g, '')
    if (isChord(last)) return { title: parts.slice(0, -1).join(' - '), key: last }
  }
  // "Fada (A)" ou "Fada [A]"
  const tail = /^(.*?)[\s]*[([]\s*(?:tom:?\s*)?([A-G][#b]?m?[^)\]]*)[)\]]\s*$/i.exec(text)
  if (tail && isChord(tail[2].trim())) return { title: tail[1].trim(), key: tail[2].trim() }
  return { title: text, key: null }
}

export function parseSetlistText(input: string): ParsedSetlistText {
  const out: ParsedSetlistText = { loose: [], blocks: [] }
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  let current: TextBlock | null = null
  let sawContent = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // Título da folha ("REPERTÓRIO", "Set list"), antes de qualquer música.
    if (!sawContent && /^(repert[oó]rio|set ?list|playlist|lista)\b[^-–—]*$/i.test(line)) continue
    const block = BLOCK_RE.exec(line.replace(BULLET, (b) => (/\d/.test(b) ? b : '')))
    // "Bloco"/"Parte" sempre abrem bloco; "Set"/"Medley" só com número, parênteses ou dois-pontos
    // (senão "Set Fire to the Rain - C" viraria bloco).
    const isBlock =
      block !== null &&
      (/^(bloco|block|parte)$/i.test(block[1]) || Boolean(block[2]) || line.includes('(') || line.endsWith(':'))
    if (block && isBlock) {
      const label = block[1][0].toUpperCase() + block[1].slice(1).toLowerCase()
      const rest = (block[3] ?? '').replace(/:\s*$/, '')
      const { style, bpm, extra } = blockDetails(rest)
      // Sem número ("Bloco Forró"): o que vem depois é o próprio nome do bloco.
      const named = !block[2] && !rest.includes('(')
      current = {
        name: named
          ? [label, style].filter(Boolean).join(' ')
          : [label, block[2]].filter(Boolean).join(' ') + (extra ? ` · ${extra}` : ''),
        style: named ? null : style,
        bpm,
        songs: [],
      }
      out.blocks.push(current)
      sawContent = true
      continue
    }
    const song = songLine(line)
    if (!song) continue
    sawContent = true
    if (current) current.songs.push(song)
    else out.loose.push(song)
  }
  return out
}
