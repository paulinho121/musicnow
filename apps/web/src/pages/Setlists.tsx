import { PERMISSIONS, SETLIST_STATUS } from '@ensaio/shared'
import clsx from 'clsx'
import { Archive, CalendarDays, KeyRound, ListMusic, MapPin, Music2, Plus, Users } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { useSetlists } from '../lib/setlists'
import type { SetlistSummary } from '../lib/types'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

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

export function Setlists() {
  const { data, isLoading, error, refetch } = useSetlists()
  const [showArchived, setShowArchived] = useState(false)
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  const join = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length >= 6) navigate(`/convite/${clean}`)
  }

  const now = Date.now() - 6 * 60 * 60 * 1000
  const active = (data ?? []).filter((s) => !s.archived)
  const groups = [
    { title: 'Próximos', items: active.filter((s) => s.eventDate && new Date(s.eventDate).getTime() >= now) },
    { title: 'Sem data', items: active.filter((s) => !s.eventDate) },
    {
      title: 'Anteriores',
      items: active.filter((s) => s.eventDate && new Date(s.eventDate).getTime() < now).reverse(),
    },
  ].filter((g) => g.items.length)
  const archived = (data ?? []).filter((s) => s.archived)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Repertórios</h1>
        <Link to="/repertorios/novo" className="btn-primary">
          <Plus className="size-4" /> Novo
        </Link>
      </div>

      <form onSubmit={join} className="card flex items-center gap-2 p-2 pl-4">
        <KeyRound className="size-4 shrink-0 text-muted" />
        <input
          className="h-10 min-w-0 flex-1 bg-transparent font-mono tracking-widest uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none"
          placeholder="Recebeu um código? Digite aqui"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={12}
          aria-label="Código de convite"
        />
        <button className="btn-ghost h-10" disabled={code.trim().length < 6}>
          Entrar
        </button>
      </form>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !active.length && !archived.length ? (
        <EmptyState
          icon={ListMusic}
          title="Nenhum repertório ainda"
          action={
            <Link to="/repertorios/novo" className="btn-primary">
              <Plus className="size-4" /> Criar o primeiro
            </Link>
          }
        >
          Monte a ordem das músicas do culto, do show ou do ensaio, defina o tom de cada uma e convide a banda.
        </EmptyState>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{g.title}</h2>
              <div className="space-y-3">
                {g.items.map((s) => (
                  <SetlistCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          ))}
          {archived.length > 0 && (
            <section>
              <button className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-text" onClick={() => setShowArchived((v) => !v)}>
                <Archive className="size-4" /> Arquivados ({archived.length})
              </button>
              {showArchived && (
                <div className="mt-3 space-y-3 opacity-80">
                  {archived.map((s) => (
                    <SetlistCard key={s.id} s={s} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SetlistCard({ s }: { s: SetlistSummary }) {
  return (
    <Link to={`/repertorios/${s.id}`} className="card block p-4 transition hover:border-accent/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="mt-0.5 text-xs text-muted">{roleLabel(s.role)}</p>
        </div>
        <StatusChip status={s.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {s.eventDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" /> {dateFmt.format(new Date(s.eventDate))}
          </span>
        )}
        {s.location && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="size-4 shrink-0" /> <span className="truncate">{s.location}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Music2 className="size-4" /> {s.itemCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" /> {s.memberCount + 1}
        </span>
      </div>
    </Link>
  )
}
