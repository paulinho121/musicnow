import { SETLIST_STATUS, type SetlistStatus } from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowLeft, Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useCreateSetlist, useSetlist, useUpdateSetlist } from '../lib/setlists'
import type { SetlistInput } from '../lib/types'

/** Date → valor de <input type="datetime-local"> no fuso do aparelho. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SetlistForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { data: existing, isLoading, error } = useSetlist(id)
  const create = useCreateSetlist()
  const update = useUpdateSetlist(id ?? '')

  const [name, setName] = useState('')
  const [when, setWhen] = useState('')
  const [location, setLocation] = useState('')
  const [groupName, setGroupName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SetlistStatus>('rascunho')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setWhen(toLocalInput(existing.eventDate))
    setLocation(existing.location ?? '')
    setGroupName(existing.groupName ?? '')
    setNotes(existing.notes ?? '')
    setStatus(existing.status)
  }, [existing])

  if (editing && isLoading) return <PageSpinner />
  if (editing && (error || !existing)) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) return setFormError('Dê um nome ao repertório.')
    const input: SetlistInput = {
      name: name.trim(),
      eventDate: when ? new Date(when).toISOString() : null,
      location: location.trim() || null,
      groupName: groupName.trim() || null,
      notes: notes.trim() || null,
      status,
    }
    const done = (sid: string) => {
      toast(editing ? 'Repertório atualizado.' : 'Repertório criado. Agora adicione as músicas.')
      navigate(`/repertorios/${sid}`, { replace: true })
    }
    if (editing) update.mutate(input, { onSuccess: () => done(id!), onError: (err) => setFormError(err.message) })
    else create.mutate(input, { onSuccess: (r) => done(r.id), onError: (err) => setFormError(err.message) })
  }

  const busy = create.isPending || update.isPending
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center gap-2">
        <Link to={editing ? `/repertorios/${id}` : '/repertorios'} className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">{editing ? 'Editar repertório' : 'Novo repertório'}</h1>
      </div>

      <section className="card grid gap-4 p-4 md:grid-cols-2 md:p-5">
        <label className="block md:col-span-2">
          <span className="label">Nome *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus={!editing} placeholder="Ex.: Culto de domingo, Show no Bar do Zé" />
        </label>
        <label className="block">
          <span className="label">Data e hora</span>
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Local</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Artista, banda ou igreja</span>
          <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={120} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Observações gerais</span>
          <textarea
            className="input h-24 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={5000}
            placeholder="Horário da passagem de som, figurino, ordem de entrada..."
          />
        </label>
      </section>

      <section className="card p-4 md:p-5">
        <p className="label">Status</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SETLIST_STATUS) as SetlistStatus[]).map((s) => (
            <button key={s} type="button" className={clsx('chip', status === s && 'chip-on')} onClick={() => setStatus(s)} aria-pressed={status === s}>
              {SETLIST_STATUS[s]}
            </button>
          ))}
        </div>
      </section>

      {formError && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-44" disabled={busy}>
          <Save className="size-4" /> {busy ? 'Salvando...' : editing ? 'Salvar' : 'Criar repertório'}
        </button>
      </div>
    </form>
  )
}
