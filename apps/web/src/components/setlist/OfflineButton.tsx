import clsx from 'clsx'
import { CloudDownload, CloudOff, Loader2, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { downloadSetlist, removeDownload, useOfflineRecord, useOnline } from '../../lib/offline'
import type { SetlistDetail } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

const whenFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const mb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * "Baixar para o show": o repertório inteiro no aparelho, para tocar sem internet.
 * Se o repertório mudar depois de baixado, atualiza sozinho assim que houver internet.
 */
export function OfflineButton({ setlist }: { setlist: SetlistDetail }) {
  const rec = useOfflineRecord(setlist.id)
  const online = useOnline()
  const toast = useToast()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [open, setOpen] = useState(false)
  const busy = progress !== null
  const stale = Boolean(rec && rec.revision !== setlist.revision)

  const run = async (quiet = false) => {
    setProgress({ done: 0, total: setlist.items.length })
    try {
      await downloadSetlist(setlist, (done, total) => setProgress({ done, total }))
      if (!quiet) toast(`Pronto: ${setlist.items.length} músicas disponíveis sem internet.`)
    } catch (e) {
      if (!quiet) toast((e as Error).message, 'error')
    } finally {
      setProgress(null)
    }
  }

  // Mudou depois de baixar (música nova, tom trocado): atualiza em segundo plano.
  const autoRan = useRef<number | null>(null)
  useEffect(() => {
    if (stale && online && !busy && autoRan.current !== setlist.revision) {
      autoRan.current = setlist.revision
      void run(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, online, setlist.revision])

  if (!setlist.items.length) return null

  if (busy) {
    return (
      <button className="btn-ghost" disabled>
        <Loader2 className="size-4 animate-spin" /> Baixando {progress.done}/{progress.total}…
      </button>
    )
  }

  if (!rec) {
    return (
      <button
        className="btn-ghost"
        onClick={() => run()}
        disabled={!online}
        title="Guarda o repertório no aparelho para tocar sem internet"
      >
        <CloudDownload className="size-4" /> Baixar para o show
      </button>
    )
  }

  return (
    <>
      <button
        className={clsx('btn-ghost', !stale && 'border-ok/40 text-ok hover:bg-ok/10')}
        onClick={() => setOpen(true)}
        aria-label="Repertório baixado para tocar sem internet"
      >
        {stale ? <RefreshCw className="size-4" /> : <WifiOff className="size-4" />}
        {stale ? 'Atualizar download' : 'Pronto sem internet ✓'}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Disponível sem internet">
        <div className="space-y-4">
          <p className="text-sm">
            Este repertório está guardado no aparelho: <b>{rec.songs} músicas</b>
            {rec.bytes > 50_000 ? `, com partituras (${mb(rec.bytes)})` : ''}. Baixado em {whenFmt.format(new Date(rec.at))}.
          </p>
          {stale && (
            <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
              O repertório mudou depois do download. {online ? 'Atualize para levar a versão nova.' : 'Atualize quando tiver internet.'}
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Abre e toca sem internet: lista, cifras no tom do repertório, partituras e marcações.</li>
            <li>Mudanças feitas sem internet (marcações) são enviadas quando a conexão voltar.</li>
            <li>O Modo Palco ao vivo (seguir o líder) precisa de internet ou do Wi-Fi do local.</li>
          </ul>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="btn-ghost text-danger"
              onClick={async () => {
                await removeDownload(setlist)
                setOpen(false)
                toast('Removido do aparelho.')
              }}
            >
              <Trash2 className="size-4" /> Remover do aparelho
            </button>
            <button
              className="btn-primary"
              disabled={!online}
              onClick={() => {
                setOpen(false)
                void run()
              }}
            >
              {online ? <RefreshCw className="size-4" /> : <CloudOff className="size-4" />} Baixar de novo
            </button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
