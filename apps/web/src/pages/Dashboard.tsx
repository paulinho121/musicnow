import { SETLIST_STATUS } from '@ensaio/shared'
import clsx from 'clsx'
import { CalendarDays, ChevronRight, Clock, FileUp, Globe, Guitar, ImagePlus, MapPin, Plus, Search, Star } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AgendaSummary } from '../components/AgendaSummary'
import { Avatar } from '../components/Avatar'
import { GettingStarted } from '../components/GettingStarted'
import { HeroBackground, HeroCustomizeDialog } from '../components/HeroBackground'
import { SongCover } from '../components/SongCover'
import { SongCard } from '../components/SongRow'
import { ErrorState, Skeleton } from '../components/ui'
import { useDashboard, useMe } from '../lib/queries'
import type { Dashboard as DashboardData } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "Hoje", "Amanhã", "Em 5 dias". */
function whenLabel(iso: string) {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(d) - start(new Date())) / 86_400_000)
  return days <= 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`
}

const ACTIONS = [
  { to: '/musicas/nova', label: 'Nova música', icon: Plus },
  { to: '/musicas/encontrar', label: 'Encontrar', icon: Globe },
  { to: '/musicas/importar', label: 'Importar', icon: FileUp },
  { to: '/acordes', label: 'Acordes', icon: Guitar },
]

export function Dashboard() {
  const { data: me } = useMe()
  const { data, isLoading, error, refetch } = useDashboard()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const heroImages = me?.heroImages ?? []

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/musicas?q=${encodeURIComponent(q.trim())}` : '/musicas')
  }
  const [next, ...later] = data?.upcoming ?? []

  return (
    <div className="space-y-9">
      {/* Destaque: saudação e busca, sobre as imagens da pessoa (ou o brilho na cor do app) */}
      <header
        className={clsx(
          'relative -mx-4 overflow-hidden px-4 md:mx-0 md:rounded-3xl md:border md:border-border md:bg-surface md:p-8',
          heroImages.length ? 'pt-24 pb-5 sm:pt-28 md:min-h-72 md:pt-16' : 'pt-2 pb-1',
        )}
      >
        {heroImages.length ? (
          <HeroBackground images={heroImages} />
        ) : (
          <>
            <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-10 size-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
          </>
        )}
        <button
          className="absolute top-3 right-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/35 px-3 text-xs font-medium text-white/90 backdrop-blur transition hover:bg-black/55 md:top-4 md:right-4"
          onClick={() => setCustomizing(true)}
        >
          <ImagePlus className="size-4" /> <span className="max-sm:sr-only">Personalizar</span>
        </button>
        <div className="relative">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Foto de perfil (toque para trocar no Perfil); sem foto, a inicial. */}
            {me && (
              <Link to="/perfil" aria-label="Seu perfil" className="shrink-0 rounded-full ring-2 ring-white/20 transition hover:ring-accent">
                <Avatar name={me.name} image={me.image} className="size-14 text-xl sm:size-16 sm:text-2xl" />
              </Link>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">{greeting()},</p>
              <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">{me?.name?.split(' ')[0] ?? '...'}</h1>
            </div>
          </div>
          {data && (
            <p className="mt-1 text-sm text-muted">
              {data.counts.library} {data.counts.library === 1 ? 'música' : 'músicas'} na sua biblioteca
              {data.upcoming.length > 0 && ` · ${data.upcoming.length} ${data.upcoming.length === 1 ? 'evento' : 'eventos'} pela frente`}
            </p>
          )}
          <form onSubmit={search} className="relative mt-5">
            <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="input h-13 rounded-2xl bg-bg/70 pl-12 text-base shadow-inner backdrop-blur"
              placeholder="Buscar música para tocar agora"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar música"
            />
          </form>
        </div>
      </header>
      <HeroCustomizeDialog images={heroImages} open={customizing} onClose={() => setCustomizing(false)} />

      <nav aria-label="Atalhos" className="grid grid-cols-4 gap-2 sm:gap-3">
        {ACTIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-1 py-3.5 text-center transition hover:-translate-y-0.5 hover:border-accent/40 sm:py-4"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-accent-ink">
              <Icon className="size-5" />
            </span>
            <span className="text-xs leading-tight font-semibold sm:text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      {data?.onboarding && <GettingStarted progress={data.onboarding} />}
      <AgendaSummary />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Section title="Próximo evento" icon={CalendarDays} more={{ to: '/repertorios', label: 'Repertórios' }}>
            {isLoading ? (
              <Skeleton className="h-40 rounded-3xl" />
            ) : next ? (
              <div className="space-y-2">
                <NextEvent event={next} />
                {later.map((s) => (
                  <Link key={s.id} to={`/repertorios/${s.id}`} className="card flex items-center gap-3 p-3 transition hover:bg-surface-2">
                    <Mosaic songs={s.songs} className="size-11 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="truncate text-sm text-muted">
                        {[s.eventDate && shortFmt.format(new Date(s.eventDate)), s.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                to="/repertorios/novo"
                className="card flex items-center gap-4 border-dashed p-5 transition hover:border-accent/50 hover:bg-surface-2"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">
                  <Plus className="size-6" />
                </span>
                <span>
                  <span className="block font-semibold">Nenhum evento marcado</span>
                  <span className="block text-sm text-muted">Monte o repertório do próximo culto, show ou ensaio e convide a banda.</span>
                </span>
              </Link>
            )}
          </Section>

          <Section title="Tocadas recentemente" icon={Clock}>
            <Carousel loading={isLoading} items={data?.recent} empty="As músicas que você abrir aparecem aqui." />
          </Section>

          <Section title="Favoritas" icon={Star} more={{ to: '/musicas?escopo=favorites', label: 'Ver todas' }}>
            <Carousel loading={isLoading} items={data?.favorites} empty="Toque na estrela de uma música para tê-la sempre à mão." />
          </Section>
        </>
      )}
    </div>
  )
}

type Upcoming = DashboardData['upcoming'][number]

/** O próximo evento em destaque: mosaico das capas, data e local. */
function NextEvent({ event: s }: { event: Upcoming }) {
  return (
    <Link
      to={`/repertorios/${s.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-border bg-surface p-4 transition hover:border-accent/50 sm:gap-5 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-accent/10 to-transparent" />
      <Mosaic songs={s.songs} className="size-24 rounded-2xl shadow-xl shadow-black/40 sm:size-28" />
      <div className="relative min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {s.eventDate && (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">{whenLabel(s.eventDate)}</span>
          )}
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{SETLIST_STATUS[s.status]}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-lg leading-tight font-bold sm:text-xl">{s.name}</p>
        {s.eventDate && (
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {dateFmt.format(new Date(s.eventDate))} · {timeFmt.format(new Date(s.eventDate))}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
          {s.location && (
            <>
              <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{s.location}</span> ·
            </>
          )}
          <span className="shrink-0">
            {s.songCount} {s.songCount === 1 ? 'música' : 'músicas'}
          </span>
        </p>
      </div>
      <ChevronRight className="relative hidden size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-text sm:block" />
    </Link>
  )
}

/** Até 4 capas em mosaico 2×2 (ou uma só, quando o repertório tem uma música). */
function Mosaic({ songs, className }: { songs: Upcoming['songs']; className?: string }) {
  if (songs.length === 0)
    return (
      <div className={`grid shrink-0 place-items-center bg-surface-2 text-muted ${className}`}>
        <CalendarDays className="size-1/3" />
      </div>
    )
  if (songs.length < 4) return <SongCover song={songs[0]} className={className} />
  return (
    <div className={`grid shrink-0 grid-cols-2 overflow-hidden ${className}`}>
      {songs.map((s, i) => (
        <SongCover key={i} song={s} className="aspect-square w-full rounded-none" />
      ))}
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
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Icon className="size-4 text-accent" /> {title}
        </h2>
        {more && (
          <Link to={more.to} className="text-sm font-medium text-muted hover:text-text">
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
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-36 shrink-0 space-y-2 p-2 sm:w-44">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  if (!items?.length) return <p className="card px-4 py-6 text-center text-sm text-muted">{empty}</p>
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-2 pb-1 [scrollbar-width:none] md:mx-0 md:-ml-2 md:px-0">
      {items.map((s) => (
        <SongCard key={s.id} song={s} />
      ))}
    </div>
  )
}
