import { Check, FileUp, Lock, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSongs } from '../../lib/queries'
import { useAddItem } from '../../lib/setlists'
import type { SetlistDetail } from '../../lib/types'
import { Sheet } from '../Sheet'
import { KeyBadge, Spinner, useToast } from '../ui'

/** Busca na biblioteca e adiciona ao fim do repertório. Pode adicionar várias em sequência. */
export function AddSongDialog({ open, onClose, setlist }: { open: boolean; onClose: () => void; setlist: SetlistDetail }) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const add = useAddItem(setlist.id)
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const { data: songs, isLoading } = useSongs({ q })
  const inSetlist = new Set(setlist.items.map((i) => i.song.id))

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(t)
  }, [text])

  const addSong = (songId: string, title: string) => {
    setBusy(songId)
    add.mutate(
      { songId },
      {
        onSuccess: () => toast(`"${title}" adicionada.`),
        onError: (e) => toast(e.message, 'error'),
        onSettled: () => setBusy(null),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar músicas" wide>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input className="input pl-10" autoFocus placeholder="Buscar na sua biblioteca" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      ) : songs?.length ? (
        <ul className="divide-y divide-border">
          {songs.map((s) => {
            const already = inSetlist.has(s.id)
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <KeyBadge value={s.originalKey} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {s.title}
                    {s.visibility === 'private' && <Lock className="size-3.5 shrink-0 text-muted" aria-label="Privada: a banda passa a ver" />}
                  </p>
                  <p className="truncate text-xs text-muted">{s.artist}</p>
                </div>
                <button className="btn-ghost h-9 shrink-0 px-3" disabled={busy === s.id} onClick={() => addSong(s.id, s.title)}>
                  {already ? <Check className="size-4 text-ok" /> : <Plus className="size-4" />}
                  {already ? 'De novo' : 'Adicionar'}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="py-6 text-center text-sm text-muted">
          <p>Nenhuma música encontrada.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link to="/musicas/nova" className="btn-ghost h-9 px-3">
              <Plus className="size-4" /> Cadastrar
            </Link>
            <Link to="/musicas/importar" className="btn-ghost h-9 px-3">
              <FileUp className="size-4" /> Importar
            </Link>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        <Lock className="mr-1 inline size-3" /> Músicas privadas adicionadas aqui passam a ser vistas pelos músicos deste repertório.
      </p>
    </Sheet>
  )
}
