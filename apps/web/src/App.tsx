import { type ComponentType, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, createBrowserRouter, type RouteObject, useLocation } from 'react-router'
import { RouteError } from './components/AppError'
import { Layout } from './components/Layout'
import { ChordPage, ChordsIndex } from './pages/PublicChords'
import { PartnerLink } from './pages/PartnerLink'
import { Transposer } from './pages/Transposer'
import { PublicTuner, TunerPage } from './pages/TunerPages'
import { PageSpinner } from './components/ui'
import { rememberedSession, rememberSession, useSession } from './lib/auth'
import { useMe } from './lib/queries'
import { AuthPage } from './pages/AuthPage'
import { Privacy, Terms } from './pages/Legal'
import { ForgotPassword, ResetPassword } from './pages/PasswordReset'
import { Welcome } from './pages/Welcome'

/**
 * Telas do app (com login): cada uma num arquivo separado, baixado só quando for aberta.
 * A página inicial e as ferramentas públicas ficam no pacote principal (abrem na hora).
 * Os pedaços também ficam guardados no aparelho pelo service worker (funcionam sem internet).
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}
const PartnerDashboard = page(() => import('./pages/PartnerDashboard'), 'PartnerDashboard')
const QuickStart = page(() => import('./pages/QuickStart'), 'QuickStart')
const ChordDetect = page(() => import('./pages/ChordDetect'), 'ChordDetect')
const Dashboard = page(() => import('./pages/Dashboard'), 'Dashboard')
const FindSong = page(() => import('./pages/FindSong'), 'FindSong')
const Importer = page(() => import('./pages/Importer'), 'Importer')
const InviteAccept = page(() => import('./pages/InviteAccept'), 'InviteAccept')
const Library = page(() => import('./pages/Library'), 'Library')
const PrintSetlist = page(() => import('./pages/PrintView'), 'PrintSetlist')
const PrintSong = page(() => import('./pages/PrintView'), 'PrintSong')
const PrintStageSheet = page(() => import('./pages/PrintView'), 'PrintStageSheet')
const Profile = page(() => import('./pages/Profile'), 'Profile')
const SetlistDetail = page(() => import('./pages/SetlistDetail'), 'SetlistDetail')
const SetlistForm = page(() => import('./pages/SetlistForm'), 'SetlistForm')
const SetlistPlay = page(() => import('./pages/SetlistPlay'), 'SetlistPlay')
const SharedSongAccept = page(() => import('./pages/SharedSongAccept'), 'SharedSongAccept')
const Setlists = page(() => import('./pages/Setlists'), 'Setlists')
const SongEditor = page(() => import('./pages/SongEditor'), 'SongEditor')
const SongView = page(() => import('./pages/SongView'), 'SongView')
const Subscription = page(() => import('./pages/Subscription'), 'Subscription')
const Checkout = page(() => import('./pages/Checkout'), 'Checkout')
const Help = page(() => import('./pages/Help'), 'Help')
const AdminSupport = page(() => import('./pages/admin/AdminSupport'), 'AdminSupport')
const AdminLayout = page(() => import('./pages/admin/AdminLayout'), 'AdminLayout')
const AdminOverview = page(() => import('./pages/admin/AdminOverview'), 'AdminOverview')
const AdminErrors = page(() => import('./pages/admin/AdminErrors'), 'AdminErrors')
const AdminFunnel = page(() => import('./pages/admin/AdminFunnel'), 'AdminFunnel')
const AdminPartners = page(() => import('./pages/admin/AdminPartners'), 'AdminPartners')
const AdminReports = page(() => import('./pages/admin/AdminReports'), 'AdminReports')
const AdminTraffic = page(() => import('./pages/admin/AdminTraffic'), 'AdminTraffic')
const AdminUsers = page(() => import('./pages/admin/AdminUsers'), 'AdminUsers')

/** Mostra a tela carregando enquanto o pedaço dela chega. */
export function LazyOutlet() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
    </Suspense>
  )
}

/** Exige login; quem ainda não preencheu o perfil vai para o onboarding. */
function RequireAuth() {
  const { data: session, isPending, error } = useSession()
  const location = useLocation()
  const me = useMe(Boolean(session))
  useEffect(() => {
    if (session) rememberSession(session.user.id)
  }, [session])
  // Sem internet ou servidor fora do ar: entra com o que está salvo no aparelho (palco sem sinal).
  const offline = !session && Boolean(error) && Boolean(rememberedSession())
  if (isPending || (session && me.isLoading)) return <PageSpinner />
  if (offline) return <Outlet />
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
  // Enquanto confere o login, já mostra a página (sem tela de carregando): quem chega pelo
  // Google vê o conteúdo na hora; quem já está logado é levado ao app logo em seguida.
  if (isPending) return <Outlet />
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
    element: <LazyOutlet />,
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
      // Ferramentas grátis (para o Google e para quem ainda não tem conta).
      { path: '/acordes', element: <ChordsIndex /> },
      { path: '/acordes/:slug', element: <ChordPage /> },
      { path: '/transpor-cifra', element: <Transposer /> },
      { path: '/afinador-online', element: <PublicTuner /> },
      { path: '/afinador-online/:slug', element: <PublicTuner /> },
      // Link do parceiro: guarda o cupom e leva ao cadastro.
      { path: '/p/:code', element: <PartnerLink /> },
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
              { path: '/afinador', element: <TunerPage /> },
              { path: '/comecar', element: <QuickStart /> },
              { path: '/musicas', element: <Library /> },
              { path: '/musicas/nova', element: <SongEditor /> },
              { path: '/musicas/importar', element: <Importer /> },
              { path: '/musicas/detectar', element: <ChordDetect /> },
              { path: '/musicas/encontrar', element: <FindSong /> },
              { path: '/musicas/:id/editar', element: <SongEditor /> },
              { path: '/repertorios', element: <Setlists /> },
              { path: '/repertorios/novo', element: <SetlistForm /> },
              { path: '/repertorios/:id', element: <SetlistDetail /> },
              { path: '/repertorios/:id/editar', element: <SetlistForm /> },
              { path: '/convite/:code', element: <InviteAccept /> },
              { path: '/compartilhado/:code', element: <SharedSongAccept /> },
              { path: '/perfil', element: <Profile /> },
              { path: '/assinatura', element: <Subscription /> },
              { path: '/assinatura/pagar/:id', element: <Checkout /> },
              { path: '/ajuda', element: <Help /> },
              { path: '/parceiro', element: <PartnerDashboard /> },
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
                      { path: 'parceiros', element: <AdminPartners /> },
                      { path: 'funil', element: <AdminFunnel /> },
                      { path: 'suporte', element: <AdminSupport /> },
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
