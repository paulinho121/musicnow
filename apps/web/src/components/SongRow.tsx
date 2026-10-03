import clsx from 'clsx'
import { Lock, Star } from 'lucide-react'
import { Link } from 'react-router'
import { useToggleFavorite } from '../lib/queries'
import type { SongListItem } from '../lib/types'
import { KeyBadge } from './ui'

export function SongRow({ song }: { song: SongListItem }) {
  const fav = useToggleFavorite()
  return (
    <div className="flex items-center gap-2 border-b border-border last:border-b-0">
      <Link to={`/musicas/${song.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
        <KeyBadge value={song.originalKey} className="shrink-0" />
        <div className="min-w-0 flex-1">
          {/* Celular: o nome pode ocupar 2 linhas em vez de ser cortado. */}
          <p className="line-clamp-2 leading-snug font-semibold break-words sm:truncate">
            {song.title}
            {song.visibility === 'private' && <Lock aria-label="Privada" className="ml-1.5 inline size-3.5 align-[-2px] text-muted" />}
          </p>
          <p className="truncate text-sm text-muted">
            {[song.artist, song.style, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>
      <button
        aria-label={song.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
        aria-pressed={song.isFavorite}
        onClick={() => fav.mutate({ id: song.id, value: !song.isFavorite })}
        className="grid size-12 shrink-0 place-items-center"
      >
        <Star className={clsx('size-5', song.isFavorite ? 'fill-accent text-accent' : 'text-muted')} />
      </button>
    </div>
  )
}

export function SongCard({ song }: { song: SongListItem }) {
  return (
    <Link
      to={`/musicas/${song.id}`}
      className="card flex w-44 shrink-0 flex-col gap-3 p-4 transition hover:border-accent/50"
    >
      <KeyBadge value={song.originalKey} className="self-start" />
      <div className="min-w-0">
        <p className="line-clamp-2 font-semibold leading-snug">{song.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted">{song.artist}</p>
      </div>
    </Link>
  )
}
