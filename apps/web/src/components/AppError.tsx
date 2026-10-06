import { Home, RotateCw } from 'lucide-react'
import { Component, type ReactNode, useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { isChunkLoadError, reportError } from '../lib/errors'

const RELOADED_KEY = 'ef-recarregou-versao'

/**
 * Versão nova publicada no meio do uso: a tela pede um pedaço antigo do app que não existe
 * mais. Recarrega sozinho uma vez (pega a versão nova) em vez de mostrar erro.
 */
function reloadOnceForNewVersion() {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false
    sessionStorage.setItem(RELOADED_KEY, '1')
  } catch {
    return false
  }
  location.reload()
  return true
}

/** Tela amigável no lugar da tela branca. `inline` = dentro do app (o menu continua). */
export function ErrorScreen({ inline = false }: { inline?: boolean }) {
  return (
    <div className={inline ? 'grid min-h-[60dvh] place-items-center px-4' : 'grid min-h-dvh place-items-center bg-bg px-5'}>
      <div className="max-w-sm text-center">
        <img src="/logo-mark.svg" alt="" className="mx-auto h-14 w-auto opacity-90" />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-sm text-muted">
          Já fomos avisados e vamos corrigir. Suas músicas e repertórios estão salvos. Tente de novo ou volte para o início.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button className="btn-primary" onClick={() => location.reload()}>
            <RotateCw className="size-4" /> Tentar de novo
          </button>
          <a href="/inicio" className="btn-ghost">
            <Home className="size-4" /> Ir para o início
          </a>
        </div>
      </div>
    </div>
  )
}

/** Erro numa tela (rotas): avisa o servidor e mostra a tela amigável. */
export function RouteError({ inline = false }: { inline?: boolean }) {
  const error = useRouteError()
  const chunk = isChunkLoadError(error)
  useEffect(() => {
    if (chunk && reloadOnceForNewVersion()) return
    // 404 de rota não é erro do app.
    if (!(isRouteErrorResponse(error) && error.status === 404)) reportError(error, 'Tela')
  }, [error, chunk])
  return <ErrorScreen inline={inline} />
}

/** Último recurso: erro fora das telas (ex.: ao montar o app). */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return
    reportError(error, 'App')
  }
  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children
  }
}

/** Abriu bem depois de recarregar: libera um novo recarregamento automático no futuro. */
export function clearReloadFlag() {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOADED_KEY)
    } catch {
      // sem sessionStorage: nada a limpar
    }
  }, 10_000)
}
