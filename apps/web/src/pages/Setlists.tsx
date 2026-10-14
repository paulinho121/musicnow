import { PERMISSIONS, SETLIST_STATUS } from '@ensaio/shared'
import clsx from 'clsx'
import {
  Archive,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  KeyRound,
  ListMusic,
  ListPlus,
  MapPin,
  Music2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { type CoverSong, SongCover } from '../components/SongCover'
import { PlaylistImport } from '../components/setlist/PlaylistImport'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { useLocalState } from '../lib/storage'
import { useSetlists } from '../lib/setlists'
import type { SetlistSummary } from '../lib/types'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const longFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export const STATUS_STYLE: Record<SetlistSummary['status'], string> = {
  rascunho: 'bg-surface-2 text-muted',
  ensaio: 'bg-sec-intro/15 text-sec-intro',
  pronto: 'bg-ok/15 text-ok',
  concluido: 'bg-surface-2 text-muted line-through decoration-1',
}

export function StatusChip({ status }: { status: SetlistSummary['status'] }) {
  return <span className={clsx('rounded-md px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>{SETLIST_STATUS[status]}</span>
}

export function roleLabel(role: SetlistSummary['role']) {
  return role === 'owner' ? 'Você lidera' : role === 'admin' ? 'Você administra' : `Convidado · ${PERMISSIONS[role].toLowerCase()}`
}

type Sort = 'data' | 'recentes' | 'nome'
type StatusFilter = SetlistSummary['status'] | 'todos'

const SORTS: Record<Sort, string> = { data: 'Por data do evento', recentes: 'Mexidos por último', nome: 'Por nome' }

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Quantos dias faltam (no calendário, não em horas): 0 = hoje. */
export function daysUntil(iso: string) {
  const d = new Date(iso)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const now = new Date()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((a - b) / 86_400_000)
}

export function whenLabel(iso: string) {
  const n = daysUntil(iso)
  if (n === 0) return 'Hoje'
  if (n === 1) return 'Amanhã'
  if (n > 1 && n <= 30) return `Em ${n} dias`
  if (n === -1) return 'Ontem'
  return null
}

export function Setlists() {
  const { data, isLoading, error, refetch } = useSetlists()
  const [showArchived, setShowArchived] = useState(false)
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [fromPlaylist, setFromPlaylist] = useState(false)
  const [q, setQ] = useState('')
  // Filtro e ordem ficam lembrados no aparelho.
  const [view, setView] = useLocalState<{ status: StatusFilter; sort: Sort }>('ef-setlists-view', { status: 'todos', sort: 'data' })
  const { status, sort } = view
  const setStatus = (v: StatusFilter) => setView((x) => ({ ...x, status: v }))
  const setSort = (v: Sort) => setView((x) => ({ ...x, sort: v }))
  const navigate = useNavigate()

  const join = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length >= 6) navigate(`/convite/${clean}`)
  }

  const all = data ?? []
  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return all.filter(
      (s) =>
        (status === 'todos' || s.status === status) &&
        words.every((w) => norm(`${s.name} ${s.location ?? ''} ${s.groupName ?? ''} ${s.ownerName}`).includes(w)),
    )
  }, [all, q, status])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sort === 'nome') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (sort === 'recentes') list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return list
  }, [filtered, sort])

  const now = Date.now() - 6 * 60 * 60 * 1000
  const active = sorted.filter((s) => !s.archived)
  const archived = sorted.filter((s) => s.archived)
  const upcoming = active.filter((s) => s.eventDate && new Date(s.eventDate).getTime() >= now)
  // Por data: próximos, sem data e anteriores. Nas outras ordens, uma lista só.
  const groups =
    sort === 'data'
      ? [
          { title: 'Próximos', items: upcoming },
          { title: 'Sem data', items: active.filter((s) => !s.eventDate) },
          { title: 'Anteriores', items: active.filter((s) => s.eventDate && new Date(s.eventDate).getTime() < now).reverse() },
        ].filter((g) => g.items.length)
      : [{ title: '', items: active }].filter((g) => g.items.length)

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { todos: 0, rascunho: 0, ensaio: 0, pronto: 0, concluido: 0 }
    for (const s of all) if (!s.archived) (c.todos++, c[s.status]++)
    return c
  }, [all])
  const totalUpcoming = all.filter((s) => !s.archived && s.eventDate && new Date(s.eventDate).getTime() >= now).length
  const filtering = q.trim() !== '' || status !== 'todos'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Repertórios</h1>
          {counts.todos > 0 && (
            <p className="text-sm text-muted">
              {counts.todos} {counts.todos === 1 ? 'repertório' : 'repertórios'}
              {totalUpcoming > 0 && ` · ${totalUpcoming} ${totalUpcoming === 1 ? 'evento marcado' : 'eventos marcados'}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setFromPlaylist(true)}
            title="Monte o repertório a partir de uma playlist do Deezer"
          >
            <ListPlus className="size-4" /> <span className="sm:hidden">Playlist</span>
            <span className="hidden sm:inline">Da playlist</span>
          </button>
          <Link to="/repertorios/novo" className="btn-primary">
            <Plus className="size-4" /> Novo
          </Link>
        </div>
      </div>
      <PlaylistImport open={fromPlaylist} onClose={() => setFromPlaylist(false)} />

      {counts.todos > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                className="input pr-9 pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, local ou banda"
                aria-label="Buscar repertório"
              />
              {q && (
                <button
                  className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-text"
                  onClick={() => setQ('')}
                  aria-label="Limpar busca"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
            <label className="relative sm:w-56">
              <select className="input appearance-none pr-9" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
                {(Object.keys(SORTS) as Sort[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </label>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Filtrar por status">
            {(['todos', 'rascunho', 'ensaio', 'pronto', 'concluido'] as StatusFilter[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={status === k}
                className={clsx('chip shrink-0', status === k && 'chip-on')}
                onClick={() => setStatus(k)}
                disabled={k !== 'todos' && counts[k] === 0}
              >
                {k === 'todos' ? 'Todos' : SETLIST_STATUS[k]}
                <span className="ml-1 text-xs opacity-70">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !all.length ? (
        <EmptyState
          icon={ListMusic}
          title="Nenhum repertório ainda"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to="/repertorios/novo" className="btn-primary">
                <Plus className="size-4" /> Criar o primeiro
              </Link>
              <button type="button" className="btn-ghost" onClick={() => setFromPlaylist(true)}>
                <ListPlus className="size-4" /> A partir de uma playlist
              </button>
            </div>
          }
        >
          Monte a ordem das músicas do culto, do show ou do ensaio, defina o tom de cada uma e convide a banda.
        </EmptyState>
      ) : (
        <>
          {groups.length === 0 && filtering && (
            <p className="card p-6 text-center text-sm text-muted">
              Nenhum repertório com esse filtro.{' '}
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setQ('')
                  setStatus('todos')
                }}
              >
                Limpar
              </button>
            </p>
          )}
          {groups.map((g) => (
            <section key={g.title || 'todos'}>
              {g.title && (
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                  {g.title} <span className="font-normal">({g.items.length})</span>
                </h2>
              )}
              <div className="grid gap-3 xl:grid-cols-2">
                {g.items.map((s) => (
                  <SetlistCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          ))}
          {archived.length > 0 && (
            <section>
              <button
                className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-text"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
              >
                <Archive className="size-4" /> Arquivados ({archived.length})
                <ChevronDown className={clsx('size-4 transition', showArchived && 'rotate-180')} />
              </button>
              {showArchived && (
                <div className="mt-3 grid gap-3 opacity-80 xl:grid-cols-2">
                  {archived.map((s) => (
                    <SetlistCard key={s.id} s={s} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Entrar com código: discreto, para quem recebeu o convite fora do link. */}
      <div className="pt-2">
        {showCode ? (
          <form onSubmit={join} className="card flex items-center gap-2 p-2 pl-4">
            <KeyRound className="size-4 shrink-0 text-muted" />
            <input
              className="h-10 min-w-0 flex-1 bg-transparent font-mono tracking-widest uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none"
              placeholder="Código do convite"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={12}
              autoFocus
              aria-label="Código de convite"
            />
            <button className="btn-ghost h-10" disabled={code.trim().length < 6}>
              Entrar
            </button>
          </form>
        ) : (
          <button className="flex items-center gap-2 text-sm text-muted hover:text-text" onClick={() => setShowCode(true)}>
            <KeyRound className="size-4" /> Recebeu um código de convite? Entrar com o código
          </button>
        )}
      </div>
    </div>
  )
}

/** Capa do repertório: as capas das 4 primeiras músicas (ou um ícone, se ainda não tem músicas). */
export function CoverMosaic({ songs, className = 'size-20 rounded-xl sm:size-24' }: { songs: CoverSong[]; className?: string }) {
  const box = clsx('shrink-0 overflow-hidden', className)
  if (songs.length >= 4)
    return (
      <div className={clsx(box, 'grid grid-cols-2')}>
        {songs.slice(0, 4).map((song, i) => (
          <SongCover key={i} song={song} className="aspect-square w-full rounded-none" />
        ))}
      </div>
    )
  if (songs.length) return <SongCover song={songs[0]} className={box} />
  return (
    <div className={clsx(box, 'grid place-items-center bg-surface-2 text-muted')}>
      <ListMusic className="size-8" />
    </div>
  )
}

export function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso)
  return (
    <div className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border text-center leading-none">
      <span className="w-full bg-accent/15 py-0.5 text-[10px] font-bold text-accent uppercase">{monthFmt.format(d).replace('.', '')}</span>
      <span className="py-1 text-lg font-extrabold tabular-nums">{d.getDate()}</span>
    </div>
  )
}

function SetlistCard({ s }: { s: SetlistSummary }) {
  const when = s.eventDate ? whenLabel(s.eventDate) : null
  const soon = s.eventDate ? daysUntil(s.eventDate) : null
  const extra = s.memberCount + 1 - s.people.length
  const pending = s.schedule?.mine === 'pendente'
  return (
    <Link
      to={`/repertorios/${s.id}`}
      className={clsx(
        'card group flex gap-4 p-3 transition hover:-translate-y-0.5 hover:border-accent/50 sm:p-4',
        pending && 'border-accent/60',
      )}
    >
      <CoverMosaic songs={s.songs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 leading-snug font-semibold group-hover:text-accent">{s.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {s.groupName ? `${s.groupName} · ` : ''}
              {s.role === 'owner' ? roleLabel(s.role) : `${s.ownerName.split(' ')[0]} lidera`}
            </p>
          </div>
          <StatusChip status={s.status} />
        </div>

        {s.eventDate && (
          <div className="mt-2 flex items-center gap-2.5">
            <DateBadge iso={s.eventDate} />
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
                <span className="first-letter:uppercase">{weekdayFmt.format(new Date(s.eventDate)).replace('.', '')}</span>
                <span className="text-muted">·</span> {timeFmt.format(new Date(s.eventDate))}
                {when && (
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap',
                      soon !== null && soon >= 0 && soon <= 1 ? 'bg-accent text-accent-ink' : 'bg-accent/15 text-accent',
                    )}
                  >
                    {when}
                  </span>
                )}
                {soon !== null && (soon > 30 || soon < -1) && <span className="text-muted">{longFmt.format(new Date(s.eventDate))}</span>}
              </p>
              {s.location && (
                <p className="flex items-center gap-1 truncate text-xs text-muted">
                  <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{s.location}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Music2 className="size-3.5" /> {s.itemCount} {s.itemCount === 1 ? 'música' : 'músicas'}
          </span>
          {s.schedule && (
            <span className={clsx('inline-flex items-center gap-1.5', pending ? 'font-semibold text-accent' : s.schedule.confirmed === s.schedule.total && 'text-ok')}>
              <CalendarCheck className="size-3.5" />
              {pending ? 'Confirme sua presença' : `${s.schedule.confirmed}/${s.schedule.total} confirmados`}
            </span>
          )}
          {!s.eventDate && !s.schedule && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Sem data
            </span>
          )}
          <span className="ml-auto flex items-center" aria-label={`${s.memberCount + 1} na banda`}>
            {s.people.map((p, i) => (
              <Avatar key={i} name={p.name} image={p.image} className="-ml-1.5 size-6 text-[10px] ring-2 ring-surface first:ml-0" />
            ))}
            {extra > 0 && (
              <span className="-ml-1.5 grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-bold ring-2 ring-surface">+{extra}</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  )
}
