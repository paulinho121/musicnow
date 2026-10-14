import { INSTRUMENTS, type Instrument } from '@ensaio/shared'
import clsx from 'clsx'
import { CalendarX, Check, CircleHelp, MessageCircle, UserMinus, UserPlus, X } from 'lucide-react'
import { useSession } from '../../lib/auth'
import {
  STATUS_LABEL,
  useAssign,
  useRespond,
  useSetlistSchedule,
  useUnassign,
  type Assignment,
  type AssignmentStatus,
} from '../../lib/schedule'
import { whatsappUrl } from '../../lib/setlists'
import type { SetlistDetail } from '../../lib/types'
import { Avatar } from '../Avatar'
import { ErrorState, PageSpinner, useToast } from '../ui'

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  pendente: 'bg-surface-2 text-muted',
  confirmado: 'bg-ok/15 text-ok',
  recusado: 'bg-danger/15 text-danger',
}
const STATUS_ICON = { pendente: CircleHelp, confirmado: Check, recusado: X }

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Texto da escala para mandar no grupo da banda. */
function scheduleText(setlist: SetlistDetail, eventDate: string | null, list: Assignment[]) {
  const head = `*Escala: ${setlist.name}*${eventDate ? `\n${dayFmt.format(new Date(eventDate))}` : ''}${setlist.location ? `\n${setlist.location}` : ''}`
  const mark = { confirmado: '✅', pendente: '⏳', recusado: '❌' }
  const lines = list.map((a) => `${mark[a.status]} ${a.name}${a.instrument ? ` (${INSTRUMENTS[a.instrument]})` : ''}`)
  return `${head}\n\n${lines.join('\n')}\n\nConfirme no app: ${location.origin}/repertorios/${setlist.id}?aba=escala`
}

