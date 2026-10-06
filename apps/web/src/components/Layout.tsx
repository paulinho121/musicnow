import clsx from 'clsx'
import { CalendarDays, Gauge, Home, LifeBuoy, ListMusic, Music2, ShieldCheck, UserRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'
import { redeemPendingCoupon } from '../lib/coupon'
import { keys, useMe } from '../lib/queries'
import { usePageTracking } from '../lib/usePageTracking'
import { BillingBanner } from './BillingNotice'
import { Logo } from './Logo'
import { PageSpinner, useToast } from './ui'

const BASE_NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/musicas', label: 'Músicas', icon: Music2 },
  { to: '/repertorios', label: 'Repertórios', icon: ListMusic },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/afinador', label: 'Afinador', icon: Gauge },
  // No celular a Ajuda fica no Perfil (a barra de baixo não comporta tudo).
  { to: '/ajuda', label: 'Ajuda', icon: LifeBuoy, desktopOnly: true },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

/** Casca do app: barra lateral no computador, barra inferior no celular (uso com uma mão). */
export function Layout() {
  usePageTracking()
  const { data: me } = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  // Cupom de parceiro guardado (link /p/luiz ou cadastro): usa assim que a pessoa entra no app.
  useEffect(() => {
    redeemPendingCoupon().then((r) => {
      if (!r) return
      toast(`Cupom ${r.code} aplicado: ${r.trialDays} dias grátis!`)
      qc.invalidateQueries({ queryKey: keys.me })
    })
  }, [qc, toast])

  const navItems = me?.isAdmin ? [...BASE_NAV, { to: '/admin', label: 'Gestão', icon: ShieldCheck, desktopOnly: true }] : BASE_NAV
  const mobileItems = navItems.filter((i) => !('desktopOnly' in i && i.desktopOnly))

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <div className="mb-6 px-2 pt-2">
          <Logo />
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface hover:text-text',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-4xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <BillingBanner />
        {/* A tela carrega aqui dentro: o menu continua visível. */}
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        className={clsx(
          'fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden',
        )}
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
      >
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex h-16 min-w-0 flex-col items-center justify-center gap-1 font-medium',
                mobileItems.length > 5 ? 'text-[10px]' : 'text-[11px]',
                isActive ? 'text-accent' : 'text-muted',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
