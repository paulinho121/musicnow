import { parseBRL } from '@ensaio/shared'
import clsx from 'clsx'
import { Check, Clock, MapPin, MessageCircle, Pencil, Phone, Plus, Trash2, Wallet } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useSession } from '../../lib/auth'
import { brl, mapsUrl, whatsappOf } from '../../lib/gigs'
import {
  type Rehearsal,
  type RehearsalInput,
  useDeleteRehearsal,
  useRehearsals,
  useSavedStudios,
  useSaveRehearsal,
  useSharePaid,
} from '../../lib/rehearsals'
import { whatsappUrl } from '../../lib/setlists'
import type { SetlistDetail } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Sheet } from '../Sheet'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../ui'

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const money = (cents: number | null) => (cents != null ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')

/** Texto do ensaio para o grupo da banda, com quanto cada um paga. */
function rehearsalText(setlist: SetlistDetail, r: Rehearsal) {
  const end = new Date(new Date(r.startsAt).getTime() + r.durationMin * 60_000)
  const lines = [
    `*Ensaio: ${setlist.name}*`,
    `${dayFmt.format(new Date(r.startsAt))} até ${timeFmt.format(end)}`,
    [r.studioName, r.room].filter(Boolean).join(' · '),
    r.address ?? '',
  ].filter(Boolean)
  if (r.costCents) {
    lines.push('', `Valor: ${brl(r.costCents)}${r.paidByName ? ` (pago por ${r.paidByName.split(' ')[0]})` : ''}`)
    for (const s of r.shares) lines.push(`${s.paidAt ? '✅' : '⏳'} ${s.name}: ${brl(s.amountCents)}`)
  }
  return lines.join('\n')
}

export function RehearsalsPanel({ setlist }: { setlist: SetlistDetail }) {
  const { data, isLoading, error, refetch } = useRehearsals(setlist.id)
  const [editing, setEditing] = useState<Rehearsal | 'new' | null>(null)
  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />

  const now = Date.now()
  const upcoming = data.rehearsals.filter((r) => new Date(r.startsAt).getTime() + r.durationMin * 60_000 >= now).reverse()
  const past = data.rehearsals.filter((r) => new Date(r.startsAt).getTime() + r.durationMin * 60_000 < now)

  return (
    <div className="space-y-5">
      {data.canEdit && (
        <button className="btn-primary w-full sm:w-auto" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Marcar ensaio
        </button>
      )}
      {data.rehearsals.length === 0 ? (
        <EmptyState icon={Clock} title="Nenhum ensaio marcado">
          {data.canEdit
            ? 'Marque o ensaio no estúdio: a banda vê a data e a sala, e o app divide o valor entre os músicos.'
            : 'Quando o líder marcar um ensaio, ele aparece aqui com a sua parte do valor.'}
        </EmptyState>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted">Próximos</h3>
              {upcoming.map((r) => (
                <RehearsalCard key={r.id} r={r} setlist={setlist} canEdit={data.canEdit} onEdit={() => setEditing(r)} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted">Já aconteceram</h3>
              {past.map((r) => (
                <RehearsalCard key={r.id} r={r} setlist={setlist} canEdit={data.canEdit} onEdit={() => setEditing(r)} />
              ))}
            </section>
          )}
        </>
      )}
      {data.canEdit && (
        <RehearsalDialog
          setlist={setlist}
          rehearsal={editing === 'new' ? null : editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RehearsalCard({ r, setlist, canEdit, onEdit }: { r: Rehearsal; setlist: SetlistDetail; canEdit: boolean; onEdit: () => void }) {
  const { data: session } = useSession()
  const uid = session?.user.id
  const paid = useSharePaid()
  const toast = useToast()
  const end = new Date(new Date(r.startsAt).getTime() + r.durationMin * 60_000)
  const owed = r.shares.filter((s) => !s.paidAt).reduce((n, s) => n + s.amountCents, 0)
  const wa = whatsappOf(r.phone)
  const place = [r.studioName, r.address].filter(Boolean).join(', ')

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold first-letter:uppercase">
            {dayFmt.format(new Date(r.startsAt))} até {timeFmt.format(end)}
          </p>
          <p className="text-sm text-muted">{[r.studioName ?? 'Estúdio a definir', r.room].filter(Boolean).join(' · ')}</p>
          {r.notes && <p className="mt-1 text-sm text-muted">{r.notes}</p>}
        </div>
        {canEdit && (
          <button className="btn-icon" onClick={onEdit} aria-label="Editar ensaio">
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {place && (
          <a className="btn-ghost h-8 px-3 text-xs" href={mapsUrl(place)} target="_blank" rel="noopener">
            <MapPin className="size-3.5" /> Mapa
          </a>
        )}
        {wa && (
          <a className="btn-ghost h-8 px-3 text-xs" href={wa} target="_blank" rel="noopener">
            <Phone className="size-3.5" /> Estúdio
          </a>
        )}
        <a className="btn-ghost h-8 px-3 text-xs" href={whatsappUrl(rehearsalText(setlist, r))} target="_blank" rel="noopener">
          <MessageCircle className="size-3.5" /> Mandar no grupo
        </a>
      </div>

      {r.costCents ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <Wallet className="size-4 text-accent" />
            <b>{brl(r.costCents)}</b>
            <span className="text-muted">
              dividido por {r.shares.length}
              {r.paidByName && ` · pago por ${r.paidByName.split(' ')[0]}`}
            </span>
            {owed > 0 ? <span className="ml-auto text-xs font-semibold text-accent">Falta {brl(owed)}</span> : <span className="ml-auto text-xs font-semibold text-ok">Tudo acertado</span>}
          </p>
          <ul className="mt-2 space-y-1.5">
            {r.shares.map((s) => {
              // Marca: a própria pessoa, quem administra ou quem recebeu (pagou o estúdio).
              const can = s.userId === uid || canEdit || r.paidBy === uid
              return (
                <li key={s.userId} className="flex items-center gap-2 text-sm">
                  <Avatar name={s.name} image={s.image} className="size-7 text-xs" />
                  <span className="min-w-0 flex-1 truncate">
                    {s.name}
                    {s.userId === uid && <span className="text-xs text-muted"> (você)</span>}
                  </span>
                  <span className="tabular-nums">{brl(s.amountCents)}</span>
                  <button
                    className={clsx(
                      'flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold',
                      s.paidAt ? 'border-ok/40 text-ok' : 'border-border text-muted',
                      !can && 'pointer-events-none',
                    )}
                    disabled={!can || paid.isPending}
                    onClick={() =>
                      paid.mutate({ id: r.id, userId: s.userId, paid: !s.paidAt }, { onError: (e) => toast(e.message, 'error') })
                    }
                    aria-label={s.paidAt ? `${s.name} já acertou (desfazer)` : `Marcar que ${s.name} acertou`}
                  >
                    {s.paidAt ? (
                      <>
                        <Check className="size-3.5" /> Acertou
                      </>
                    ) : can ? (
                      'Marcar pago'
                    ) : (
                      'Falta'
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

interface Form {
  startsAt: string
  durationMin: number
  studioName: string
  room: string
  address: string
  phone: string
  cost: string
  paidBy: string
  notes: string
  participants: string[]
}

const defaultStart = () => {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(19, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

function RehearsalDialog({
  setlist,
  rehearsal,
  open,
  onClose,
}: {
  setlist: SetlistDetail
  rehearsal: Rehearsal | null
  open: boolean
  onClose: () => void
}) {
  const band = setlist.members.map((m) => m.userId)
  const initial = (): Form =>
    rehearsal
      ? {
          startsAt: toLocalInput(rehearsal.startsAt),
          durationMin: rehearsal.durationMin,
          studioName: rehearsal.studioName ?? '',
          room: rehearsal.room ?? '',
          address: rehearsal.address ?? '',
          phone: rehearsal.phone ?? '',
          cost: money(rehearsal.costCents),
          paidBy: rehearsal.paidBy ?? '',
          notes: rehearsal.notes ?? '',
          participants: rehearsal.shares.length ? rehearsal.shares.map((s) => s.userId) : band,
        }
      : { startsAt: defaultStart(), durationMin: 120, studioName: '', room: '', address: '', phone: '', cost: '', paidBy: '', notes: '', participants: band }
  const [form, setForm] = useState<Form>(initial)
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  // Abriu de novo (ou para outro ensaio): recomeça do que está salvo.
  const key = open ? (rehearsal?.id ?? 'new') : null
  if (key !== openedFor) {
    setOpenedFor(key)
    if (key) setForm(initial())
  }
  const studios = useSavedStudios(open)
  const save = useSaveRehearsal(setlist.id)
  const del = useDeleteRehearsal()
  const toast = useToast()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const costCents = parseBRL(form.cost)
  const each = costCents && form.participants.length ? costCents / form.participants.length : 0

  const pickStudio = (name: string) => {
    const s = studios.data?.find((x) => x.studioName === name)
    set('studioName', name)
    if (s)
      setForm((f) => ({
        ...f,
        studioName: s.studioName,
        room: f.room || s.room || '',
        address: f.address || s.address || '',
        phone: f.phone || s.phone || '',
        cost: f.cost || money(s.costCents),
        durationMin: s.durationMin,
      }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const input: RehearsalInput = {
      startsAt: new Date(form.startsAt).toISOString(),
      durationMin: form.durationMin,
      studioName: form.studioName.trim() || null,
      room: form.room.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      costCents,
      paidBy: form.paidBy || null,
      notes: form.notes.trim() || null,
      participants: form.participants,
    }
    save.mutate(
      { ...input, id: rehearsal?.id },
      {
        onSuccess: () => {
          toast(rehearsal ? 'Ensaio atualizado.' : 'Ensaio marcado.')
          onClose()
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={rehearsal ? 'Editar ensaio' : 'Marcar ensaio'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="label">Dia e hora</span>
            <input type="datetime-local" className="input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">Duração</span>
            <select className="input" value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
              {[60, 90, 120, 150, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="label">Estúdio</span>
          <input
            className="input"
            list="estudios-salvos"
            value={form.studioName}
            onChange={(e) => pickStudio(e.target.value)}
            placeholder="Nome do estúdio"
            maxLength={120}
          />
          <datalist id="estudios-salvos">
            {studios.data?.map((s) => (
              <option key={s.studioName} value={s.studioName} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Sala</span>
            <input className="input" value={form.room} onChange={(e) => set('room', e.target.value)} placeholder="Sala 2" maxLength={60} />
          </label>
          <label className="block">
            <span className="label">WhatsApp do estúdio</span>
            <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(85) 9..." maxLength={40} />
          </label>
        </div>
        <label className="block">
          <span className="label">Endereço</span>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Valor total (R$)</span>
            <input className="input" inputMode="decimal" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="120,00" />
          </label>
          <label className="block">
            <span className="label">Quem pagou o estúdio</span>
            <select className="input" value={form.paidBy} onChange={(e) => set('paidBy', e.target.value)}>
              <option value="">Ninguém ainda</option>
              {setlist.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {costCents ? (
          <fieldset>
            <legend className="label">Dividir entre</legend>
            <div className="flex flex-wrap gap-2">
              {setlist.members.map((m) => {
                const on = form.participants.includes(m.userId)
                return (
                  <button
                    key={m.userId}
                    type="button"
                    className={clsx('chip', on && 'chip-on')}
                    aria-pressed={on}
                    onClick={() =>
                      set('participants', on ? form.participants.filter((x) => x !== m.userId) : [...form.participants, m.userId])
                    }
                  >
                    {m.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-muted">
              {form.participants.length ? (
                <>
                  Cada um paga <b className="text-text">{brl(Math.ceil(each))}</b>
                  {form.participants.length > 1 && ` (${form.participants.length} pessoas)`}.
                </>
              ) : (
                'Escolha quem divide o valor.'
              )}
            </p>
          </fieldset>
        ) : null}

        <label className="block">
          <span className="label">Observações</span>
          <textarea className="input min-h-20" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Levar os pedais; ensaiar as músicas novas." maxLength={1000} />
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {rehearsal ? (
            <button
              type="button"
              className="btn-ghost text-danger"
              onClick={() =>
                confirm('Apagar este ensaio?') &&
                del.mutate(rehearsal.id, {
                  onSuccess: () => {
                    toast('Ensaio apagado.')
                    onClose()
                  },
                })
              }
            >
              <Trash2 className="size-4" /> Apagar
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={save.isPending}>
            {rehearsal ? 'Salvar' : 'Marcar ensaio'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
