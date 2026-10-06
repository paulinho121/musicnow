import { INSTRUMENTS, MUSICIAN_ROLES, type Instrument, type MusicianRole } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, ChevronRight, Crown, Handshake, LifeBuoy, LogOut, Mail, ShieldCheck, Moon, Star, Sun } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { DeleteAccount } from '../components/DeleteAccount'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { logout as endSession } from '../lib/auth'
import { useMe, useSaveProfile } from '../lib/queries'
import { getTheme, setTheme, type Theme } from '../lib/storage'

export function Profile() {
  const { data: me, isLoading, error } = useMe()
  const save = useSaveProfile()
  const toast = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  // Quem chegou por um convite volta para ele depois de preencher o perfil.
  const from = (useLocation().state as { from?: string } | null)?.from

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [role, setRole] = useState<MusicianRole | null>(null)
  const [instruments, setInstruments] = useState<{ instrument: Instrument; primary: boolean }[]>([])
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    setName(me.name)
    setCity(me.city ?? '')
    setRole(me.role)
    setInstruments(me.instruments)
  }, [me])

  if (isLoading) return <PageSpinner />
  if (error || !me) return <ErrorState error={error} />

  const onboarding = !me.onboarded

  const toggleInstrument = (i: Instrument) =>
    setInstruments((list) => {
      if (list.some((x) => x.instrument === i)) {
        const rest = list.filter((x) => x.instrument !== i)
        if (rest.length && !rest.some((x) => x.primary)) rest[0] = { ...rest[0], primary: true }
        return rest
      }
      return [...list, { instrument: i, primary: list.length === 0 }]
    })

  const makePrimary = (i: Instrument) => setInstruments((list) => list.map((x) => ({ ...x, primary: x.instrument === i })))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) return setFormError('Informe seu nome.')
    if (!role) return setFormError('Escolha como você atua na música.')
    if (!instruments.length) return setFormError('Escolha pelo menos um instrumento.')
    save.mutate(
      { name: name.trim(), city: city.trim() || null, role, instruments },
      {
        onSuccess: () => {
          toast('Perfil salvo.')
          // Conta nova sem destino (ex.: convite) vai montar o primeiro repertório.
          if (onboarding) navigate(from && from !== '/perfil' && from !== '/inicio' ? from : '/comecar', { replace: true })
        },
        onError: (err) => setFormError(err.message),
      },
    )
  }

  const logout = async () => {
    await endSession()
    qc.clear()
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">{onboarding ? 'Bem-vindo ao Ensaio Fácil!' : 'Perfil'}</h1>
        {onboarding && <p className="mt-1 text-muted">Conte um pouco sobre você para personalizarmos o app.</p>}
      </header>

      <section className="card grid gap-4 p-4 md:grid-cols-2 md:p-5">
        <label className="block">
          <span className="label">Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <label className="block">
          <span className="label">Cidade</span>
          <input
            className="input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex.: Fortaleza, CE"
            maxLength={120}
          />
        </label>
        <p className="text-sm text-muted md:col-span-2">
          E-mail: <span className="text-text">{me.email}</span>
        </p>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 font-semibold">Como você atua</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(MUSICIAN_ROLES) as MusicianRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={clsx(
                'flex h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-medium transition',
                role === r ? 'border-accent bg-accent/10 text-text' : 'border-border text-muted hover:text-text',
              )}
            >
              {MUSICIAN_ROLES[r]}
              {role === r && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="font-semibold">Instrumentos</h2>
        <p className="mb-3 text-sm text-muted">Toque para escolher. A estrela marca o principal.</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INSTRUMENTS) as Instrument[]).map((i) => {
            const sel = instruments.find((x) => x.instrument === i)
            return (
              <span key={i} className={clsx('chip pr-1', sel && 'chip-on')}>
                <button type="button" onClick={() => toggleInstrument(i)} aria-pressed={Boolean(sel)} className="h-full pr-1">
                  {INSTRUMENTS[i]}
                </button>
                {sel && (
                  <button
                    type="button"
                    onClick={() => makePrimary(i)}
                    aria-label={`Tornar ${INSTRUMENTS[i]} o instrumento principal`}
                    className="grid size-7 place-items-center"
                  >
                    <Star className={clsx('size-4', sel.primary ? 'fill-accent' : 'opacity-50')} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      </section>

      {!onboarding && (
        <section className="card flex items-center justify-between p-4 md:p-5">
          <div>
            <h2 className="font-semibold">Aparência</h2>
            <p className="text-sm text-muted">O modo escuro é o melhor para o palco.</p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              setThemeState(next)
            }}
          >
            {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {theme === 'dark' ? 'Escuro' : 'Claro'}
          </button>
        </section>
      )}

      {!onboarding && (
        <label className="card flex cursor-pointer items-center justify-between gap-4 p-4 md:p-5">
          <span>
            <span className="flex items-center gap-2 font-semibold">
              <Mail className="size-4 text-muted" /> Lembretes por e-mail
            </span>
            <span className="block text-sm text-muted">Show amanhã e fim do teste grátis. Avisos de pagamento sempre chegam.</span>
          </span>
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--accent)]"
            checked={me.emailReminders ?? true}
            disabled={save.isPending}
            onChange={(e) =>
              // Salva na hora, com os dados já salvos do perfil (não mexe no que está sendo editado).
              save.mutate(
                { name: me.name, city: me.city, role: me.role, instruments: me.instruments, emailReminders: e.target.checked },
                {
                  onSuccess: (m) => toast(m.emailReminders ? 'Lembretes ligados.' : 'Lembretes desligados.'),
                  onError: (err) => toast(err.message, 'error'),
                },
              )
            }
          />
        </label>
      )}

      {formError && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      {!onboarding && me.partnerCode && (
        <Link to="/parceiro" className="card flex items-center gap-3 border-accent/40 p-4 transition hover:border-accent">
          <Handshake className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Painel do parceiro</span>
            <span className="block text-sm text-muted">Seu cupom {me.partnerCode}, link para divulgar e comissões</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {!onboarding && me.isAdmin && (
        <Link to="/admin" className="card flex items-center gap-3 p-4 transition hover:border-accent/50 md:hidden">
          <ShieldCheck className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Gestão</span>
            <span className="block text-sm text-muted">Painel do administrador</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {!onboarding && (
        <Link to="/ajuda" className="card flex items-center gap-3 p-4 transition hover:border-accent/50">
          <LifeBuoy className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Ajuda</span>
            <span className="block text-sm text-muted">Perguntas frequentes, relatar um problema ou mandar uma sugestão</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {!onboarding && (
        <Link to="/assinatura" className="card flex items-center gap-3 p-4 transition hover:border-accent/50">
          <Crown className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Assinatura</span>
            <span className="block text-sm text-muted">Plano, pagamentos e notas fiscais</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" className="btn-ghost" onClick={logout}>
          <LogOut className="size-4" /> Sair
        </button>
        <button type="submit" className="btn-primary sm:min-w-44" disabled={save.isPending}>
          {save.isPending ? 'Salvando...' : onboarding ? 'Começar' : 'Salvar perfil'}
        </button>
      </div>

      {!onboarding && <DeleteAccount />}
    </form>
  )
}
