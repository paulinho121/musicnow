import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'
import { authErrorMessage, signIn, signUp } from '../lib/auth'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const from = (location.state as { from?: string } | null)?.from ?? '/inicio'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    qc.clear()
    // Conta nova vai direto para o perfil (instrumento e tipo de atuação).
    navigate(mode === 'signup' ? '/perfil' : from, { replace: true })
  }

  const social = async (provider: 'google' | 'apple') => {
    setError(null)
    const res = await signIn.social({ provider, callbackURL: `${window.location.origin}/inicio` })
    if (res?.error) setError(authErrorMessage(res.error))
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 self-center">
        <Logo />
      </Link>
      <h1 className="text-2xl font-bold">{mode === 'signup' ? 'Criar conta' : 'Entrar'}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        {mode === 'signup' ? 'Leva menos de um minuto.' : 'Bom te ver de novo.'}
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
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Aguarde...' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === 'signup' ? (
          <>
            Já tem conta?{' '}
            <Link to="/entrar" className="font-semibold text-accent">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Novo por aqui?{' '}
            <Link to="/criar-conta" className="font-semibold text-accent">
              Criar conta
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
