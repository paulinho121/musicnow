import { atLeast } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ListPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { setlistKeys, useSetlists } from '../lib/setlists'
import { Sheet } from './Sheet'
import { Spinner, useToast } from './ui'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** Botão "Adicionar ao repertório" da tela da música: lista os repertórios que a pessoa administra. */
export function AddToSetlistButton({ songId, songTitle, isPrivate }: { songId: string; songTitle: string; isPrivate: boolean }) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const { data, isLoading } = useSetlists()
  const qc = useQueryClient()
  const toast = useToast()
  const mine = (data ?? []).filter((s) => atLeast(s.role, 'admin') && !s.archived)

  const add = async (id: string, name: string) => {
    setBusy(id)
    try {
      await api(`/setlists/${id}/items`, { method: 'POST', json: { songId } })
      setAdded((a) => [...a, id])
      qc.invalidateQueries({ queryKey: setlistKeys.detail(id) })
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      toast(`"${songTitle}" adicionada a ${name}.`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button className="btn-icon shrink-0 border-transparent bg-transparent" aria-label="Adicionar ao repertório" onClick={() => setOpen(true)}>
        <ListPlus className="size-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Adicionar ao repertório">
        {isPrivate && (
          <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            Esta música é privada: os músicos do repertório vão poder vê-la.
          </p>
        )}
        {isLoading ? (
          <Spinner />
        ) : mine.length ? (
          <div className="divide-y divide-border">
            {mine.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {[s.eventDate && dateFmt.format(new Date(s.eventDate)), `${s.itemCount} músicas`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  className="btn-ghost h-9 px-3"
                  disabled={busy === s.id || added.includes(s.id)}
                  onClick={() => add(s.id, s.name)}
                >
                  {added.includes(s.id) ? <Check className="size-4 text-ok" /> : <Plus className="size-4" />}
                  {added.includes(s.id) ? 'Adicionada' : 'Adicionar'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Você ainda não administra nenhum repertório.</p>
        )}
        <Link to="/repertorios/novo" className="btn-ghost mt-4 w-full">
          <Plus className="size-4" /> Criar repertório
        </Link>
      </Sheet>
    </>
  )
}
