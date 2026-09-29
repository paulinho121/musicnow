import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'
import { authClient, authErrorMessage } from '../lib/auth'

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 self-center">
        <Logo />
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>}
      {children}
    </div>
  )
}

/** Pede o link de redefinição por e-mail. */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { data: meta } = useQuery({
    queryKey: ['meta'],
    queryFn: () => api<{ providers: string[]; passwordReset: boolean }>('/meta'),
    staleTime: Infinity,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) return setError('Digite um e-mail válido.')
    setBusy(true)
    const res = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setBusy(false)
    if (res.error && res.error.status === 429) return setError(authErrorMessage(res.error))
    // Mesma resposta exista ou não a conta: não revelamos quem está cadastrado.
    setSent(true)
  }

  if (meta && !meta.passwordReset)
    return (
      <Shell title="Recuperar senha">
        <p className="card p-4 text-sm text-muted">
          A recuperação de senha por e-mail ainda não está ativa neste servidor. Fale com o responsável pelo Ensaio Fácil
          para redefinir sua senha.
        </p>
        <Link to="/entrar" className="btn-ghost mt-6">
          Voltar para entrar
        </Link>
      </Shell>
    )

  if (sent)
    return (
      <Shell title="Confira seu e-mail">
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck className="size-10 text-accent" />
          <p className="text-sm">
            Se existir uma conta com <b>{email}</b>, enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </p>
          <p className="text-xs text-muted">Não chegou? Olhe a caixa de spam ou tente de novo em alguns minutos.</p>
        </div>
        <Link to="/entrar" className="btn-ghost mt-6">
          Voltar para entrar
        </Link>
      </Shell>
    )

  return (
    <Shell title="Recuperar senha" subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">E-mail</span>
          <input className="input" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Enviando...' : 'Enviar link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Lembrou?{' '}
        <Link to="/entrar" className="font-semibold text-accent">
          Entrar
        </Link>
      </p>
    </Shell>
  )
}

/** Chega aqui pelo link do e-mail: /redefinir-senha?token=... */
export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const linkError = params.get('error')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!token || linkError)
    return (
      <Shell title="Link inválido">
        <p className="card p-4 text-sm text-muted">Este link de redefinição é inválido ou já expirou. Peça um novo.</p>
        <Link to="/esqueci-senha" className="btn-primary mt-6">
          Pedir novo link
        </Link>
      </Shell>
    )

  if (done)
    return (
      <Shell title="Senha alterada">
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="size-10 text-ok" />
          <p className="text-sm">Pronto! Use a nova senha para entrar. Por segurança, as outras sessões foram encerradas.</p>
        </div>
        <button className="btn-primary mt-6" onClick={() => navigate('/entrar', { replace: true })}>
          Entrar
        </button>
      </Shell>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    const res = await authClient.resetPassword({ newPassword: password, token })
    setBusy(false)
    if (res.error) return setError(authErrorMessage(res.error))
    setDone(true)
  }

  return (
    <Shell title="Criar nova senha" subtitle="Escolha uma senha com pelo menos 8 caracteres.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">Nova senha</span>
          <input className="input" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Repita a senha</span>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </Shell>
  )
}
