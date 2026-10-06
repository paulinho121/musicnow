import { Navigate, Outlet, createBrowserRouter, type RouteObject, useLocation } from 'react-router'
import { RouteError } from './components/AppError'
import { Layout } from './components/Layout'
import { QuickStart } from './pages/QuickStart'
import { PageSpinner } from './components/ui'
import { useSession } from './lib/auth'
import { useMe } from './lib/queries'
import { AuthPage } from './pages/AuthPage'
import { ChordDetect } from './pages/ChordDetect'
import { ChordsPage } from './pages/ChordsPage'
import { Dashboard } from './pages/Dashboard'
import { FindSong } from './pages/FindSong'
import { Importer } from './pages/Importer'
import { Privacy, Terms } from './pages/Legal'
import { InviteAccept } from './pages/InviteAccept'
import { Library } from './pages/Library'
import { ForgotPassword, ResetPassword } from './pages/PasswordReset'
import { PrintSetlist, PrintSong, PrintStageSheet } from './pages/PrintView'
import { Profile } from './pages/Profile'
import { SetlistDetail } from './pages/SetlistDetail'
import { SetlistForm } from './pages/SetlistForm'
import { SetlistPlay } from './pages/SetlistPlay'
import { SharedSongAccept } from './pages/SharedSongAccept'
import { Setlists } from './pages/Setlists'
import { SongEditor } from './pages/SongEditor'
import { SongView } from './pages/SongView'
import { Subscription } from './pages/Subscription'
import { Welcome } from './pages/Welcome'

import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverview } from './pages/admin/AdminOverview'
import { AdminErrors } from './pages/admin/AdminErrors'
import { AdminReports } from './pages/admin/AdminReports'
import { AdminTraffic } from './pages/admin/AdminTraffic'
import { AdminUsers } from './pages/admin/AdminUsers'

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

/** Exige privilégios de Super Admin. */
function RequireAdmin() {
  const { data: session, isPending } = useSession()
  const me = useMe(Boolean(session))
  if (isPending || me.isLoading) return <PageSpinner />
  if (!session || !me.data?.isAdmin) return <Navigate to="/inicio" replace />
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

// Erro em qualquer tela: tela amigável (e aviso ao servidor) no lugar da tela branca.
// Dentro do app (inApp) o menu continua visível; só o conteúdo vira a tela de erro.
const inApp = (children: RouteObject[]): RouteObject[] => [{ errorElement: <RouteError inline />, children }]

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
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
      // Termos e privacidade: abertos para todos (antes de criar conta e dentro do app).
      { path: '/termos', element: <Terms /> },
      { path: '/privacidade', element: <Privacy /> },
      {
        element: <RequireAuth />,
        children: [
          // A tela da música ocupa a tela toda (sem menu), para leitura no palco.
          { path: '/musicas/:id', element: <SongView /> },
          { path: '/repertorios/:id/tocar/:pos', element: <SetlistPlay /> },
          { path: '/musicas/:id/imprimir', element: <PrintSong /> },
          { path: '/repertorios/:id/imprimir', element: <PrintSetlist /> },
          { path: '/repertorios/:id/folha', element: <PrintStageSheet /> },
          {
            element: <Layout />,
            children: inApp([
              { path: '/inicio', element: <Dashboard /> },
              { path: '/comecar', element: <QuickStart /> },
              { path: '/musicas', element: <Library /> },
              { path: '/musicas/nova', element: <SongEditor /> },
              { path: '/musicas/importar', element: <Importer /> },
              { path: '/musicas/detectar', element: <ChordDetect /> },
              { path: '/musicas/encontrar', element: <FindSong /> },
              { path: '/acordes', element: <ChordsPage /> },
              { path: '/musicas/:id/editar', element: <SongEditor /> },
              { path: '/repertorios', element: <Setlists /> },
              { path: '/repertorios/novo', element: <SetlistForm /> },
              { path: '/repertorios/:id', element: <SetlistDetail /> },
              { path: '/repertorios/:id/editar', element: <SetlistForm /> },
              { path: '/convite/:code', element: <InviteAccept /> },
              { path: '/compartilhado/:code', element: <SharedSongAccept /> },
              { path: '/perfil', element: <Profile /> },
              { path: '/assinatura', element: <Subscription /> },
              {
                element: <RequireAdmin />,
                children: [
                  {
                    path: '/admin',
                    element: <AdminLayout />,
                    children: [
                      { index: true, element: <AdminOverview /> },
                      { path: 'visitas', element: <AdminTraffic /> },
                      { path: 'usuarios', element: <AdminUsers /> },
                      { path: 'denuncias', element: <AdminReports /> },
                      { path: 'erros', element: <AdminErrors /> },
                    ],
                  },
                ],
              },
            ]),
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
