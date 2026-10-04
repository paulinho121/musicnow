import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './App'
import { IntroSplash } from './components/IntroSplash'
import { ToastProvider } from './components/ui'
import { UpdateBanner } from './components/UpdateBanner'
import { ApiError } from './lib/api'
import { logout } from './lib/auth'
import { onRouteChange, setupUpdates } from './lib/updates'

setupUpdates()
router.subscribe(onRouteChange)

// Sessão que o servidor não reconhece mais (expirou, conta removida, outro dispositivo saiu):
// limpa o login local e volta para a tela de entrada, em vez de ficar preso num erro.
let signingOut = false
function onApiError(err: unknown) {
  if (!(err instanceof ApiError) || err.status !== 401 || signingOut) return
  signingOut = true
  logout().finally(() => {
    queryClient.clear()
    window.location.assign(`/entrar`)
  })
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Não insiste em erros de permissão/validação; só em falhas de rede/servidor.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        <UpdateBanner />
        <IntroSplash />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
