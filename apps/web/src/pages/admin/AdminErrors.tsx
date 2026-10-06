import clsx from 'clsx'
import { Bug, Check, ChevronDown, Monitor, Server } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../../components/ui'
import { useAdminErrors, useResolveError } from '../../lib/admin'
import type { AdminAppError } from '../../lib/types'

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}

/** Navegador resumido: "Chrome · Android". */
function device(ua: string | null) {
  if (!ua) return null
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return [browser, os].filter(Boolean).join(' · ') || null
}

export function AdminErrors() {
  const { data, isLoading, error, refetch } = useAdminErrors()
  const resolve = useResolveError()
  const toast = useToast()

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const done = (id?: string) =>
    resolve.mutate(id, {
      onSuccess: () => toast(id ? 'Marcado como resolvido.' : 'Lista limpa.', 'ok'),
      onError: (e) => toast(e.message, 'error'),
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Erros do app</h2>
          <p className="text-xs text-muted">
            Erros das telas e do servidor, agrupados. Marque como resolvido depois de corrigir: se voltar a acontecer, aparece de novo.
          </p>
        </div>
        {data.errors.length > 1 && (
          <button className="btn-ghost h-9 text-xs" onClick={() => done()} disabled={resolve.isPending}>
            <Check className="size-4" /> Limpar todos
          </button>
        )}
      </div>

      {data.errors.length === 0 ? (
        <EmptyState icon={Bug} title="Nenhum erro registrado">
          Tudo funcionando. Quando uma tela ou o servidor falhar, aparece aqui na hora.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.errors.map((e) => (
            <ErrorRow key={e.id} e={e} onResolve={() => done(e.id)} busy={resolve.isPending} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ErrorRow({ e, onResolve, busy }: { e: AdminAppError; onResolve: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const recent = Date.now() - new Date(e.lastSeenAt).getTime() < 24 * 60 * 60 * 1000
  const Icon = e.source === 'api' ? Server : Monitor
  return (
    <li className={clsx('card overflow-hidden border', recent ? 'border-danger/30' : 'border-border')}>
      <div className="flex items-start gap-3 p-4">
        <span
          className={clsx(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            recent ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-muted',
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm break-words">{e.message}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="font-semibold text-text">{e.count}×</span>
            <span>{e.source === 'api' ? 'Servidor' : 'Tela'}</span>
            <span>último {ago(e.lastSeenAt)}</span>
            {e.url && <span className="font-mono">{e.url}</span>}
            {device(e.userAgent) && <span>{device(e.userAgent)}</span>}
            {e.lastUserName && <span>com {e.lastUserName}</span>}
            {e.release && <span>versão {e.release}</span>}
          </p>
        </div>
        <button className="btn-ghost h-9 shrink-0 px-3 text-xs" onClick={onResolve} disabled={busy} aria-label="Marcar como resolvido">
          <Check className="size-4" />
          <span className="max-sm:sr-only">Resolvido</span>
        </button>
      </div>
      {e.stack && (
        <>
          <button
            className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <ChevronDown className={clsx('size-3.5 transition', !open && '-rotate-90')} /> Detalhes técnicos
          </button>
          {open && <pre className="max-h-72 overflow-auto bg-bg px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">{e.stack}</pre>}
        </>
      )}
    </li>
  )
}
