import { Loader2, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { brl, type Gig, type GigStatus, parseBRL, useDeleteGig, useSaveGig } from '../lib/gigs'
import { useSetlists } from '../lib/setlists'
import { Sheet } from './Sheet'
import { useToast } from './ui'

/** "2026-10-16T20:00" no horário do aparelho (o campo de data e hora do navegador). */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const defaultStart = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(21, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

interface Form {
  title: string
  startsAt: string
  location: string
  contractor: string
  contact: string
  fee: string
  paid: boolean
  status: GigStatus
  notes: string
  setlistId: string
}

const fromGig = (g: Gig | null): Form =>
  g
    ? {
        title: g.title,
        startsAt: toLocalInput(g.startsAt),
        location: g.location ?? '',
        contractor: g.contractor ?? '',
        contact: g.contact ?? '',
        fee: g.feeCents != null ? (g.feeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        paid: Boolean(g.paidAt),
        status: g.status,
        notes: g.notes ?? '',
        setlistId: g.setlistId ?? '',
      }
    : {
        title: '',
        startsAt: defaultStart(),
        location: '',
        contractor: '',
        contact: '',
        fee: '',
        paid: false,
        status: 'confirmed',
        notes: '',
        setlistId: '',
      }

/** Anotar ou editar um show da agenda. */
export function GigDialog({ gig, open, onClose }: { gig: Gig | null; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<Form>(() => fromGig(gig))
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? (gig?.id ?? 'novo') : null
  if (key !== lastKey) {
    setLastKey(key)
    if (key) setForm(fromGig(gig))
  }
  const save = useSaveGig()
  const del = useDeleteGig()
  const setlists = useSetlists()
  const toast = useToast()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const feeCents = parseBRL(form.fee)

  const chooseSetlist = (id: string) => {
    const s = setlists.data?.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      setlistId: id,
      // Repertório com data/local: preenche o que ainda está vazio.
      title: f.title || s?.name || '',
      location: f.location || s?.location || '',
      startsAt: !gig && s?.eventDate ? toLocalInput(s.eventDate) : f.startsAt,
    }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return toast('Dê um nome ao show.', 'error')
    if (form.fee.trim() && feeCents == null) return toast('Valor do cachê inválido.', 'error')
    save.mutate(
      {
        id: gig?.id,
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        location: form.location.trim() || null,
        contractor: form.contractor.trim() || null,
        contact: form.contact.trim() || null,
        feeCents,
        paidAt: form.paid ? (gig?.paidAt ?? new Date().toISOString()) : null,
        status: form.status,
        notes: form.notes.trim() || null,
        setlistId: form.setlistId || null,
      },
      {
        onSuccess: () => {
          toast(gig ? 'Show atualizado.' : 'Show anotado na agenda.')
          onClose()
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={gig ? 'Editar show' : 'Novo show'}>
      <form className="space-y-4" onSubmit={submit}>
        {Boolean(setlists.data?.length) && (
          <label className="block">
            <span className="label">Repertório (opcional)</span>
            <select className="input" value={form.setlistId} onChange={(e) => chooseSetlist(e.target.value)}>
              <option value="">Sem repertório</option>
              {setlists
                .data!.filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="label">Nome do show</span>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex.: Baile no Bar do Zé, Casamento Ana e João"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Data e hora</span>
            <input
              className="input"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="label">Situação</span>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as GigStatus)}>
              <option value="confirmed">Confirmado</option>
              <option value="tentative">A confirmar</option>
              <option value="canceled">Cancelado</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label">Local</span>
          <input
            className="input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Nome do lugar e endereço"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Contratante</span>
            <input className="input" value={form.contractor} onChange={(e) => set('contractor', e.target.value)} />
          </label>
          <label className="block">
            <span className="label">WhatsApp do contratante</span>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              value={form.contact}
              onChange={(e) => set('contact', e.target.value)}
              placeholder="(85) 99999-0000"
            />
          </label>
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Cachê combinado</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">R$</span>
              <input
                className="input pl-10"
                inputMode="decimal"
                value={form.fee}
                onChange={(e) => set('fee', e.target.value)}
                placeholder="800,00"
              />
            </div>
            {form.fee.trim() && (
              <span className={feeCents == null ? 'mt-1 block text-xs text-danger' : 'mt-1 block text-xs text-muted'}>
                {feeCents == null ? 'Valor inválido' : brl(feeCents)}
              </span>
            )}
          </label>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[var(--ok)]"
              checked={form.paid}
              onChange={(e) => set('paid', e.target.checked)}
            />
            Cachê já recebido
          </label>
        </div>
        <label className="block">
          <span className="label">Observações</span>
          <textarea
            className="input h-20 resize-y py-2"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Horário de passagem de som, traje, equipamento, metade do cachê adiantada…"
          />
        </label>
        <p className="text-xs text-muted">Só você vê a sua agenda e os valores.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {gig ? (
            <button
              type="button"
              className="btn-ghost text-danger"
              disabled={del.isPending}
              onClick={() =>
                confirm(`Excluir "${gig.title}" da agenda?`) &&
                del.mutate(gig.id, {
                  onSuccess: () => {
                    toast('Show excluído.')
                    onClose()
                  },
                })
              }
            >
              <Trash2 className="size-4" /> Excluir
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {gig ? 'Salvar' : 'Anotar na agenda'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
