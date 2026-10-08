import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Illustration, type IllustrationName } from './Illustration'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-label="Carregando" className={clsx('animate-spin text-muted', className ?? 'size-6')} />
}

export function PageSpinner() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Spinner className="size-8" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-surface-2', className)} />
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  art,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  /** Ilustração no lugar do ícone (telas vazias principais). */
  art?: IllustrationName
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      {art ? (
        <Illustration name={art} className="size-36" />
      ) : (
        <div className="grid size-12 place-items-center rounded-2xl bg-surface-2">
          <Icon className="size-6 text-muted" />
        </div>
      )}
      <h3 className={art ? 'text-xl font-extrabold' : 'text-base font-semibold'}>{title}</h3>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Algo deu errado.'
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-danger" />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

export function KeyBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null
  return (
    <span
      className={clsx(
        'inline-flex h-7 min-w-9 items-center justify-center rounded-lg bg-accent/15 px-2 font-mono text-sm font-bold text-chord',
        className,
      )}
    >
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Toasts: feedback rápido de ações concluídas ou com erro.

type Toast = { id: number; message: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm shadow-lg shadow-black/30"
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 className="size-4 shrink-0 text-ok" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-danger" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
