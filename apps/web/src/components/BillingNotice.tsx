import { formatBRL, PLANS } from '@ensaio/shared'
import clsx from 'clsx'
import { AlertTriangle, Clock, Crown, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PAYWALL_EVENT } from '../lib/billing'
import { useMe } from '../lib/queries'
import { Sheet } from './Sheet'

/** Faixa no topo: dias de teste, teste vencido, pagamento pendente ou atrasado. */
export function BillingBanner() {
  const { data: me } = useMe()
  const b = me?.billing
  if (!b?.enforced || b.reason === 'admin' || b.reason === 'partner' || b.reason === 'free') return null

  let tone: 'info' | 'warn' | 'danger' = 'info'
  let icon = Clock
  let text: string
  let cta = 'Assinar'
  if (b.reason === 'expired') {
    tone = 'danger'
    icon = AlertTriangle
    text = b.pending
      ? 'Falta concluir o pagamento para voltar a criar e editar.'
      : 'Seu teste grátis terminou. Ver e tocar continua liberado; para criar e editar, assine.'
    cta = b.pending ? 'Concluir pagamento' : `Assinar por ${formatBRL(PLANS.monthly.price)}`
  } else if (b.reason === 'trial') {
    tone = b.trialDaysLeft <= 3 ? 'warn' : 'info'
    text = b.pending
      ? 'Plano escolhido: a cobrança vence no fim do teste.'
      : `Teste grátis: ${b.trialDaysLeft === 1 ? 'falta 1 dia' : `faltam ${b.trialDaysLeft} dias`}.`
    cta = b.pending ? 'Ver assinatura' : 'Assinar'
  } else if (b.status === 'past_due') {
    tone = 'warn'
    icon = AlertTriangle
    text = 'O pagamento da assinatura está atrasado. Regularize para não perder a edição.'
    cta = 'Pagar agora'
  } else return null

  const Icon = icon
  return (
    <div
      className={clsx(
        // Celular: texto em cima, botão embaixo (largura toda); computador: lado a lado.
        'mb-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center',
        tone === 'danger' && 'border-danger/40 bg-danger/10',
        tone === 'warn' && 'border-accent/50 bg-accent/10',
        tone === 'info' && 'border-border bg-surface',
      )}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className={clsx('mt-px size-5 shrink-0', tone === 'danger' ? 'text-danger' : 'text-accent')} />
        <p className="min-w-0 flex-1">{text}</p>
      </div>
      <Link to="/assinatura" className={clsx('shrink-0', tone === 'info' ? 'btn-ghost h-9 px-3' : 'btn-primary h-9 px-3')}>
        {cta}
      </Link>
    </div>
  )
}

/** Janela "Assine para continuar": abre quando a API recusa criar/editar sem assinatura (402). */
export function PaywallDialog() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    const onPaywall = (e: Event) => setMessage((e as CustomEvent<string>).detail)
    window.addEventListener(PAYWALL_EVENT, onPaywall)
    return () => window.removeEventListener(PAYWALL_EVENT, onPaywall)
  }, [])

  return (
    <Sheet open={message !== null} onClose={() => setMessage(null)} title="Assine para continuar">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Crown className="size-5" />
          </span>
          <p className="text-sm">{message}</p>
        </div>
        <ul className="space-y-1.5 text-sm text-muted">
          {[
            'Músicas, cifras e partituras ilimitadas',
            'Repertórios com blocos e Modo Palco para a banda',
            'A banda toca de graça: só quem cria assina',
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-accent" /> {t}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-xl border border-border p-3">
            <p className="text-muted">Mensal</p>
            <p className="text-lg font-bold">{formatBRL(PLANS.monthly.price)}</p>
          </div>
          <div className="rounded-xl border border-accent/50 bg-accent/10 p-3">
            <p className="text-muted">Anual</p>
            <p className="text-lg font-bold">{formatBRL(PLANS.yearly.price)}</p>
          </div>
        </div>
        {/* Link comum: a janela fica fora do roteador (vale para qualquer tela). */}
        <a href="/assinatura" className="btn-primary w-full">
          Ver planos e assinar
        </a>
        <button className="btn-ghost w-full" onClick={() => setMessage(null)}>
          Agora não
        </button>
      </div>
    </Sheet>
  )
}
