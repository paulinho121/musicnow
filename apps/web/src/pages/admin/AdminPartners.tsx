import { formatBRL } from '@ensaio/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, ChevronDown, Handshake, Pencil, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../../components/ui'
import { api } from '../../lib/api'

interface AdminPartner {
  id: string
  code: string
  name: string
  pixKey: string | null
  commissionPercent: number
  trialDays: number
  active: boolean
  notes: string | null
  userEmail: string | null
  signups: number
  customers: number
  payableCents: number
  holdingCents: number
  paidCents: number
}
interface AdminReferral {
  userId: string
  name: string | null
  email: string | null
  status: 'signed' | 'converted' | 'payable' | 'paid' | 'canceled'
  plan: string | null
  commissionCents: number | null
  createdAt: string
  convertedAt: string | null
  paidAt: string | null
}
type PartnerForm = {
  code: string
  name: string
  email: string
  pixKey: string
  commissionPercent: number
  trialDays: number
  active: boolean
  notes: string
}

const KEY = ['admin', 'partners'] as const
const brl = (cents: number) => formatBRL(cents / 100)
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
const STATUS: Record<AdminReferral['status'], string> = {
  signed: 'Testando',
  converted: 'Assinou · aguardando 8 dias',
  payable: 'A pagar',
  paid: 'Pago',
  canceled: 'Reembolsado',
}

