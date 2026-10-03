import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { PageSpinner } from './components/ui'
import { useSession } from './lib/auth'
import { useMe } from './lib/queries'
import { AuthPage } from './pages/AuthPage'
import { ChordDetect } from './pages/ChordDetect'
import { Dashboard } from './pages/Dashboard'
import { Importer } from './pages/Importer'
import { InviteAccept } from './pages/InviteAccept'
import { Library } from './pages/Library'
import { ForgotPassword, ResetPassword } from './pages/PasswordReset'
import { PrintSetlist, PrintSong } from './pages/PrintView'
import { Profile } from './pages/Profile'
import { SetlistDetail } from './pages/SetlistDetail'
import { SetlistForm } from './pages/SetlistForm'
import { SetlistPlay } from './pages/SetlistPlay'
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
  if (me.data && !me.data.onboarded && location.pathname !== '/perfil')
    return <Navigate to="/perfil" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Telas públicas: quem já está logado vai direto para o app. */
function PublicOnly() {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  if (isPending) return <PageSpinner />
  // Assim que a sessão existe (login/cadastro), volta para onde a pessoa ia (ex.: um convite).
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/inicio'} replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/', element: <Welcome /> },
      { path: '/entrar', element: <AuthPage mode="login" /> },
      { path: '/criar-conta', element: <AuthPage mode="signup" /> },
      { path: '/esqueci-senha', element: <ForgotPassword /> },
    ],
  },
  // Aberta mesmo logado: o link do e-mail pode ser aberto em qualquer aparelho.
  { path: '/redefinir-senha', element: <ResetPassword /> },
  {
    element: <RequireAuth />,
    children: [
      // A tela da música ocupa a tela toda (sem menu), para leitura no palco.
      { path: '/musicas/:id', element: <SongView /> },
      { path: '/repertorios/:id/tocar/:pos', element: <SetlistPlay /> },
      { path: '/musicas/:id/imprimir', element: <PrintSong /> },
      { path: '/repertorios/:id/imprimir', element: <PrintSetlist /> },
      {
        element: <Layout />,
        children: [
          { path: '/inicio', element: <Dashboard /> },
          { path: '/musicas', element: <Library /> },
          { path: '/musicas/nova', element: <SongEditor /> },
          { path: '/musicas/importar', element: <Importer /> },
          { path: '/musicas/detectar', element: <ChordDetect /> },
          { path: '/musicas/:id/editar', element: <SongEditor /> },
          { path: '/repertorios', element: <Setlists /> },
          { path: '/repertorios/novo', element: <SetlistForm /> },
          { path: '/repertorios/:id', element: <SetlistDetail /> },
          { path: '/repertorios/:id/editar', element: <SetlistForm /> },
          { path: '/convite/:code', element: <InviteAccept /> },
          { path: '/perfil', element: <Profile /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
