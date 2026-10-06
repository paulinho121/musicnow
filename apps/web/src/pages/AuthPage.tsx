import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, ListMusic, Loader2, Music2, Radio } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'
import { authErrorMessage, clearOfflineData, signIn, signUp } from '../lib/auth'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const from = (location.state as { from?: string } | null)?.from ?? '/inicio'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('motivo') === 'bloqueada'
      ? 'Esta conta está bloqueada. Fale com o suporte do Ensaio Fácil.'
      : null,
  )
  const [busy, setBusy] = useState(false)

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => api<{ providers: string[] }>('/meta'), staleTime: Infinity })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup' && !name.trim()) return setError('Informe seu nome.')
    if (!email.includes('@')) return setError('Digite um e-mail válido.')
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    setBusy(true)
    const res =
      mode === 'signup'
        ? await signUp.email({ name: name.trim(), email: email.trim(), password })
        : await signIn.email({ email: email.trim(), password })
    setBusy(false)
    if (res.error) return setError(authErrorMessage(res.error))
    await clearOfflineData()
    qc.clear()
    // Volta para onde a pessoa ia (ex.: um convite). Conta nova sem perfil preenchido
    // é levada ao onboarding pelo roteador, que guarda esse destino para depois.
    navigate(from, { replace: true })
  }

  const social = async (provider: 'google' | 'apple') => {
    setError(null)
    const res = await signIn.social({ provider, callbackURL: `${window.location.origin}/inicio` })
    if (res?.error) setError(authErrorMessage(res.error))
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-8">
        {/* Celular: brilho da marca atrás da logo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)] lg:hidden"
        />
        <div className="relative mx-auto w-full max-w-md">
          <Link to="/" className="mb-10 flex justify-center lg:hidden" aria-label="Ensaio Fácil">
            <Logo size="xl" />
          </Link>
          <div className="card p-6 shadow-2xl shadow-black/20 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{mode === 'signup' ? 'Crie sua conta' : 'Entrar'}</h1>
            <p className="mt-1.5 mb-7 text-sm text-muted">
              {mode === 'signup' ? '14 dias grátis, sem cartão. Leva menos de um minuto.' : 'Bom te ver de novo. Acesse seus repertórios.'}
            </p>

            {Boolean(meta?.providers.length) && (
              <div className="mb-5 space-y-2">
                {meta!.providers.includes('google') && (
                  <button type="button" className="btn-ghost w-full" onClick={() => social('google')}>
                    Continuar com Google
                  </button>
                )}
                {meta!.providers.includes('apple') && (
                  <button type="button" className="btn-ghost w-full" onClick={() => social('apple')}>
                    Continuar com Apple
                  </button>
                )}
                <p className="py-2 text-center text-xs text-muted">ou com e-mail</p>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <label className="block">
                  <span className="label">Nome</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
                </label>
              )}
              <label className="block">
                <span className="label">E-mail</span>
                <input
                  className="input"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus={mode === 'login'}
                />
              </label>
              <label className="block">
                <span className="label">Senha</span>
                <div className="relative">
                  <input
                    className="input pr-11"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center text-muted"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {mode === 'signup' && <span className="mt-1 block text-xs text-muted">Mínimo de 8 caracteres.</span>}
                {mode === 'login' && (
                  <Link to="/esqueci-senha" className="mt-2 inline-block text-sm text-muted hover:text-text">
                    Esqueci minha senha
                  </Link>
                )}
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary h-12 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta grátis' : 'Entrar'}
              </button>
              {mode === 'signup' && (
                <p className="text-center text-xs text-muted">
                  Ao criar a conta, você concorda com os{' '}
                  <Link to="/termos" className="underline">
                    Termos de uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/privacidade" className="underline">
                    Política de privacidade
                  </Link>
                  .
                </p>
              )}
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            {mode === 'signup' ? (
              <>
                Já tem conta?{' '}
                <Link to="/entrar" state={location.state} className="font-semibold text-accent">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Novo por aqui?{' '}
                <Link to="/criar-conta" state={location.state} className="font-semibold text-accent">
                  Criar conta
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}

const FEATURES = [
  { icon: Music2, title: 'Cifras em qualquer tom', text: 'Transponha com um toque; cada músico no tom dele.' },
  { icon: ListMusic, title: 'Repertórios por blocos', text: 'Monte o show, cole a lista do WhatsApp, imprima a folha de palco.' },
  { icon: Radio, title: 'Modo Palco ao vivo', text: 'A banda toda vê a mesma música, no mesmo tom, na hora.' },
]

/** Computador: lado da marca, com a logo grande e o que o app faz. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_0%,color-mix(in_srgb,var(--accent)_24%,transparent),transparent),radial-gradient(50%_50%_at_100%_100%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent)]"
      />
      {/* Pauta musical bem discreta ao fundo */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 text-text opacity-[0.05]"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M0 ${20 + i * 20} C 200 ${0 + i * 20}, 600 ${40 + i * 20}, 800 ${20 + i * 20}`}
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        ))}
      </svg>

      <Link to="/" className="relative" aria-label="Ensaio Fácil">
        <Logo size="xl" />
      </Link>

      <div className="relative max-w-lg">
        <h2 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
          Ensaie menos tempo.
          <br />
          <span className="text-accent">Toque melhor.</span>
        </h2>
        <p className="mt-4 text-lg text-muted">Cifras, repertórios e a banda inteira sincronizada, do ensaio ao palco.</p>
        <ul className="mt-10 space-y-5">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex gap-4 text-xs text-muted">
        <span>© {new Date().getFullYear()} Ensaio Fácil</span>
        <Link to="/termos" className="hover:text-text">
          Termos de uso
        </Link>
        <Link to="/privacidade" className="hover:text-text">
          Privacidade
        </Link>
      </p>
    </aside>
  )
}
