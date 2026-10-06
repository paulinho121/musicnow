import { WifiOff } from 'lucide-react'
import { useOnline } from '../lib/offline'

/** Aviso discreto no topo quando o aparelho fica sem internet. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[70] flex justify-center px-3"
      role="status"
    >
      <p className="flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur">
        <WifiOff className="size-3.5 text-accent" /> Sem internet · usando o que está salvo no aparelho
      </p>
    </div>
  )
}