export function AdminPartners() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ partners: AdminPartner[] }>('/admin/partners'),
  })
  const [editing, setEditing] = useState<AdminPartner | 'new' | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />
  const payable = data.partners.reduce((n, p) => n + p.payableCents, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Parceiros</h2>
          <p className="text-xs text-muted">
            Cupom com dias extras de teste e comissão única sobre o 1º pagamento, liberada 8 dias depois. Total a pagar agora:{' '}
            <b className="text-ok">{brl(payable)}</b>
          </p>
        </div>
        <button className="btn-primary h-10" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Novo parceiro
        </button>
      </div>

      {data.partners.length === 0 ? (
        <EmptyState icon={Handshake} title="Nenhum parceiro ainda">
          Cadastre o primeiro músico parceiro: ele ganha um cupom e o link /p/cupom para divulgar.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.partners.map((p, i) => (
            <li key={p.id} className={clsx('card overflow-hidden', !p.active && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 font-bold text-accent">{i + 1}º</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.name} <span className="font-mono text-sm text-accent">{p.code}</span>
                    {!p.active && <span className="ml-2 text-xs text-muted">(pausado)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {p.signups} cadastros · {p.customers} assinantes · {p.commissionPercent}% · {p.trialDays} dias de teste
                    {p.userEmail ? ` · conta ${p.userEmail}` : ' · sem conta ligada'}
                    {p.pixKey ? ` · Pix ${p.pixKey}` : ''}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-ok">{brl(p.payableCents)} a pagar</p>
                  <p className="text-xs text-muted">
                    {brl(p.holdingCents)} aguardando · {brl(p.paidCents)} pago
                  </p>
                </div>
                <button className="btn-icon size-9" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>
                  <Pencil className="size-4" />
                </button>
              </div>
              <button
                className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
                onClick={() => setOpen(open === p.id ? null : p.id)}
                aria-expanded={open === p.id}
              >
                <ChevronDown className={clsx('size-3.5 transition', open !== p.id && '-rotate-90')} /> Indicações
              </button>
              {open === p.id && <Referrals partnerId={p.id} />}
            </li>
          ))}
        </ul>
      )}

      <PartnerDialog partner={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Referrals({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading } = useQuery({
    queryKey: [...KEY, partnerId],
    queryFn: () => api<{ referrals: AdminReferral[] }>(`/admin/partners/${partnerId}/referrals`),
  })
  const markPaid = useMutation({
    mutationFn: (userId: string) => api(`/admin/referrals/${userId}/paid`, { method: 'POST' }),
    onSuccess: () => {
      toast('Comissão marcada como paga.', 'ok')
      qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (e) => toast(e.message, 'error'),
  })
  if (isLoading || !data) return <p className="px-4 py-3 text-xs text-muted">Carregando…</p>
  if (!data.referrals.length) return <p className="px-4 py-3 text-xs text-muted">Nenhuma indicação ainda.</p>
  return (
    <ul className="divide-y divide-border bg-bg/40">
      {data.referrals.map((r) => (
        <li key={r.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium">{r.name ?? 'Conta excluída'}</span>
            <span className="text-xs text-muted">
              {' '}
              · {r.email} · {dateFmt.format(new Date(r.createdAt))}
            </span>
          </span>
          <span
            className={clsx(
              'text-xs font-semibold',
              r.status === 'payable' ? 'text-ok' : r.status === 'canceled' ? 'text-danger' : 'text-muted',
            )}
          >
            {STATUS[r.status]}
            {r.plan && ` · ${r.plan === 'yearly' ? 'anual' : 'mensal'}`}
          </span>
          <span className="w-20 text-right font-semibold">{r.commissionCents != null ? brl(r.commissionCents) : '—'}</span>
          {r.status === 'payable' && (
            <button className="btn-ghost h-8 text-xs" onClick={() => markPaid.mutate(r.userId)} disabled={markPaid.isPending}>
              <Check className="size-3.5" /> Marcar pago
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function PartnerDialog({ partner, onClose }: { partner: AdminPartner | 'new' | null; onClose: () => void }) {
  const isNew = partner === 'new'
  const p = partner && partner !== 'new' ? partner : null
  const [form, setForm] = useState<PartnerForm>(() => blank())
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = partner === null ? null : isNew ? 'new' : p!.id
  // Abre a janela: carrega os dados do parceiro escolhido (ou em branco).
  if (key !== lastKey) {
    setLastKey(key)
    setForm(
      p
        ? {
            code: p.code,
            name: p.name,
            email: p.userEmail ?? '',
            pixKey: p.pixKey ?? '',
            commissionPercent: p.commissionPercent,
            trialDays: p.trialDays,
            active: p.active,
            notes: p.notes ?? '',
          }
        : blank(),
    )
  }
  const qc = useQueryClient()
  const toast = useToast()
  const save = useMutation({
    mutationFn: (body: PartnerForm) =>
      api(isNew ? '/admin/partners' : `/admin/partners/${p!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        json: { ...body, email: body.email.trim() || null, pixKey: body.pixKey.trim() || null, notes: body.notes.trim() || null },
      }),
    onSuccess: () => {
      toast(isNew ? 'Parceiro criado.' : 'Parceiro atualizado.', 'ok')
      qc.invalidateQueries({ queryKey: KEY })
      onClose()
    },
    onError: (e) => toast(e.message, 'error'),
  })
  const set = <K extends keyof PartnerForm>(k: K, v: PartnerForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(form)
  }

  return (
    <Sheet open={partner !== null} onClose={onClose} title={isNew ? 'Novo parceiro' : `Editar ${p?.name ?? ''}`}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nome</span>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">Cupom</span>
            <input
              className="input font-mono uppercase"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="LUIZ"
              required
              minLength={3}
            />
            <span className="mt-1 block text-xs text-muted">Link: /p/{form.code.toLowerCase().replace(/[^a-z0-9]/g, '') || 'cupom'}</span>
          </label>
        </div>
        <label className="block">
          <span className="label">E-mail da conta do parceiro no app</span>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="Para o acesso grátis e o painel dele"
          />
        </label>
        <label className="block">
          <span className="label">Chave Pix (para pagar a comissão)</span>
          <input className="input" value={form.pixKey} onChange={(e) => set('pixKey', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Comissão (% do 1º pagamento)</span>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={form.commissionPercent}
              onChange={(e) => set('commissionPercent', Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="label">Dias de teste do cupom</span>
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={form.trialDays}
              onChange={(e) => set('trialDays', Number(e.target.value))}
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Observações (contrato, redes sociais…)</span>
          <textarea className="input h-20 py-2" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          Parceria ativa (cupom aceito e acesso grátis do parceiro)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={save.isPending}>
            {isNew ? 'Criar parceiro' : 'Salvar'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

const blank = (): PartnerForm => ({
  code: '',
  name: '',
  email: '',
  pixKey: '',
  commissionPercent: 50,
  trialDays: 30,
  active: true,
  notes: '',
})
