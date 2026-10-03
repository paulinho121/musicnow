import { fileNameFor, normalizeOffset, semitonesBetween, songInKey, toChordProBook } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import { FileDown, Printer, Share } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { downloadText } from '../../lib/download'
import { keys } from '../../lib/queries'
import type { SetlistDetail, SongDetail } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

/** Exportar o repertório: ChordPro (todas as músicas num arquivo, nos tons do repertório) ou PDF. */
export function ExportButton({ setlist }: { setlist: SetlistDetail }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const toast = useToast()

  const chordpro = async () => {
    setBusy(true)
    try {
      const songs = await Promise.all(
        setlist.items.map((it) =>
          qc.fetchQuery({
            queryKey: keys.song(it.song.id, setlist.id),
            queryFn: () => api<SongDetail>(`/songs/${it.song.id}?setlistId=${setlist.id}`),
          }),
        ),
      )
      const book = toChordProBook(
        setlist.items.map((it, i) => {
          const song = songs[i]
          const target = it.key ?? song.originalKey
          const st = song.originalKey && target ? normalizeOffset(semitonesBetween(song.originalKey, target)) : 0
          return songInKey({ ...song, key: song.originalKey, bpm: it.bpm ?? song.bpm, notes: it.notes ?? song.notes }, st, target)
        }),
      )
      downloadText(fileNameFor(setlist.name, 'cho'), book)
      toast(`${setlist.items.length} músicas exportadas em ChordPro.`)
      setOpen(false)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)} disabled={!setlist.items.length}>
        <Share className="size-4" /> Exportar
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Exportar repertório">
        <p className="mb-4 text-sm text-muted">Cada música sai no tom definido para este repertório.</p>
        <div className="space-y-2">
          <Link to={`/repertorios/${setlist.id}/imprimir`} className="btn-ghost h-auto w-full justify-start py-3 text-left">
            <Printer className="size-5 shrink-0" />
            <span>
              Imprimir ou salvar PDF
              <span className="block text-xs font-normal text-muted">Capa com a ordem e os tons, e uma música por página.</span>
            </span>
          </Link>
          <button className="btn-ghost h-auto w-full justify-start py-3 text-left" onClick={chordpro} disabled={busy}>
            <FileDown className="size-5 shrink-0" />
            <span>
              {busy ? 'Preparando...' : 'Baixar em ChordPro (.cho)'}
              <span className="block text-xs font-normal text-muted">Abre em OnSong, SongbookPro, Planning Center e outros apps.</span>
            </span>
          </button>
        </div>
      </Sheet>
    </>
  )
}
