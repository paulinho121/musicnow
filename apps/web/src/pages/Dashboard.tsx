import { SETLIST_STATUS } from '@ensaio/shared'
import { CalendarDays, Clock, Plus, Search, Star } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { SongCard } from '../components/SongRow'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { useDashboard, useMe } from '../lib/queries'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Dashboard() {
  const { data: me } = useMe()
  const { data, isLoading, error, refetch } = useDashboard()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/musicas?q=${encodeURIComponent(q.trim())}` : '/musicas')
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="text-2xl font-bold">{me?.name?.split(' ')[0] ?? '...'}</h1>
      </header>

      <form onSubmit={search} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className="input h-12 pl-10"
          placeholder="Buscar música para tocar agora"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar música"
        />
      </form>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Section title="Próximos ensaios e apresentações" icon={CalendarDays}>
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : data?.upcoming.length ? (
              <div className="card divide-y divide-border">
                {data.upcoming.map((s) => (
                  <Link key={s.id} to={`/repertorios/${s.id}`} className="flex items-center gap-3 p-4 transition hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="truncate text-sm text-muted">
                        {[s.eventDate && dateFmt.format(new Date(s.eventDate)), s.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="chip h-7 text-xs">{SETLIST_STATUS[s.status]}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum evento marcado"
                action={
                  <Link to="/repertorios/novo" className="btn-primary">
                    <Plus className="size-4" /> Criar repertório
                  </Link>
                }
              >
                Monte o repertório do próximo culto, show ou ensaio e convide a banda.
              </EmptyState>
            )}
          </Section>

          <Section title="Tocadas recentemente" icon={Clock}>
            <Carousel loading={isLoading} items={data?.recent} empty="As músicas que você abrir aparecem aqui." />
          </Section>

          <Section title="Favoritas" icon={Star} more={{ to: '/musicas?escopo=favorites', label: 'Ver todas' }}>
            <Carousel loading={isLoading} items={data?.favorites} empty="Toque na estrela de uma música para tê-la sempre à mão." />
          </Section>

          {data && (
            <div className="grid grid-cols-2 gap-3">
              <Link to="/musicas?escopo=mine" className="card p-4 transition hover:border-accent/50">
                <p className="text-2xl font-bold">{data.counts.mySongs}</p>
                <p className="text-sm text-muted">músicas cadastradas por você</p>
              </Link>
              <Link to="/musicas/nova" className="card flex flex-col justify-between p-4 transition hover:border-accent/50">
                <Plus className="size-6 text-accent" />
                <p className="text-sm font-semibold">Cadastrar música</p>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  more,
  children,
}: {
  title: string
  icon: typeof Star
  more?: { to: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-accent" /> {title}
        </h2>
        {more && (
          <Link to={more.to} className="text-sm text-muted hover:text-text">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Carousel({ loading, items, empty }: { loading: boolean; items?: Parameters<typeof SongCard>[0]['song'][]; empty: string }) {
  if (loading)
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-44 shrink-0" />
        ))}
      </div>
    )
  if (!items?.length) return <p className="card px-4 py-6 text-center text-sm text-muted">{empty}</p>
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {items.map((s) => (
        <SongCard key={s.id} song={s} />
      ))}
    </div>
  )
}
