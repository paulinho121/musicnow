import { formatBRL, isValidCpfCnpj, onlyDigits, PLANS, type PlanId } from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowLeft, Check, CreditCard, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { useToast } from '../components/ui'
import { useCancelSubscription, useCheckout, usePayments } from '../lib/billing'
import { useMe } from '../lib/queries'
import type { BillingSummary } from '../lib/types'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const fmtDate = (d: string | null) => (d ? dateFmt.format(new Date(d.length === 10 ? `${d}T12:00:00` : d)) : '')

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  RECEIVED: 'Pago',
  CONFIRMED: 'Pago',
  RECEIVED_IN_CASH: 'Pago',
  OVERDUE: 'Atrasado',
  REFUNDED: 'Reembolsado',
  REFUND_REQUESTED: 'Reembolso pedido',
}
const METHOD: Record<string, string> = { PIX: 'Pix', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto', UNDEFINED: 'A escolher' }

/** "529.982.247-25" / "11.222.333/0001-81" enquanto digita. */
function maskCpfCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14)
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function Subscription() {
  const { data: me } = useMe()
  const b = me?.billing
  const toast = useToast()
  const checkout = useCheckout()
  const cancel = useCancelSubscription()
  const payments = usePayments(Boolean(b?.configured))
  const [plan, setPlan] = useState<PlanId>(b?.plan ?? 'yearly')
  const [name, setName] = useState(me?.name ?? '')
  const [doc, setDoc] = useState('')

  if (!b) return null
  const subscribed = (b.status === 'active' || b.status === 'past_due') && b.reason === 'subscription'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidCpfCnpj(doc)) return toast('Confira o CPF ou CNPJ.', 'error')
    checkout.mutate({ plan, name: name.trim(), cpfCnpj: doc }, { onError: (err) => toast(err.message, 'error') })
  }

  const doCancel = () => {
    if (!confirm('Cancelar a renovação? Você continua com acesso até o fim do período já pago.')) return
    cancel.mutate(undefined, { onSuccess: () => toast('Renovação cancelada.'), onError: (err) => toast(err.message, 'error') })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/perfil" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">Assinatura</h1>
      </div>

      <StatusCard b={b} />

      {!subscribed && (
        <form onSubmit={submit} className="card space-y-5 p-5">
          <div>
            <h2 className="text-lg font-bold">Escolha o plano</h2>
            <p className="text-sm text-muted">Só quem cria músicas e repertórios assina. A sua banda toca de graça.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['monthly', 'yearly'] as const).map((id) => {
              const p = PLANS[id]
              const on = plan === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlan(id)}
                  aria-pressed={on}
                  className={clsx('relative rounded-2xl border p-4 text-left transition', on ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/40')}
                >
                  {id === 'yearly' && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">2 meses grátis</span>
                  )}
                  <p className="text-sm font-semibold text-muted">{p.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {formatBRL(p.price)}
                    <span className="text-sm font-medium text-muted">{id === 'monthly' ? '/mês' : '/ano'}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{id === 'yearly' ? `Equivale a ${formatBRL(p.price / 12)} por mês` : 'Cancele quando quiser'}</p>
                  {on && <Check className="absolute right-3 bottom-3 size-5 text-accent" />}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Nome completo</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" required />
            </label>
            <label className="block">
              <span className="label">CPF ou CNPJ</span>
              <input
                className="input font-mono"
                value={doc}
                onChange={(e) => setDoc(maskCpfCnpj(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                required
              />
            </label>
          </div>
          <p className="text-xs text-muted">O nome e o CPF/CNPJ vão na nota fiscal. Pedimos só o necessário para a cobrança.</p>

          <button className="btn-primary w-full" disabled={checkout.isPending || !b.configured}>
            {checkout.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {b.configured ? (b.pending ? 'Ir para o pagamento' : 'Continuar para o pagamento') : 'Pagamentos em breve'}
          </button>
          <p className="flex items-start gap-2 text-xs text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Você paga na página segura do Asaas, por Pix, cartão ou boleto. O Ensaio Fácil não vê nem guarda os dados do seu cartão.
            {b.reason === 'trial' && ' Ainda no teste? A primeira cobrança só vence no fim dele.'}
          </p>
        </form>
      )}

      {payments.data && payments.data.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Pagamentos</h2>
          <ul className="divide-y divide-border text-sm">
            {payments.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {formatBRL(p.value)} · {METHOD[p.billingType] ?? p.billingType}
                  </span>
                  <span className="block text-xs text-muted">
                    {PAYMENT_STATUS[p.status] ?? p.status} · {p.paymentDate ? `pago em ${fmtDate(p.paymentDate)}` : `vence em ${fmtDate(p.dueDate)}`}
                  </span>
                </span>
                <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="btn-ghost h-9 shrink-0 px-3 text-xs">
                  {p.status === 'PENDING' || p.status === 'OVERDUE' ? 'Pagar' : 'Recibo'} <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {subscribed && b.status !== 'canceled' && (
        <button className="text-sm text-muted underline-offset-4 hover:text-danger hover:underline" onClick={doCancel} disabled={cancel.isPending}>
          Cancelar a renovação
        </button>
      )}

      <section className="space-y-2 text-xs text-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Direito de arrependimento: até 7 dias depois do pagamento, você pode pedir o reembolso integral pelo suporte.
        </p>
        <p>
          A assinatura renova sozinha no fim de cada período, até você cancelar. Ao assinar você concorda com os{' '}
          <Link to="/termos" className="underline">
            Termos de uso
          </Link>{' '}
          e a{' '}
          <Link to="/privacidade" className="underline">
            Política de privacidade
          </Link>
          .
        </p>
      </section>
    </div>
  )
}

function StatusCard({ b }: { b: BillingSummary }) {
  const lines: { title: string; text: string; tone: 'ok' | 'info' | 'warn' | 'danger' } = (() => {
    if (b.reason === 'admin') return { title: 'Acesso de administrador', text: 'Tudo liberado na sua conta.', tone: 'ok' }
    if (b.reason === 'free') return { title: 'Tudo liberado', text: 'A cobrança ainda não começou. Aproveite!', tone: 'ok' }
    if (b.reason === 'trial')
      return {
        title: `Teste grátis: ${b.trialDaysLeft === 1 ? 'falta 1 dia' : `faltam ${b.trialDaysLeft} dias`}`,
        text: `Tudo liberado até ${fmtDate(b.trialEndsAt)}. Depois, ver e tocar continua de graça; criar e editar fica para assinantes.`,
        tone: 'info',
      }
    if (b.reason === 'subscription') {
      const plan = b.plan ? PLANS[b.plan].label : ''
      if (b.status === 'canceled')
        return { title: `Plano ${plan} cancelado`, text: `Seu acesso continua até ${fmtDate(b.currentPeriodEnd)}. Você pode assinar de novo quando quiser.`, tone: 'warn' }
      if (b.status === 'past_due') return { title: 'Pagamento atrasado', text: 'Pague a cobrança em aberto para não perder a edição.', tone: 'warn' }
      return { title: `Plano ${plan} ativo`, text: `Renova em ${fmtDate(b.currentPeriodEnd)}.`, tone: 'ok' }
    }
    return {
      title: b.pending ? 'Pagamento pendente' : 'Teste grátis encerrado',
      text: b.pending
        ? 'Conclua o pagamento para voltar a criar e editar.'
        : 'Ver e tocar continua liberado. Para criar e editar músicas e repertórios, escolha um plano abaixo.',
      tone: 'danger',
    }
  })()
  return (
    <section
      className={clsx(
        'rounded-2xl border p-5',
        lines.tone === 'ok' && 'border-ok/40 bg-ok/10',
        lines.tone === 'info' && 'border-border bg-surface',
        lines.tone === 'warn' && 'border-accent/50 bg-accent/10',
        lines.tone === 'danger' && 'border-danger/40 bg-danger/10',
      )}
    >
      <p className="font-bold">{lines.title}</p>
      <p className="mt-1 text-sm text-muted">{lines.text}</p>
    </section>
  )
}
