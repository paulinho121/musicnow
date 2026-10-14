import { INSTRUMENTS } from '@ensaio/shared'
import clsx from 'clsx'
import { CalendarCheck, CalendarX, Check, Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import {
  STATUS_LABEL,
  useAddUnavailability,
  useMySchedule,
  useRemoveUnavailability,
  useRespond,
  useUnavailability,
  type MyAssignment,
} from '../lib/schedule'
import { useToast } from './ui'

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })

function useAnswer() {
  const respond = useRespond()
  const toast = useToast()
  const answer = (a: MyAssignment, status: 'confirmado' | 'recusado') => {
    const note = status === 'recusado' ? prompt(`Avisar que você não pode em "${a.setlistName}". Quer deixar um recado? (opcional)`, '') : null
    if (status === 'recusado' && note === null) return
    respond.mutate(
      { setlistId: a.setlistId, status, note },
      {
        onSuccess: () => toast(status === 'confirmado' ? 'Presença confirmada.' : 'Avisamos que você não pode.'),
        onError: (e) => toast(e.message, 'error'),
      },
    )
  }
  return { answer, busy: respond.isPending }
}

function AssignmentRow({ a, compact = false }: { a: MyAssignment; compact?: boolean }) {
  const { answer, busy } = useAnswer()
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <Link to={`/repertorios/${a.setlistId}?aba=escala`} className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.setlistName}</p>
        <p className="text-xs text-muted">
          {a.eventDate ? dayFmt.format(new Date(a.eventDate)) : 'Sem data'}
          {a.instrument && ` · ${INSTRUMENTS[a.instrument]}`}
          {!compact && ` · ${a.leaderName}`}
        </p>
      </Link>
      {a.status === 'pendente' || !compact ? (
        <div className="flex gap-1.5">
          <button
            className={clsx('btn-ghost h-9 px-3 text-sm', a.status === 'confirmado' && 'border-ok/50 text-ok')}
            onClick={() => answer(a, 'confirmado')}
            disabled={busy}
            aria-label={`Confirmar presença em ${a.setlistName}`}
          >
            <Check className="size-4" /> {a.status === 'confirmado' ? 'Confirmado' : 'Confirmo'}
          </button>
          <button
            className={clsx('btn-ghost h-9 px-3 text-sm', a.status === 'recusado' && 'border-danger/50 text-danger')}
            onClick={() => answer(a, 'recusado')}
            disabled={busy}
            aria-label={`Não posso tocar em ${a.setlistName}`}
          >
            <X className="size-4" /> {a.status === 'recusado' ? 'Não posso' : 'Não'}
          </button>
        </div>
      ) : (
        <span className="text-xs text-muted">{STATUS_LABEL[a.status]}</span>
      )}
    </li>
  )
}

/** Início: as escalas que ainda esperam resposta (some quando não há nenhuma). */
export function PendingSchedule() {
  const { data } = useMySchedule()
  const pending = (data ?? []).filter((a) => a.status === 'pendente')
  if (!pending.length) return null
  return (
    <section className="rounded-2xl border border-accent/40 bg-accent/10">
      <p className="flex items-center gap-2 px-4 pt-4 font-semibold">
        <CalendarCheck className="size-5 text-accent" />
        {pending.length === 1 ? 'Você foi escalado: confirme se pode tocar' : `Você foi escalado em ${pending.length} eventos: confirme se pode tocar`}
      </p>
      <ul className="divide-y divide-border/60">
        {pending.map((a) => (
          <AssignmentRow key={a.setlistId} a={a} compact />
        ))}
      </ul>
    </section>
  )
}

/** Agenda: minhas escalas e as datas em que não posso tocar. */
export function ScheduleSection() {
  const { data: mine } = useMySchedule()
  return (
    <div className="space-y-6">
      {mine && mine.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CalendarCheck className="size-5 text-accent" /> Minhas escalas
          </h2>
          <ul className="card divide-y divide-border">
            {mine.map((a) => (
              <AssignmentRow key={a.setlistId} a={a} />
            ))}
          </ul>
        </section>
      )}
      <UnavailabilityCard />
    </div>
  )
}

function UnavailabilityCard() {
  const { data } = useUnavailability()
  const add = useAddUnavailability()
  const remove = useRemoveUnavailability()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [note, setNote] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!startsOn) return
    add.mutate(
      { startsOn, endsOn: endsOn || startsOn, note: note.trim() || null },
      {
        onSuccess: () => {
          setStartsOn('')
          setEndsOn('')
          setNote('')
          toast('Anotado: quem monta a escala vai ver que você não pode.')
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  const range = (s: string, e: string) => {
    const a = dateFmt.format(new Date(`${s}T00:00:00Z`))
    return s === e ? a : `${a} a ${dateFmt.format(new Date(`${e}T00:00:00Z`))}`
  }

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarX className="size-5 text-accent" /> Datas em que não posso tocar
      </h2>
      <p className="mt-0.5 text-sm text-muted">Quem monta a escala da banda vê o aviso e evita te escalar nesses dias.</p>
      {data && data.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.map((u) => (
            <li key={u.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="font-medium">{range(u.startsOn, u.endsOn)}</span>
              {u.note && <span className="truncate text-muted">· {u.note}</span>}
              <button
                className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                aria-label="Apagar esta data"
                onClick={() => remove.mutate(u.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
        <label className="text-xs text-muted">
          De
          <input type="date" className="input mt-1" min={today} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
        </label>
        <label className="text-xs text-muted">
          Até (opcional)
          <input type="date" className="input mt-1" min={startsOn || today} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Motivo (opcional)
          <input className="input mt-1" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Viagem, trabalho..." />
        </label>
        <button className="btn-primary self-end" disabled={!startsOn || add.isPending}>
          <Plus className="size-4" /> Anotar
        </button>
      </form>
    </section>
  )
}
