// Links para encontrar a cifra e a gravação de uma música nos sites de origem.
// O app só ABRE esses sites (nova aba): não copia, não lê e não guarda o conteúdo
// deles. Quem tira a música guarda a própria versão, de forma privada.

/** "Talking to the Moon" → "talking-to-the-moon"; "Djavan & Gal" → "djavan-e-gal". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "Bruno Mars feat. X" → "Bruno Mars": o site da cifra costuma usar só o artista principal. */
export function mainArtist(artist: string): string {
  return artist.split(/\s+(?:feat\.?|ft\.?|part\.?|participação|com|&|e|x|,)\s+/i)[0].trim()
}

export interface SongRef {
  title: string
  artist?: string | null
}

const q = (s: string) => encodeURIComponent(s.replace(/\s+/g, ' ').trim())
const terms = (s: SongRef) => [s.title, s.artist ? mainArtist(s.artist) : ''].filter(Boolean).join(' ')

export function chordLinks(song: SongRef) {
  const links: { id: string; label: string; url: string; hint: string }[] = []
  if (song.artist && song.title) {
    links.push({
      id: 'cifraclub',
      label: 'Cifra Club',
      url: `https://www.cifraclub.com.br/${slugify(mainArtist(song.artist))}/${slugify(song.title)}/`,
      hint: 'Abre a página da música no Cifra Club',
    })
  }
  links.push({
    id: 'ultimate-guitar',
    label: 'Ultimate Guitar',
    url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${q(terms(song))}`,
    hint: 'Busca no Ultimate Guitar (inglês)',
  })
  links.push({
    id: 'web',
    label: 'Outros sites',
    url: `https://www.google.com/search?q=${q(`cifra ${terms(song)}`)}`,
    hint: 'Pesquisa a cifra na internet',
  })
  return links
}

export function youtubeSearchUrl(song: SongRef) {
  return `https://www.youtube.com/results?search_query=${q(terms(song))}`
}
