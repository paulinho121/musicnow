import { CalendarDays, ChevronRight, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { brl, remainingOf, useGigs } from '../lib/gigs'

const whenFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Cartão do início: o próximo show da agenda e o cachê que ainda falta receber. */
export function AgendaSummary() {
  const { data: gigs } = useGigs()
  if (!gigs?.length) return null
  const now = new Date()
  const next = gigs.find((g) => g.status !== 'canceled' && new Date(g.startsAt) >= now)
  const pending = gigs.filter((g) => g.status !== 'canceled' && new Date(g.startsAt) < now).reduce((n, g) => n + remainingOf(g), 0)
  if (!next && !pending) return null

  return (
    <Link to="/agenda" className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 transition hover:border-accent/50">
      {next && (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <CalendarDays className="size-5 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block text-xs text-muted">Próximo show na agenda</span>
            <span className="block truncate font-semibold">
              {next.title} · <span className="capitalize">{whenFmt.format(new Date(next.startsAt))}</span>
            </span>
          </span>
        </span>
      )}
      {pending > 0 && (
        <span className="flex items-center gap-2 text-sm">
          <Wallet className="size-4 text-accent" />
          <b>{brl(pending)}</b> <span className="text-muted">a receber</span>
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  )
}
