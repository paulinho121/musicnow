import clsx from 'clsx'
import { Lock, Play, Star } from 'lucide-react'
import { Link } from 'react-router'
import { useToggleFavorite } from '../lib/queries'
import type { SongListItem } from '../lib/types'
import { SelectBox } from './SelectionBar'
import { SongCover } from './SongCover'
import { UsageBadge } from './UsageBadge'

/** `select`: modo de seleção da lista (a linha vira uma caixinha de marcar). */
export function SongRow({ song, select }: { song: SongListItem; select?: { checked: boolean; disabled: boolean; onToggle: () => void } }) {
  const fav = useToggleFavorite()
  if (select)
    return (
      <button
        type="button"
        className={clsx(
          'flex w-full items-center gap-3 border-b border-border py-2.5 pr-3 pl-3 text-left transition last:border-b-0 sm:pl-4',
          select.checked ? 'bg-accent/10' : 'hover:bg-surface-2/60',
          select.disabled && 'cursor-not-allowed opacity-50',
        )}
        onClick={select.onToggle}
        disabled={select.disabled}
        aria-pressed={select.checked}
        title={select.disabled ? 'Só dá para excluir as músicas que você cadastrou' : undefined}
      >
        <SelectBox checked={select.checked} disabled={select.disabled} />
        <SongCover song={song} className="size-12 rounded-lg shadow-md shadow-black/30" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block leading-snug font-semibold break-words sm:truncate">{song.title}</span>
          <span className="block truncate text-sm text-muted">
            {select.disabled ? 'De outra pessoa' : [song.artist, song.style].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
    )
  return (
    <div className="group flex items-center gap-1 border-b border-border transition last:border-b-0 hover:bg-surface-2/60">
      <Link to={`/musicas/${song.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 sm:pl-4">
        <SongCover song={song} className="size-12 rounded-lg shadow-md shadow-black/30" />
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
        <UsageBadge usagePeople={song.usagePeople} usageSetlists={song.usageSetlists} compact className="shrink-0 text-xs" />
        {song.originalKey && (
          <span className="shrink-0 rounded-md bg-accent/12 px-2 py-0.5 font-mono text-xs font-bold text-chord" title="Tom original">
            {song.originalKey}
          </span>
        )}
      </Link>
      <button
        aria-label={song.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
        aria-pressed={song.isFavorite}
        onClick={() => fav.mutate({ id: song.id, value: !song.isFavorite })}
        className="grid size-12 shrink-0 place-items-center"
      >
        <Star className={clsx('size-5 transition', song.isFavorite ? 'fill-accent text-accent' : 'text-muted group-hover:text-text')} />
      </button>
    </div>
  )
}

/** Card com capa grande (carrosséis do início). */
export function SongCard({ song }: { song: SongListItem }) {
  return (
    <Link to={`/musicas/${song.id}`} className="group w-36 shrink-0 rounded-2xl p-2 transition hover:bg-surface sm:w-44">
      <div className="relative">
        <SongCover song={song} className="aspect-square w-full rounded-xl shadow-lg shadow-black/40" />
        <span className="absolute right-2 bottom-2 grid size-10 translate-y-1 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Play className="size-4 fill-current" />
        </span>
        {song.originalKey && (
          <span className="absolute top-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
            {song.originalKey}
          </span>
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold">{song.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{song.artist ?? 'Sem artista'}</p>
    </Link>
  )
}
