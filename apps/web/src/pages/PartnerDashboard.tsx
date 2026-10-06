import { formatBRL } from '@ensaio/shared'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, Check, Copy, Gift, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ErrorState, PageSpinner } from '../components/ui'
import { api } from '../lib/api'
import { shareLink } from '../lib/setlists'

interface PartnerData {
  partner: { code: string; name: string; active: boolean; commissionPercent: number; trialDays: number } | null
  holdDays: number
  totals: { signups: number; customers: number; payableCents: number; holdingCents: number; paidCents: number }
  referrals: {
    n: number
    createdAt: string
    status: 'signed' | 'converted' | 'payable' | 'paid' | 'canceled'
    plan: string | null
    commissionCents: number | null
    convertedAt: string | null
    paidAt: string | null
  }[]
}

const STATUS: Record<PartnerData['referrals'][number]['status'], { label: string; tone: string }> = {
  signed: { label: 'Testando', tone: 'text-muted' },
  converted: { label: 'Assinou · aguardando', tone: 'text-accent' },
  payable: { label: 'Assinou · a receber', tone: 'text-ok' },
  paid: { label: 'Pago', tone: 'text-ok' },
  canceled: { label: 'Reembolsado', tone: 'text-danger' },
}
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const brl = (cents: number) => formatBRL(cents / 100)

/** Painel do parceiro: cupom, link para divulgar e comissões (sem nomes de quem se cadastrou). */
export function PartnerDashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['partner', 'me'], queryFn: () => api<PartnerData>('/partners/me') })
  const [copied, setCopied] = useState<string | null>(null)
  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data.partner) return <Navigate to="/perfil" replace />

  const p = data.partner
  const link = `${location.origin}/p/${p.code.toLowerCase()}`
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }
  const t = data.totals

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/perfil" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Painel do parceiro</h1>
          <p className="text-sm text-muted">Olá, {p.name}! Divulgue o seu cupom e acompanhe as suas comissões.</p>
        </div>
      </div>

      {!p.active && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Sua parceria está pausada: o cupom não está aceitando novos cadastros.
        </p>
      )}

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Seu cupom</p>
            <p className="font-mono text-2xl font-extrabold tracking-wider">{p.code}</p>
          </div>
          <button className="btn-ghost h-10" onClick={() => copy(p.code, 'code')}>
            {copied === 'code' ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar cupom
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="input flex h-11 min-w-0 items-center truncate font-mono text-sm">{link}</code>
          <button className="btn-primary h-11 shrink-0" onClick={() => copy(link, 'link')}>
            {copied === 'link' ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar link
          </button>
          <button
            className="btn-ghost h-11 shrink-0"
            onClick={() =>
              shareLink(
                'Ensaio Fácil',
                `Uso o Ensaio Fácil para cifras e repertório da banda. Com o meu cupom ${p.code} você ganha ${p.trialDays} dias grátis:`,
                link,
              )
            }
          >
            Compartilhar
          </button>
        </div>
        <p className="text-sm text-muted">
          Quem se cadastra pelo seu link ou com o cupom ganha <b className="text-text">{p.trialDays} dias grátis</b>. Você ganha{' '}
          <b className="text-text">{p.commissionPercent}% do primeiro pagamento</b> de cada assinante (no plano anual, bem mais). A comissão
          é liberada {data.holdDays} dias depois do pagamento (prazo de arrependimento do cliente).
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Cadastros" value={String(t.signups)} />
        <Stat icon={Check} label="Assinantes" value={String(t.customers)} />
        <Stat
          icon={Wallet}
          label="A receber"
          value={brl(t.payableCents)}
          hint={t.holdingCents ? `+ ${brl(t.holdingCents)} aguardando` : undefined}
          highlight
        />
        <Stat icon={Wallet} label="Já recebido" value={brl(t.paidCents)} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 font-semibold">Suas indicações</h2>
        {data.referrals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Ainda ninguém se cadastrou com o seu cupom. Que tal um vídeo mostrando o Modo Palco?
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.referrals.map((r) => (
              <li key={r.n} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-16 shrink-0 font-mono text-muted">#{r.n}</span>
                <span className="w-20 shrink-0 text-muted">{dateFmt.format(new Date(r.createdAt))}</span>
                <span className={clsx('min-w-0 flex-1 font-medium', STATUS[r.status].tone)}>
                  {STATUS[r.status].label}
                  {r.plan && <span className="text-muted"> · {r.plan === 'yearly' ? 'anual' : 'mensal'}</span>}
                </span>
                <span className="shrink-0 font-semibold">
                  {r.commissionCents != null && r.status !== 'canceled' ? brl(r.commissionCents) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: typeof Users
  label: string
  value: string
  hint?: string
  highlight?: boolean
}) {
  return (
    <div className={clsx('card p-4', highlight && 'border-ok/40')}>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className={clsx('mt-1 text-xl font-extrabold', highlight && 'text-ok')}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
