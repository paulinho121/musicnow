import { chordLinks, youtubeSearchUrl, type SongRef } from '@ensaio/shared'
import { CirclePlay, ExternalLink } from 'lucide-react'

/**
 * Botões que abrem a cifra e a gravação nos sites de origem, numa nova aba.
 * O app não copia nada desses sites: o músico tira a música lá e guarda a versão dele aqui.
 */
export function FindLinks({ song, compact = false }: { song: SongRef; compact?: boolean }) {
  if (!song.title.trim()) return null
  const links = chordLinks(song)
  const cls = compact ? 'chip h-8 text-xs' : 'btn-ghost h-10 px-3 text-sm'
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className={cls} title={l.hint}>
          <ExternalLink className="size-3.5 text-accent" /> {l.label}
        </a>
      ))}
      <a href={youtubeSearchUrl(song)} target="_blank" rel="noopener noreferrer" className={cls} title="Procura a gravação no YouTube">
        <CirclePlay className="size-3.5 text-accent" /> YouTube
      </a>
    </div>
  )
}