export function SchedulePanel({ setlist }: { setlist: SetlistDetail }) {
  const { data: session } = useSession()
  const uid = session?.user.id
  const { data, isLoading, error, refetch } = useSetlistSchedule(setlist.id)
  const assign = useAssign(setlist.id)
  const unassign = useUnassign(setlist.id)
  const respond = useRespond()
  const toast = useToast()

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />

  const mine = data.assignments.find((a) => a.userId === uid)
  const assigned = new Set(data.assignments.map((a) => a.userId))
  const count = (s: AssignmentStatus) => data.assignments.filter((a) => a.status === s).length
  const fail = (e: Error) => toast(e.message, 'error')

  const answer = (status: 'confirmado' | 'recusado') => {
    // "Não posso" pede um recado opcional; cancelar a caixa desiste da resposta.
    const note = status === 'recusado' ? prompt('Avisar que você não pode tocar. Quer deixar um recado? (opcional)', '') : null
    if (status === 'recusado' && note === null) return
    respond.mutate(
      { setlistId: setlist.id, status, note },
      { onSuccess: () => toast(status === 'confirmado' ? 'Presença confirmada.' : 'Avisamos que você não pode.'), onError: fail },
    )
  }

  return (
    <div className="space-y-5">
      {mine && (
        <section className={clsx('card p-4', mine.status === 'pendente' && 'border-accent/60')}>
          <p className="font-semibold">
            Você está escalado{mine.instrument ? ` no ${INSTRUMENTS[mine.instrument].toLowerCase()}` : ''}
            {data.eventDate && <span className="font-normal text-muted"> · {dayFmt.format(new Date(data.eventDate))}</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {mine.status === 'pendente' ? 'Responda para a banda saber se pode contar com você.' : `Sua resposta: ${STATUS_LABEL[mine.status]}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={clsx(mine.status === 'confirmado' ? 'btn-primary' : 'btn-ghost')}
              onClick={() => answer('confirmado')}
              disabled={respond.isPending}
            >
              <Check className="size-4" /> Confirmo
            </button>
            <button
              className={clsx('btn-ghost', mine.status === 'recusado' && 'text-danger')}
              onClick={() => answer('recusado')}
              disabled={respond.isPending}
            >
              <X className="size-4" /> Não posso
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted">
            Escalados ({data.assignments.length})
            {data.assignments.length > 0 && (
              <span className="font-normal">
                {' '}
                · {count('confirmado')} confirmados · {count('pendente')} aguardando · {count('recusado')} não podem
              </span>
            )}
          </h3>
          {data.canEdit && data.assignments.length > 0 && (
            <a
              className="btn-ghost h-9 text-sm"
              href={whatsappUrl(scheduleText(setlist, data.eventDate, data.assignments))}
              target="_blank"
              rel="noopener"
            >
              <MessageCircle className="size-4" /> Mandar no grupo
            </a>
          )}
        </div>
        {data.assignments.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            {data.canEdit ? 'Ninguém escalado ainda. Escolha abaixo quem toca.' : 'A escala ainda não foi montada.'}
          </p>
        ) : (
          <ul className="card divide-y divide-border">
            {data.assignments.map((a) => {
              const Icon = STATUS_ICON[a.status]
              return (
                <li key={a.userId} className="flex flex-wrap items-center gap-3 p-3">
                  <Avatar name={a.name} image={a.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {a.name}
                      {a.userId === uid && <span className="text-xs font-normal text-muted"> (você)</span>}
                    </p>
                    {data.canEdit ? (
                      <InstrumentSelect
                        value={a.instrument}
                        label={`Instrumento de ${a.name}`}
                        onChange={(instrument) => assign.mutate({ userId: a.userId, instrument }, { onError: fail })}
                      />
                    ) : (
                      <p className="text-xs text-muted">{a.instrument ? INSTRUMENTS[a.instrument] : 'Instrumento a definir'}</p>
                    )}
                    {a.note && <p className="mt-0.5 text-xs text-muted">“{a.note}”</p>}
                    {a.unavailable && a.status !== 'confirmado' && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
                        <CalendarX className="size-3.5" /> Avisou que não pode nesta data: {a.unavailable}
                      </p>
                    )}
                  </div>
                  <span className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[a.status])}>
                    <Icon className="size-3.5" /> {STATUS_LABEL[a.status]}
                  </span>
                  {data.canEdit && (
                    <button
                      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label={`Tirar ${a.name} da escala`}
                      onClick={() => unassign.mutate(a.userId, { onError: fail })}
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {data.canEdit && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">Quem pode ser escalado</h3>
          {!data.eventDate && (
            <p className="mb-2 text-xs text-muted">Coloque a data no repertório para ver quem avisou que não pode nesse dia.</p>
          )}
          <ul className="card divide-y divide-border">
            {data.people
              .filter((p) => !assigned.has(p.userId))
              .map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center gap-3 p-3">
                  <Avatar name={p.name} image={p.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.name}
                      {p.userId === uid && <span className="text-xs font-normal text-muted"> (você)</span>}
                    </p>
                    <p className="text-xs text-muted">{p.instrument ? INSTRUMENTS[p.instrument] : 'Instrumento não informado'}</p>
                    {p.unavailable && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
                        <CalendarX className="size-3.5" /> Não pode nesta data: {p.unavailable}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn-ghost h-9 text-sm"
                    onClick={() =>
                      assign.mutate(
                        { userId: p.userId, instrument: p.instrument },
                        { onSuccess: () => toast(p.userId === uid ? 'Você está na escala.' : `${p.name.split(' ')[0]} está na escala. Avisamos por e-mail.`), onError: fail },
                      )
                    }
                  >
                    <UserPlus className="size-4" /> Escalar
                  </button>
                </li>
              ))}
            {data.people.every((p) => assigned.has(p.userId)) && (
              <li className="p-3 text-sm text-muted">Todos os músicos do repertório já estão na escala.</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted">Para escalar outra pessoa, convide-a primeiro na aba Banda.</p>
        </section>
      )}
    </div>
  )
}

function InstrumentSelect({ value, label, onChange }: { value: Instrument | null; label: string; onChange: (i: Instrument | null) => void }) {
  return (
    <select
      className="mt-0.5 h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as Instrument | null)}
      aria-label={label}
    >
      <option value="">Instrumento...</option>
      {(Object.keys(INSTRUMENTS) as Instrument[]).map((i) => (
        <option key={i} value={i}>
          {INSTRUMENTS[i]}
        </option>
      ))}
    </select>
  )
}
