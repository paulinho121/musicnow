import { TRIAL_DAYS } from '@ensaio/shared'
import { ArrowRight } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Logo } from './Logo'

/**
 * Já tem login? (só no navegador: no build das páginas para o Google, sempre "não").
 * Uma consulta simples, sem o React Query (as páginas públicas também são geradas no build).
 */
function useLoggedIn() {
  const [logged, setLogged] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/auth/get-session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setLogged(Boolean(d?.session)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return logged
}

export function PublicHeader() {
  const logged = useLoggedIn()
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <Link to="/" aria-label="Ensaio Fácil, página inicial">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <Link to="/acordes" className="hidden px-3 text-sm font-medium text-muted hover:text-text md:block">
            Acordes
          </Link>
          <Link to="/transpor-cifra" className="hidden px-3 text-sm font-medium text-muted hover:text-text md:block">
            Transpor cifra
          </Link>
          <Link to="/afinador-online" className="hidden px-3 text-sm font-medium text-muted hover:text-text md:block">
            Afinador
          </Link>
          <Link to="/#precos" className="hidden px-3 text-sm font-medium text-muted hover:text-text lg:block">
            Preços
          </Link>
          {logged ? (
            <Link to="/inicio" className="btn-primary h-10 px-4">
              Abrir o app
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="px-3 text-sm font-semibold text-muted hover:text-text">
                Entrar
              </Link>
              <Link to="/criar-conta" className="btn-primary h-10 px-4">
                Testar grátis
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-muted sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs">Cifras, repertórios e a banda inteira no mesmo tom, do ensaio ao palco.</p>
        </div>
        <div>
          <p className="font-semibold text-text">Ferramentas grátis</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/acordes" className="hover:text-text">
                Dicionário de acordes
              </Link>
            </li>
            <li>
              <Link to="/transpor-cifra" className="hover:text-text">
                Transpor cifra online
              </Link>
            </li>
            <li>
              <Link to="/afinador-online" className="hover:text-text">
                Afinador online
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-text">Ensaio Fácil</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/criar-conta" className="hover:text-text">
                Testar grátis
              </Link>
            </li>
            <li>
              <Link to="/termos" className="hover:text-text">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-text">
                Privacidade
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-border py-5 text-center text-xs text-muted">© {new Date().getFullYear()} Ensaio Fácil</p>
    </footer>
  )
}

/** Página pública: cabeçalho, conteúdo e rodapé. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}

/** Chamada para testar o app (no meio das ferramentas grátis). */
export function TryCta({ title, text }: { title: string; text: string }) {
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,color-mix(in_srgb,var(--accent)_20%,transparent),transparent)]"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm text-muted">{text}</p>
        </div>
        <Link to="/criar-conta" className="btn-primary h-12 shrink-0 px-6">
          Testar {TRIAL_DAYS} dias grátis <ArrowRight className="size-4" />
        </Link>
      </div>
    </aside>
  )
}
