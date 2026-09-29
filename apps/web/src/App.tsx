import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { PageSpinner } from './components/ui'
import { useSession } from './lib/auth'
import { useMe } from './lib/queries'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { Importer } from './pages/Importer'
import { Library } from './pages/Library'
import { Profile } from './pages/Profile'
import { Setlists } from './pages/Setlists'
import { SongEditor } from './pages/SongEditor'
import { SongView } from './pages/SongView'
import { Welcome } from './pages/Welcome'

/** Exige login; quem ainda não preencheu o perfil vai para o onboarding. */
function RequireAuth() {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const me = useMe(Boolean(session))
  if (isPending || (session && me.isLoading)) return <PageSpinner />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  if (me.data && !me.data.onboarded && location.pathname !== '/perfil') return <Navigate to="/perfil" replace />
  return <Outlet />
}

/** Telas públicas: quem já está logado vai direto para o app. */
function PublicOnly() {
  const { data: session, isPending } = useSession()
  if (isPending) return <PageSpinner />
  if (session) return <Navigate to="/inicio" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/', element: <Welcome /> },
      { path: '/entrar', element: <AuthPage mode="login" /> },
      { path: '/criar-conta', element: <AuthPage mode="signup" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      // A tela da música ocupa a tela toda (sem menu), para leitura no palco.
      { path: '/musicas/:id', element: <SongView /> },
      {
        element: <Layout />,
        children: [
          { path: '/inicio', element: <Dashboard /> },
          { path: '/musicas', element: <Library /> },
          { path: '/musicas/nova', element: <SongEditor /> },
          { path: '/musicas/importar', element: <Importer /> },
          { path: '/musicas/:id/editar', element: <SongEditor /> },
          { path: '/repertorios', element: <Setlists /> },
          { path: '/perfil', element: <Profile /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
