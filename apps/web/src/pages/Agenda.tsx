import clsx from 'clsx'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Undo2,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { GigDialog } from '../components/GigDialog'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../components/ui'
import { brl, downloadIcs, type Gig, googleCalendarUrl, mapsUrl, useGigPaid, useGigs, whatsappOf } from '../lib/gigs'

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth()
const fromKey = (k: number) => new Date(Math.floor(k / 12), k % 12, 1)

/** Soma de um grupo de shows (cancelados não contam). */
function totals(gigs: Gig[]) {
  const valid = gigs.filter((g) => g.status !== 'canceled')
  const sum = (f: (g: Gig) => boolean) => valid.filter(f).reduce((n, g) => n + (g.feeCents ?? 0), 0)
  return {
    shows: valid.length,
    combined: sum(() => true),
    received: sum((g) => Boolean(g.paidAt)),
    pending: sum((g) => !g.paidAt),
  }
}

/** Agenda do músico: shows por mês, cachê combinado, recebido e a receber. */
export function Agenda() {
  const { data: gigs, isLoading, error, refetch } = useGigs()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [editing, setEditing] = useState<Gig | 'new' | null>(null)

  const inMonth = useMemo(() => (gigs ?? []).filter((g) => monthKey(new Date(g.startsAt)) === month), [gigs, month])
  const sum = totals(inMonth)
  // Shows que já passaram e o cachê ainda não caiu (de qualquer mês).
  const overdue = useMemo(
    () => (gigs ?? []).filter((g) => g.status !== 'canceled' && !g.paidAt && (g.feeCents ?? 0) > 0 && new Date(g.startsAt) < new Date()),
    [gigs],
  )
  const overdueTotal = overdue.reduce((n, g) => n + (g.feeCents ?? 0), 0)

  if (isLoading) return <PageSpinner />
  if (error || !gigs) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Agenda</h1>
          <p className="text-sm text-muted">Seus shows e cachês. Só você vê.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Novo show
        </button>
      </div>

      {overdue.length > 0 && (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Wallet className="size-5 text-accent" /> {brl(overdueTotal)} a receber de {overdue.length}{' '}
            {overdue.length === 1 ? 'show que já passou' : 'shows que já passaram'}
          </p>
          <ul className="mt-2 space-y-1.5">
            {overdue.slice(0, 5).map((g) => (
              <OverdueRow key={g.id} g={g} />
            ))}
          </ul>
        </section>
      )}

      {/* Mês */}
      <div className="flex items-center justify-between gap-2">
        <button className="btn-icon" onClick={() => setMonth((m) => m - 1)} aria-label="Mês anterior">
          <ChevronLeft className="size-5" />
        </button>
        <button className="text-lg font-bold" onClick={() => setMonth(monthKey(new Date()))} title="Voltar para este mês">
          {/* "outubro de 2026" → "Outubro de 2026" (só a primeira letra) */}
          {monthFmt.format(fromKey(month)).replace(/^./, (c) => c.toUpperCase())}
        </button>
        <button className="btn-icon" onClick={() => setMonth((m) => m + 1)} aria-label="Próximo mês">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Shows" value={String(sum.shows)} />
        <Stat label="Combinado" value={brl(sum.combined)} />
        <Stat label="Recebido" value={brl(sum.received)} tone="ok" />
        <Stat label="A receber" value={brl(sum.pending)} tone={sum.pending ? 'accent' : undefined} />
      </div>

      {inMonth.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum show neste mês">
          {gigs.length === 0
            ? 'Anote seus shows e apresentações com o cachê combinado: o app soma quanto você tem a receber.'
            : 'Use as setas para ver outros meses ou anote um show novo.'}
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {inMonth.map((g) => (
            <GigCard key={g.id} g={g} onEdit={() => setEditing(g)} />
          ))}
        </ol>
      )}

      <GigDialog gig={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'accent' }) {
  return (
    <div className="card p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('mt-0.5 text-lg font-extrabold tracking-tight', tone === 'ok' && 'text-ok', tone === 'accent' && 'text-accent')}>
        {value}
      </p>
    </div>
  )
}

