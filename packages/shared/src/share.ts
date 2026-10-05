// Texto para divulgar um repertório (ou um bloco) nas redes: WhatsApp, X…
// Só nome, artista e (se a pessoa quiser) o tom: nunca letra ou cifra.

export interface ShareSong {
  title: string
  artist: string | null
  key: string | null
}

export interface ShareGroup {
  /** null = músicas fora de bloco. */
  name: string | null
  subtitle: string | null
  songs: ShareSong[]
}

export interface ShareSetlist {
  title: string
  /** "sábado, 12 de outubro · Bar do Zé" */
  details: string | null
  groups: ShareGroup[]
}

export const SHARE_SIGNATURE = 'Montado no Ensaio Fácil'

const songLine = (s: ShareSong, n: number, withKeys: boolean) =>
  `${n}. ${s.title}${s.artist ? ` — ${s.artist}` : ''}${withKeys && s.key ? ` (${s.key})` : ''}`

/** Texto completo, com negrito do WhatsApp (*assim*). */
export function setlistShareText(s: ShareSetlist, opts: { withKeys?: boolean; bold?: boolean } = {}): string {
  const b = (t: string) => (opts.bold === false ? t : `*${t}*`)
  const out = [`🎶 ${b(s.title)}`]
  if (s.details) out.push(s.details)
  let n = 0
  for (const g of s.groups) {
    if (!g.songs.length) continue
    out.push('')
    if (g.name) out.push(b(g.name.toUpperCase()) + (g.subtitle ? ` (${g.subtitle})` : ''))
    for (const song of g.songs) out.push(songLine(song, ++n, !!opts.withKeys))
  }
  out.push('', SHARE_SIGNATURE)
  return out.join('\n')
}

/** Versão curta para o X (até `limit` caracteres): corta a lista e diz quantas faltam. */
export function setlistShortText(s: ShareSetlist, limit = 270): string {
  const songs = s.groups.flatMap((g) => g.songs)
  const head = [`🎶 ${s.title}`, s.details].filter(Boolean).join('\n')
  const tail = SHARE_SIGNATURE
  const fits = (list: string[], rest: number) =>
    [head, '', ...list, ...(rest ? [`+ ${rest} ${rest === 1 ? 'música' : 'músicas'}`] : []), '', tail].join('\n')
  const lines = songs.map((x, i) => songLine(x, i + 1, false))
  for (let k = lines.length; k >= 0; k--) {
    const text = fits(lines.slice(0, k), lines.length - k)
    if ([...text].length <= limit) return text
  }
  return [...`${head}\n\n${tail}`].slice(0, limit).join('')
}
