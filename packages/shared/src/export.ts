// Exportação para ChordPro (.cho): o formato aberto que OnSong, SongbookPro,
// Planning Center e outros apps de cifra leem. É o inverso do importador:
// "acordes sobre a letra" vira "[C]acorde dentro da letra".
import { isChord, isChordLine, sectionTypeFromLabel, transposeSheet, type SectionType } from './chords'

export interface ExportableSong {
  title: string
  artist?: string | null
  composer?: string | null
  /** Tom em que a cifra está escrita (depois de transpor, se for o caso). */
  key?: string | null
  bpm?: number | null
  timeSignature?: string | null
  notes?: string | null
  content: string
}

const SECTION_RE = /^\s*\[([^\]]+)\]\s*(.*)$/

// Seções que o ChordPro tem como blocos próprios; as demais viram comentário.
const BLOCKS: Partial<Record<SectionType, string>> = {
  refrao: 'chorus',
  verso: 'verse',
  ponte: 'bridge',
}

/** Junta uma linha de acordes com a letra de baixo: "G   D" + "Quando a" → "[G]Quan[D]do a". */
export function mergeChordLine(chords: string, lyric: string): string {
  const positions: { col: number; chord: string }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(chords))) positions.push({ col: m.index, chord: m[0] })
  let out = ''
  let cursor = 0
  // Acordes além do fim da letra: a letra é completada com espaços.
  const padded = lyric.padEnd(Math.max(lyric.length, ...positions.map((p) => p.col)), ' ')
  for (const p of positions) {
    out += padded.slice(cursor, p.col) + `[${p.chord}]`
    cursor = p.col
  }
  return (out + padded.slice(cursor)).replace(/\s+$/, '')
}

/**
 * Linha só de acordes: "D  A/C#  (x2)" → "[D]  [A/C#]  (x2)". Os espaços são calculados
 * para que, ao importar de volta, cada acorde caia exatamente na mesma coluna.
 */
function chordsOnly(line: string) {
  let out = ''
  let plain = 0 // caracteres que contam como "letra" na importação (tudo fora dos colchetes)
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const token = m[0]
    const pad = Math.max(m.index - plain, out ? 1 : 0)
    out += ' '.repeat(pad)
    plain += pad
    if (isChord(token)) out += `[${token}]`
    else {
      out += token
      plain += token.length
    }
  }
  return out
}

export function toChordPro(song: ExportableSong): string {
  const out: string[] = [`{title: ${song.title}}`]
  if (song.artist) out.push(`{artist: ${song.artist}}`)
  if (song.composer) out.push(`{composer: ${song.composer}}`)
  if (song.key) out.push(`{key: ${song.key}}`)
  if (song.bpm) out.push(`{tempo: ${song.bpm}}`)
  if (song.timeSignature) out.push(`{time: ${song.timeSignature}}`)
  if (song.notes) out.push(`{comment: ${song.notes.replace(/\s*\n\s*/g, ' ')}}`)
  out.push('')

  const lines = song.content.replace(/\r\n?/g, '\n').split('\n')
  let open: string | null = null
  const close = () => {
    if (open) out.push(`{end_of_${open}}`)
    open = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '')
    const sec = SECTION_RE.exec(line)
    if (sec) {
      close()
      const label = sec[1].trim()
      const block = BLOCKS[sectionTypeFromLabel(label) ?? ('' as SectionType)]
      if (block) {
        out.push(`{start_of_${block}: ${label}}`)
        open = block
      } else out.push(`{comment: ${label}}`)
      if (sec[2]) out.push(isChordLine(sec[2]) ? chordsOnly(sec[2]) : sec[2])
      continue
    }
    if (!line.trim()) {
      // Linha em branco fecha o bloco só se a próxima linha com conteúdo for outra seção.
      const nextContent = lines.slice(i + 1).find((l) => l.trim())
      if (!nextContent || SECTION_RE.test(nextContent)) close()
      out.push('')
      continue
    }
    if (isChordLine(line)) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() && !isChordLine(next) && !SECTION_RE.test(next)) {
        out.push(mergeChordLine(line, next.replace(/\s+$/, '')))
        i++
      } else out.push(chordsOnly(line))
      continue
    }
    out.push(line)
  }
  close()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') + '\n'
}

/** Várias músicas num arquivo só (ex.: um repertório), separadas como manda o ChordPro. */
export function toChordProBook(songs: ExportableSong[]): string {
  return songs.map(toChordPro).join('\n{new_song}\n\n')
}

/** Cifra no tom pedido, pronta para exportar. */
export function songInKey(song: ExportableSong & { originalKey?: string | null }, semitones: number, targetKey: string | null) {
  return { ...song, key: targetKey ?? song.key, content: semitones ? transposeSheet(song.content, semitones, targetKey) : song.content }
}

/** Nome de arquivo seguro: "Luz da Manhã (C).cho". */
export function fileNameFor(title: string, ext: string) {
  const base = title
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || 'cifra'}.${ext}`
}
