import { REPORT_REASONS, type ReportReason } from '@ensaio/shared'
import clsx from 'clsx'
import { Flag, X } from 'lucide-react'
import { useState } from 'react'
import { useReportSong } from '../lib/queries'
import { useToast } from './ui'

/** Denúncia de música (direitos autorais, conteúdo errado...). Fica registrada para análise. */
export function ReportButton({ songId }: { songId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('copyright')
  const [details, setDetails] = useState('')
  const report = useReportSong(songId)
  const toast = useToast()

  const send = () =>
    report.mutate(
      { reason, details: details.trim() || null },
      {
        onSuccess: () => {
          toast('Denúncia enviada. Obrigado por avisar.')
          setOpen(false)
          setDetails('')
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )

  return (
    <>
      <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text" onClick={() => setOpen(true)}>
        <Flag className="size-3.5" /> Denunciar esta música
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Denunciar música"
            className="w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Denunciar música</h2>
              <button className="btn-icon size-9" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={clsx(
                    'flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm',
                    reason === r ? 'border-accent bg-accent/10' : 'border-border text-muted',
                  )}
                >
                  {REPORT_REASONS[r]}
                </button>
              ))}
            </div>
            <textarea
              className="input mt-3 h-24 py-2 text-sm"
              placeholder={reason === 'copyright' ? 'Se você é o detentor dos direitos, diga quem é e como podemos contatar.' : 'Detalhes (opcional)'}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
            />
            <button type="button" className="btn-primary mt-4 w-full" onClick={send} disabled={report.isPending}>
              {report.isPending ? 'Enviando...' : 'Enviar denúncia'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
