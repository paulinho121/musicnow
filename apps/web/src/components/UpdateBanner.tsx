import { RefreshCw } from 'lucide-react'
import { useUpdateReady } from '../lib/updates'

/** Aviso discreto de versão nova (só aparece enquanto a pessoa está tocando). */
export function UpdateBanner() {
  const { ready, apply } = useUpdateReady()
  if (!ready) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center px-3">
      <button
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-accent/50 bg-surface px-4 py-2 text-xs shadow-lg shadow-black/30"
        onClick={apply}
      >
        <RefreshCw className="size-3.5 text-accent" />
        Nova versão do app · <b className="text-accent">Atualizar</b>
      </button>
    </div>
  )
}
