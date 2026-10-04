import clsx from 'clsx'
import { AlertCircle, CheckCircle, EyeOff, ShieldCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../../components/ui'
import { useAdminReports, useResolveReport } from '../../lib/admin'

export function AdminReports() {
  const { data, isLoading, error, refetch } = useAdminReports()
  const resolve = useResolveReport()
  const toast = useToast()

  const handleAction = async (id: string, status: 'resolved' | 'dismissed', hideSong?: boolean) => {
    try {
      await resolve.mutateAsync({ id, status, hideSong })
      toast(status === 'resolved' ? 'Denúncia resolvida.' : 'Denúncia arquivada.', 'ok')
    } catch {
      toast('Erro ao processar ação na denúncia.', 'error')
    }
  }

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const reports = data.reports

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text">Moderação e Denúncias de Músicas</h2>
        <p className="text-xs text-muted">
          Gerencie denúncias de violação de direitos autorais ou conteúdo indevido enviadas pelos usuários.
        </p>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma denúncia no momento"
          children="O catálogo está em conformidade. Nenhuma música reportada por usuários."
        />
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const isOpen = r.status === 'open'

            return (
              <div
                key={r.id}
                className={clsx(
                  'card p-5 space-y-3 transition border',
                  isOpen ? 'border-amber-500/30 bg-surface' : 'border-border/60 opacity-75',
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                        isOpen
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          : r.status === 'resolved'
                            ? 'bg-ok/15 text-ok border border-ok/20'
                            : 'bg-surface-2 text-muted border border-border',
                      )}
                    >
                      <AlertCircle className="size-3" />
                      {isOpen ? 'Pendente' : r.status === 'resolved' ? 'Resolvido' : 'Descartado'}
                    </span>
                    <span className="text-xs text-muted">
                      Reportado em {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="text-xs text-muted">
                    Denunciante: <span className="text-text font-medium">{r.reporterName}</span> ({r.reporterEmail})
                  </div>
                </div>

                <div className="rounded-xl bg-surface-2 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted">Música reportada: </span>
                      <Link
                        to={`/musica/${r.songId}`}
                        target="_blank"
                        className="font-semibold text-text hover:text-accent hover:underline"
                      >
                        {r.songTitle} {r.songArtist ? `— ${r.songArtist}` : ''}
                      </Link>
                    </div>
                    <span className="text-[10px] text-muted uppercase font-mono">Visibilidade: {r.songVisibility}</span>
                  </div>
                  <div>
                    <span className="text-muted">Motivo: </span>
                    <span className="font-semibold text-danger">{r.reason}</span>
                  </div>
                  {r.details && (
                    <div className="text-muted mt-1 italic border-l-2 border-border pl-2">
                      &ldquo;{r.details}&rdquo;
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={() => handleAction(r.id, 'dismissed')}
                      disabled={resolve.isPending}
                      className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text hover:bg-surface-3 transition"
                    >
                      <XCircle className="size-3.5" /> Descartar denúncia
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'resolved', true)}
                      disabled={resolve.isPending}
                      className="flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition"
                    >
                      <EyeOff className="size-3.5" /> Ocultar música (Tornar privada)
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'resolved', false)}
                      disabled={resolve.isPending}
                      className="flex items-center gap-1 rounded-lg border border-ok/30 bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok hover:bg-ok/20 transition"
                    >
                      <CheckCircle className="size-3.5" /> Marcar como resolvida
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
