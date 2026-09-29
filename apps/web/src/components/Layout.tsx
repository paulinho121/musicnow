import clsx from 'clsx'
import { Home, ListMusic, Music2, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { Logo } from './Logo'

const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/musicas', label: 'Músicas', icon: Music2 },
  { to: '/repertorios', label: 'Repertórios', icon: ListMusic },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

/** Casca do app: barra lateral no computador, barra inferior no celular (uso com uma mão). */
export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <div className="mb-6 px-2 pt-2">
          <Logo />
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
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
