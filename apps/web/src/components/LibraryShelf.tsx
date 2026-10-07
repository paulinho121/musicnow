import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Clock, Disc3, PencilLine, Star, Tags } from 'lucide-react'
import { type ReactNode, useMemo, useRef } from 'react'
import type { SongListItem } from '../lib/types'
import { SongCard, SongRow } from './SongRow'

const MIN_GROUP = 3
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const letterOf = (title: string) => {
  const c = norm(title).charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

/** Grupos com pelo menos 3 músicas (estilo ou artista), dos maiores para os menores. */
function groupsBy(songs: SongListItem[], pick: (s: SongListItem) => string | null, max: number) {
  const map = new Map<string, { label: string; songs: SongListItem[] }>()
  for (const s of songs) {
    const label = pick(s)?.trim()
    if (!label) continue
    const k = norm(label)
    const g = map.get(k) ?? { label, songs: [] }
    g.songs.push(s)
    map.set(k, g)
  }
  return [...map.values()]
    .filter((g) => g.songs.length >= MIN_GROUP)
    .sort((a, b) => b.songs.length - a.songs.length)
    .slice(0, max)
}

/**
 * Estante da biblioteca (sem busca): carrosséis por assunto e, embaixo, todas de A a Z com
 * índice de letras. Com busca ou filtro, a tela mostra a lista de resultados no lugar.
 */
export function LibraryShelf({ songs }: { songs: SongListItem[] }) {
  const shelves = useMemo(() => {
    const favorites = songs.filter((s) => s.isFavorite)
    const recent = [...songs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12)
    const incomplete = songs.filter((s) => !s.hasContent)
    return {
      favorites,
      recent,
      incomplete,
      styles: groupsBy(songs, (s) => s.style, 6),
      artists: groupsBy(songs, (s) => s.artist, 4),
    }
  }, [songs])

  const byLetter = useMemo(() => {
    const sorted = [...songs].sort((a, b) => norm(a.title).localeCompare(norm(b.title), 'pt-BR'))
    const map = new Map<string, SongListItem[]>()
    for (const s of sorted) map.set(letterOf(s.title), [...(map.get(letterOf(s.title)) ?? []), s])
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  }, [songs])

  // Biblioteca pequena: os carrosséis repetiriam a lista inteira; mostra só o A a Z.
  const showShelves = songs.length >= 8

  return (
    <div className="space-y-8">
      {showShelves && (
        <>
          {shelves.favorites.length > 0 && <Carousel title="Favoritas" icon={<Star className="size-4" />} songs={shelves.favorites} />}
          <Carousel title="Adicionadas recentemente" icon={<Clock className="size-4" />} songs={shelves.recent} />
          {shelves.styles.map((g) => (
            <Carousel key={`e-${g.label}`} title={g.label} icon={<Tags className="size-4" />} songs={g.songs} count />
          ))}
          {shelves.artists.map((g) => (
            <Carousel key={`a-${g.label}`} title={g.label} icon={<Disc3 className="size-4" />} songs={g.songs} count />
          ))}
          {shelves.incomplete.length > 0 && (
            <Carousel
              title="Para completar"
              hint="Entraram só com nome e tom: abra e escreva a cifra."
              icon={<PencilLine className="size-4" />}
              songs={shelves.incomplete}
              count
            />
          )}
        </>
      )}

      {/* Todas, de A a Z */}
      <section aria-labelledby="todas">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="todas" className="flex items-center gap-2 text-lg font-bold">
            Todas de A a Z <span className="text-sm font-normal text-muted">· {songs.length}</span>
          </h2>
        </div>
        {byLetter.length > 4 && (
          <nav
            aria-label="Ir para a letra"
            className="sticky top-[4.25rem] z-10 -mx-4 mb-3 flex gap-1 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur [scrollbar-width:none] md:mx-0 md:px-0"
          >
            {byLetter.map(([letter]) => (
              <a
                key={letter}
                href={`#letra-${letter}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(`letra-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border border-border px-2 font-mono text-sm font-bold text-muted transition hover:border-accent hover:text-accent"
              >
                {letter}
              </a>
            ))}
          </nav>
        )}
        <div className="card overflow-hidden">
          {byLetter.map(([letter, list]) => (
            <div key={letter}>
              <p
                id={`letra-${letter}`}
                className="scroll-mt-32 border-b border-border bg-surface-2/60 px-4 py-1.5 font-mono text-xs font-bold text-accent"
              >
                {letter}
              </p>
              {list.map((s) => (
                <SongRow key={s.id} song={s} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Carrossel horizontal: desliza no celular; setas no computador. */
function Carousel({
  title,
  icon,
  songs,
  hint,
  count,
}: {
  title: string
  icon: ReactNode
  songs: SongListItem[]
  hint?: string
  count?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="text-accent">{icon}</span>
            <span className="truncate">{title}</span>
            {count && <span className="text-sm font-normal text-muted">· {songs.length}</span>}
          </h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {songs.length > 4 && (
          <div className="hidden shrink-0 gap-1 md:flex">
            <button className="btn-icon size-9" onClick={() => scroll(-1)} aria-label={`Voltar em ${title}`}>
              <ChevronLeft className="size-4" />
            </button>
            <button className="btn-icon size-9" onClick={() => scroll(1)} aria-label={`Avançar em ${title}`}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={ref}
        className={clsx(
          '-mx-4 flex snap-x gap-1 overflow-x-auto scroll-smooth px-2 pb-1 [scrollbar-width:none] md:mx-0 md:-ml-2 md:px-0',
          '*:snap-start',
        )}
      >
        {songs.map((s) => (
          <SongCard key={s.id} song={s} />
        ))}
      </div>
    </section>
  )
}
