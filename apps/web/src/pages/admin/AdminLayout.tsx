import clsx from 'clsx'
import { Activity, AlertOctagon, BarChart3, Bug, ShieldCheck, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

const TABS = [
  { to: '/admin', end: true, label: 'Visão Geral', icon: BarChart3 },
  { to: '/admin/visitas', label: 'Fluxo de Visitas', icon: Activity },
  { to: '/admin/usuarios', label: 'Usuários Cadastrados', icon: Users },
  { to: '/admin/denuncias', label: 'Moderação & Denúncias', icon: AlertOctagon },
  { to: '/admin/erros', label: 'Erros do App', icon: Bug },
]

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">Gestão & Super Admin</h1>
            <p className="text-xs text-muted">Controle de métricas, visitantes, usuários e moderação</p>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-border pb-2 scrollbar-none">
        {TABS.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition whitespace-nowrap',
                isActive ? 'bg-accent/15 text-accent shadow-xs' : 'text-muted hover:bg-surface hover:text-text',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
