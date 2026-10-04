import clsx from 'clsx'
import { Activity, Globe, Monitor, Smartphone, Tablet } from 'lucide-react'
import { useState } from 'react'
import { ErrorState, PageSpinner } from '../../components/ui'
import { useAdminTraffic } from '../../lib/admin'

function getDeviceIcon(device: string) {
  if (device === 'Celular') return <Smartphone className="size-4 text-accent" />
  if (device === 'Tablet') return <Tablet className="size-4 text-purple-400" />
  return <Monitor className="size-4 text-blue-400" />
}

export function AdminTraffic() {
  const [days, setDays] = useState(14)
  const { data, isLoading, error, refetch } = useAdminTraffic(days)

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const { daily, topPages, devices, browsers } = data
  const maxDaily = Math.max(...daily.map((d) => d.visits), 1)
  const totalVisitsPeriod = daily.reduce((acc, d) => acc + d.visits, 0)
  const totalDeviceCount = devices.reduce((acc, d) => acc + d.count, 0) || 1

  return (
    <div className="space-y-6">
      {/* Header com seletor de período */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">Fluxo de Visitas & Audiência</h2>
          <p className="text-xs text-muted">
            Total de {totalVisitsPeriod} visualizações de página nos últimos {days} dias
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 border border-border">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'rounded-lg px-3 py-1 text-xs font-semibold transition',
                days === d ? 'bg-accent text-white shadow-xs' : 'text-muted hover:text-text',
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico de Visitas Diárias (SVG Responsivo) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-accent" />
            <h3 className="text-sm font-semibold">Visualizações por Dia</h3>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-accent" /> Visitas Totais
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-400" /> Usuários Logados
            </span>
          </div>
        </div>

        {daily.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">Nenhum dado registrado para este período.</div>
        ) : (
          <div className="pt-4">
            <div className="grid grid-flow-col auto-cols-fr items-end gap-1.5 sm:gap-2 h-48 border-b border-border pb-2">
              {daily.map((item) => {
                const heightPercent = Math.max((item.visits / maxDaily) * 100, 4)
                const loggedHeightPercent = Math.max((item.registeredUsers / maxDaily) * 100, 0)
                const formattedDate = item.date.slice(5) // MM-DD

                return (
                  <div key={item.date} className="group relative flex h-full flex-col justify-end items-center">
                    {/* Tooltip hover */}
                    <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-surface-3 px-2 py-1 text-[10px] text-text shadow-md group-hover:block whitespace-nowrap border border-border">
                      <div className="font-bold">{item.date}</div>
                      <div>Visitas: {item.visits}</div>
                      <div>IPs únicos: {item.uniqueIps}</div>
                      <div>Músicos logados: {item.registeredUsers}</div>
                    </div>

                    {/* Barra de Visitas */}
                    <div className="relative w-full max-w-[28px] rounded-t-md bg-surface-2 overflow-hidden flex flex-col justify-end" style={{ height: `${heightPercent}%` }}>
                      <div
                        className="w-full bg-accent/80 group-hover:bg-accent transition"
                        style={{ height: '100%' }}
                      />
                      {item.registeredUsers > 0 && (
                        <div
                          className="absolute bottom-0 w-full bg-emerald-400/90"
                          style={{ height: `${loggedHeightPercent}%` }}
                        />
                      )}
                    </div>

                    <span className="mt-2 text-[10px] text-muted truncate w-full text-center">
                      {formattedDate}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Páginas Mais Visitadas e Dispositivos */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Páginas Mais Acessadas */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            <h3 className="text-sm font-semibold">Páginas Mais Acessadas</h3>
          </div>

          <div className="space-y-2">
            {topPages.length === 0 ? (
              <p className="text-xs text-muted">Sem dados suficientes.</p>
            ) : (
              topPages.map((page, idx) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold text-muted w-4">{idx + 1}.</span>
                    <span className="truncate font-mono font-medium text-text">{page.path}</span>
                  </div>
                  <span className="ml-2 font-bold text-accent shrink-0">{page.count} acessos</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dispositivos e Navegadores */}
        <div className="card p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold mb-3">Dispositivos Utilizados</h3>
            <div className="space-y-2.5">
              {devices.map((d) => {
                const percent = Math.round((d.count / totalDeviceCount) * 100)
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        {getDeviceIcon(d.name)}
                        {d.name}
                      </span>
                      <span className="text-muted">
                        {d.count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3">Navegadores Principais</h3>
            <div className="flex flex-wrap gap-2">
              {browsers.map((b) => (
                <div key={b.name} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted border border-border">
                  <span className="font-semibold text-text">{b.name}</span>: {b.count}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