function PaidButton({ g, small = false }: { g: Gig; small?: boolean }) {
  const paid = useGigPaid()
  const toast = useToast()
  const isPaid = Boolean(g.paidAt)
  return (
    <button
      className={clsx(
        small ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
        'btn',
        isPaid ? 'border border-border text-muted hover:bg-surface-2' : 'bg-ok text-white hover:brightness-110',
      )}
      disabled={paid.isPending}
      onClick={() =>
        paid.mutate(
          { id: g.id, paid: !isPaid },
          {
            onSuccess: () => toast(isPaid ? 'Voltou para "a receber".' : `Cachê de ${brl(g.feeCents ?? 0)} recebido!`),
            onError: (e) => toast(e.message, 'error'),
          },
        )
      }
    >
      {isPaid ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}
      {isPaid ? 'Desfazer' : 'Recebi'}
    </button>
  )
}

function OverdueRow({ g }: { g: Gig }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="min-w-0 flex-1 truncate">
        <b>{brl(g.feeCents ?? 0)}</b> · {g.title} <span className="text-muted">({shortFmt.format(new Date(g.startsAt))})</span>
      </span>
      <PaidButton g={g} small />
    </li>
  )
}

function GigCard({ g, onEdit }: { g: Gig; onEdit: () => void }) {
  const d = new Date(g.startsAt)
  const past = d < new Date()
  const wa = whatsappOf(g.contact)
  const canceled = g.status === 'canceled'
  return (
    <li className={clsx('card flex gap-4 p-4', (canceled || (past && g.paidAt)) && 'opacity-60')}>
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 py-2 text-center">
        <span className="text-2xl leading-none font-extrabold">{dayFmt.format(d)}</span>
        <span className="mt-1 text-xs text-muted capitalize">{weekdayFmt.format(d).replace('.', '')}</span>
        <span className="text-xs font-semibold">{timeFmt.format(d)}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={clsx('font-bold', canceled && 'line-through')}>{g.title}</p>
            <p className="truncate text-sm text-muted">{[g.location, g.contractor].filter(Boolean).join(' · ') || 'Sem local'}</p>
          </div>
          <div className="text-right">
            {g.feeCents != null && <p className="font-extrabold">{brl(g.feeCents)}</p>}
            <p
              className={clsx(
                'text-xs font-semibold',
                canceled
                  ? 'text-muted'
                  : g.status === 'tentative'
                    ? 'text-muted'
                    : g.paidAt
                      ? 'text-ok'
                      : g.feeCents
                        ? 'text-accent'
                        : 'text-muted',
              )}
            >
              {canceled
                ? 'Cancelado'
                : g.status === 'tentative'
                  ? 'A confirmar'
                  : g.paidAt
                    ? 'Recebido'
                    : g.feeCents
                      ? 'A receber'
                      : 'Confirmado'}
            </p>
          </div>
        </div>
        {g.notes && <p className="line-clamp-2 text-sm text-muted">{g.notes}</p>}
        <div className="flex flex-wrap gap-1.5">
          {!canceled && (g.feeCents ?? 0) > 0 && <PaidButton g={g} small />}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="chip h-8 text-xs" title="Conversar com o contratante">
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          )}
          {g.location && (
            <a href={mapsUrl(g.location)} target="_blank" rel="noreferrer" className="chip h-8 text-xs">
              <MapPin className="size-3.5" /> Mapa
            </a>
          )}
          {g.setlistId && (
            <Link to={`/repertorios/${g.setlistId}`} className="chip h-8 max-w-48 text-xs">
              <ListMusic className="size-3.5 shrink-0" /> <span className="truncate">{g.setlistName ?? 'Repertório'}</span>
            </Link>
          )}
          {!past && !canceled && <CalendarMenu g={g} />}
          <button className="chip h-8 text-xs" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </button>
        </div>
      </div>
    </li>
  )
}

/** Levar o show para o calendário do celular ou do Google. */
function CalendarMenu({ g }: { g: Gig }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button className="chip h-8 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarPlus className="size-3.5" /> Calendário
      </button>
      {open && (
        <span className="absolute top-9 left-0 z-20 flex w-52 flex-col rounded-xl border border-border bg-surface p-1 shadow-xl">
          <a
            href={googleCalendarUrl(g)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            Google Agenda
          </a>
          <button
            className="rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              downloadIcs(g)
              setOpen(false)
            }}
          >
            iPhone, Android ou Outlook (.ics)
          </button>
        </span>
      )}
    </span>
  )
}
