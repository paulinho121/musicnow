import { youtubeSearchUrl } from '@ensaio/shared'
import { CirclePlay, FileText, Layers, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRemoveItem, useUpdateItem } from '../../lib/setlists'
import type { SetlistBlock, SetlistItem } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'
import { keyOptions } from './SongsPanel'

/** Onde ouvir a música: a gravação de referência cadastrada ou a busca no YouTube. */
export const listenUrl = (song: SetlistItem['song']) => song.referenceUrl || youtubeSearchUrl({ title: song.title, artist: song.artist })

/**
 * Tudo sobre uma música do repertório, num lugar só: ouvir, abrir a cifra, tom,
 * observação, mudar de bloco e tirar do repertório.
 */
export function ItemMenu({
  setlistId,
  item,
  blocks,
  open,
  onClose,
  onOpenSong,
  onMoveToBlock,
}: {
  setlistId: string
  item: SetlistItem
  blocks: SetlistBlock[]
  open: boolean
  onClose: () => void
  onOpenSong: () => void
  onMoveToBlock: (blockId: string | null) => void
}) {
  const update = useUpdateItem(setlistId)
  const remove = useRemoveItem(setlistId)
  const toast = useToast()
  const [notes, setNotes] = useState(item.notes ?? '')

  useEffect(() => {
    if (open) setNotes(item.notes ?? '')
  }, [open, item.notes])

  const save = (patch: Partial<Pick<SetlistItem, 'key' | 'notes'>>, done?: string) =>
    update.mutate(
      { itemId: item.id, key: item.key, bpm: item.bpm, notes: item.notes, ...patch },
      { onSuccess: () => done && toast(done), onError: (e) => toast(e.message, 'error') },
    )

  const drop = () => {
    if (!confirm(`Tirar "${item.song.title}" do repertório?`)) return
    remove.mutate(item.id, {
      onSuccess: () => {
        toast('Música tirada do repertório.')
        onClose()
      },
      onError: (e) => toast(e.message, 'error'),
    })
  }

  const row = 'flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2'
  return (
    <Sheet open={open} onClose={onClose} title={item.song.title}>
      <div className="-mx-2 flex flex-col">
        <a className={row} href={listenUrl(item.song)} target="_blank" rel="noreferrer" onClick={onClose}>
          <CirclePlay className="size-5 text-[#ff4e45]" />
          <span>
            Ouvir no YouTube
            <span className="block text-xs text-muted">
              {item.song.referenceUrl ? 'Gravação de referência da música' : 'Busca pelo nome e artista'}
            </span>
          </span>
        </a>
        <button
          className={row}
          onClick={() => {
            onClose()
            onOpenSong()
          }}
        >
          <FileText className="size-5 text-muted" /> Abrir a cifra
        </button>
      </div>

      <div className="mt-4 space-y-4 border-t border-border pt-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Tom neste repertório</span>
          <select
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 font-mono font-bold text-chord"
            value={item.key ?? ''}
            onChange={(e) => save({ key: e.target.value || null }, 'Tom alterado.')}
            disabled={!item.song.originalKey}
          >
            <option value="">{item.song.originalKey ? `${item.song.originalKey} (original)` : '—'}</option>
            {keyOptions(item.song.originalKey).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>

        {blocks.length > 0 && (
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Layers className="size-4 text-muted" /> Bloco
            </span>
            <select
              className="h-10 max-w-48 rounded-lg border border-border bg-surface-2 px-2 text-sm"
              value={item.blockId ?? ''}
              onChange={(e) => {
                onMoveToBlock(e.target.value || null)
                toast('Música movida de bloco.')
                onClose()
              }}
            >
              <option value="">Sem bloco</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="label">Observação neste repertório</span>
          <div className="flex gap-2">
            <input
              className="input h-10"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Ex.: começar só voz e violão"
            />
            <button
              className="btn-ghost h-10 shrink-0 px-3"
              disabled={(notes.trim() || null) === (item.notes ?? null) || update.isPending}
              onClick={() => save({ notes: notes.trim() || null }, 'Observação salva.')}
            >
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </label>

        <button className="btn-ghost w-full text-danger" onClick={drop} disabled={remove.isPending}>
          {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Tirar do repertório
        </button>
      </div>
    </Sheet>
  )
}
