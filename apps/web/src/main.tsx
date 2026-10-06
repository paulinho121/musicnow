import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './App'
import { AppErrorBoundary, clearReloadFlag } from './components/AppError'
import { PaywallDialog } from './components/BillingNotice'
import { IntroSplash } from './components/IntroSplash'
import { OfflineBanner } from './components/OfflineBanner'
import { ToastProvider } from './components/ui'
import { UpdateBanner } from './components/UpdateBanner'
import { ApiError } from './lib/api'
import { logout } from './lib/auth'
import { openPaywall } from './lib/billing'
import { setupErrorReporting } from './lib/errors'
import { applyRouteMeta } from './lib/seo'
import { onRouteChange, setupUpdates } from './lib/updates'

setupErrorReporting()
setupUpdates()
clearReloadFlag()
router.subscribe(onRouteChange)
// Título, descrição e indexação de cada tela (Google).
applyRouteMeta(router.state.location.pathname)
router.subscribe((s) => applyRouteMeta(s.location.pathname))

// Sessão que o servidor não reconhece mais (expirou, conta removida, outro dispositivo saiu):
// limpa o login local e volta para a tela de entrada, em vez de ficar preso num erro.
let signingOut = false
function onApiError(err: unknown) {
  // 402: criar/editar sem assinatura ativa → janela "Assine para continuar".
  if (err instanceof ApiError && err.status === 402) return openPaywall(err.message)
  if (!(err instanceof ApiError) || err.status !== 401 || signingOut) return
  signingOut = true
  // Conta bloqueada pelo suporte: a tela de entrada mostra o motivo.
  const blocked = /bloquead/i.test(err.message)
  logout().finally(() => {
    queryClient.clear()
    window.location.assign(blocked ? '/entrar?motivo=bloqueada' : '/entrar')
  })
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Sem internet, tenta mesmo assim: o service worker responde com o que está guardado
      // no aparelho (repertório baixado para o show). O padrão pausaria a busca para sempre.
      networkMode: 'offlineFirst',
      // Não insiste em erros de permissão/validação; só em falhas de rede/servidor.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
          <UpdateBanner />
          <OfflineBanner />
          <IntroSplash />
          <PaywallDialog />
        </ToastProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
