import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Illustration, type IllustrationName } from './Illustration'

/**
 * Cartão "comece por aqui": ilustração, título grande, uma frase e um botão escuro bem claro
 * sobre o que fazer (no estilo dos apps que explicam cada tela).
 */
export function PromoCard({
  art,
  title,
  children,
  action,
}: {
  art: IllustrationName
  title: string
  children?: ReactNode
  action: { to: string; label: string } | { onClick: () => void; label: string }
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Illustration name={art} className="size-28 shrink-0 sm:size-32" />
        <div className="min-w-0">
          <h3 className="text-xl leading-tight font-extrabold sm:text-2xl">{title}</h3>
          {children && <p className="mt-1.5 text-sm text-muted">{children}</p>}
        </div>
      </div>
      {'to' in action ? (
        <Link to={action.to} className="btn-primary mt-5 h-12 w-full text-base">
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} className="btn-primary mt-5 h-12 w-full text-base">
          {action.label}
        </button>
      )}
    </div>
  )
}
