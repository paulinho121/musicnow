import { parseBRL } from '@ensaio/shared'
import clsx from 'clsx'
import { Check, Plus, Trash2, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { type FormEvent, useState } from 'react'
import { type Entry, type EntryKind, KIND_LABEL, totalsOf, useAddEntries, useDeleteEntry, useFinance, useMonthFinance, useSettle } from '../../lib/finance'
import { brl } from '../../lib/gigs'
import type { SetlistDetail } from '../../lib/types'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../ui'

const SETTLED_LABEL: Record<EntryKind, [string, string]> = {
  receita: ['Recebido', 'A receber'],
  despesa: ['Pago', 'A pagar'],
  cache: ['Pago', 'A pagar'],
}

export function FinancePanel({ setlist }: { setlist: SetlistDetail }) {
  const { data, isLoading, error, refetch } = useFinance(setlist.id)
  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />
  if (!data.canEdit) return <MyFee entries={data.entries} />

  const t = totalsOf(data.entries)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Entrou" value={brl(t.receita)} sub={t.aReceber ? `falta receber ${brl(t.aReceber)}` : undefined} />
        <Stat label="Despesas" value={brl(t.despesa)} />
        <Stat label="Cachês" value={brl(t.cache)} sub={t.aPagar ? `falta pagar ${brl(t.aPagar)}` : undefined} />
        <Stat label="Lucro" value={brl(t.lucro)} tone={t.lucro < 0 ? 'danger' : t.lucro > 0 ? 'ok' : undefined} />
      </div>

      <NewEntry setlist={setlist} />

      {data.entries.length === 0 ? (
        <EmptyState icon={Wallet} title="Nada lançado ainda">
          Lance o valor que a banda recebe pelo show, as despesas (som, transporte, alimentação) e o cachê de cada músico: o app calcula o
          lucro e mostra quem falta pagar.
        </EmptyState>
      ) : (
        (['receita', 'despesa', 'cache'] as EntryKind[]).map((k) => {
          const list = data.entries.filter((e) => e.kind === k)
          if (!list.length) return null
          return (
            <section key={k}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{KIND_LABEL[k]}</h3>
              <ul className="card divide-y divide-border">
                {list.map((e) => (
                  <EntryRow key={e.id} e={e} canEdit />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'danger' }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('text-lg font-bold tabular-nums', tone === 'ok' && 'text-ok', tone === 'danger' && 'text-danger')}>{value}</p>
      {sub && <p className="text-xs text-accent">{sub}</p>}
    </div>
  )
}

function EntryRow({ e, canEdit, labels }: { e: Entry; canEdit: boolean; labels?: [string, string] }) {
  const settle = useSettle()
  const del = useDeleteEntry()
  const toast = useToast()
  const [done, open] = labels ?? SETTLED_LABEL[e.kind]
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{e.kind === 'cache' && e.userName ? e.userName : e.description}</p>
        {e.kind === 'cache' && e.userName && <p className="text-xs text-muted">{e.description}</p>}
      </div>
      <span className="font-semibold tabular-nums">{brl(e.amountCents)}</span>
      <button
        className={clsx(
          'flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold',
          e.settledAt ? 'border-ok/40 text-ok' : 'border-accent/40 text-accent',
        )}
        disabled={settle.isPending}
        onClick={() => settle.mutate({ id: e.id, settled: !e.settledAt }, { onError: (err) => toast(err.message, 'error') })}
        aria-label={e.settledAt ? `${done}: desfazer` : `Marcar como ${done.toLowerCase()}`}
      >
        {e.settledAt && <Check className="size-3.5" />}
        {e.settledAt ? done : open}
      </button>
      {canEdit && (
        <button
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
          aria-label={`Apagar ${e.description}`}
          onClick={() => confirm(`Apagar "${e.description}"?`) && del.mutate(e.id)}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  )
}

/** Músico (sem administrar): só o próprio cachê, e confirma quando recebeu. */
function MyFee({ entries }: { entries: Entry[] }) {
  if (!entries.length)
    return (
      <EmptyState icon={Wallet} title="Sem cachê lançado">
        Quando o líder lançar o seu cachê deste show, ele aparece aqui. Só você e quem administra veem.
      </EmptyState>
    )
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-muted">Seu cachê neste show</h3>
      <ul className="card divide-y divide-border">
        {entries.map((e) => (
          <EntryRow key={e.id} e={{ ...e, userName: null }} canEdit={false} labels={['Recebido', 'A receber']} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Toque em "A receber" quando o dinheiro cair, para o líder saber que está tudo certo.</p>
    </section>
  )
}

function NewEntry({ setlist }: { setlist: SetlistDetail }) {
  const add = useAddEntries(setlist.id)
  const toast = useToast()
  const [kind, setKind] = useState<EntryKind>('receita')
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')
  const [settled, setSettled] = useState(false)
  const [people, setPeople] = useState<string[]>([])

  const cents = parseBRL(value)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (cents == null) return
    const entries =
      kind === 'cache'
        ? people.map((userId) => ({ kind, description: description.trim() || 'Cachê', amountCents: cents, userId, settled }))
        : [{ kind, description: description.trim(), amountCents: cents, settled }]
    add.mutate(
      entries,
      {
        onSuccess: () => {
          setDescription('')
          setValue('')
          setPeople([])
          setSettled(false)
          toast(kind === 'cache' && entries.length > 1 ? `${entries.length} cachês lançados.` : 'Lançado.')
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  const placeholders: Record<EntryKind, string> = {
    receita: 'Cachê do contratante, sinal...',
    despesa: 'Som, transporte, alimentação...',
    cache: 'Cachê (opcional)',
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de lançamento">
        {(['receita', 'despesa', 'cache'] as EntryKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={clsx('chip', kind === k && 'chip-on')}
            onClick={() => setKind(k)}
          >
            {k === 'receita' ? 'Entrada' : k === 'despesa' ? 'Despesa' : 'Cachê de músico'}
          </button>
        ))}
      </div>

      {kind === 'cache' && (
        <div>
          <p className="label">Para quem (o mesmo valor para cada um)</p>
          <div className="flex flex-wrap gap-2">
            {setlist.members.map((m) => {
              const on = people.includes(m.userId)
              return (
                <button
                  key={m.userId}
                  type="button"
                  className={clsx('chip', on && 'chip-on')}
                  aria-pressed={on}
                  onClick={() => setPeople(on ? people.filter((x) => x !== m.userId) : [...people, m.userId])}
                >
                  {m.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={placeholders[kind]}
          maxLength={120}
          required={kind !== 'cache'}
          aria-label="Descrição"
        />
        <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="R$ 0,00" required aria-label="Valor" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settled} onChange={(e) => setSettled(e.target.checked)} />
          {kind === 'receita' ? 'Já recebido' : 'Já pago'}
        </label>
        <button className="btn-primary" disabled={add.isPending || cents == null || (kind === 'cache' && !people.length)}>
          <Plus className="size-4" /> Lançar
          {kind === 'cache' && people.length > 1 && cents ? ` ${people.length} × ${brl(cents)}` : ''}
        </button>
      </div>
    </form>
  )
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** Agenda (de quem lidera): o financeiro dos shows da banda no mês. Some se não houver nada. */
export function MonthFinance({ month }: { month: Date }) {
  const mes = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const { data } = useMonthFinance(mes)
  if (!data?.length) return null
  const sum = (k: 'receita' | 'despesa' | 'cache' | 'aReceber' | 'aPagar') => data.reduce((n, r) => n + r[k], 0)
  const lucro = sum('receita') - sum('despesa') - sum('cache')
  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Wallet className="size-5 text-accent" /> Financeiro da banda no mês
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Entrou" value={brl(sum('receita'))} sub={sum('aReceber') ? `falta receber ${brl(sum('aReceber'))}` : undefined} />
        <Stat label="Despesas" value={brl(sum('despesa'))} />
        <Stat label="Cachês" value={brl(sum('cache'))} sub={sum('aPagar') ? `falta pagar ${brl(sum('aPagar'))}` : undefined} />
        <Stat label="Lucro" value={brl(lucro)} tone={lucro < 0 ? 'danger' : lucro > 0 ? 'ok' : undefined} />
      </div>
      <ul className="mt-3 divide-y divide-border text-sm">
        {data.map((r) => (
          <li key={r.id}>
            <Link to={`/repertorios/${r.id}?aba=financeiro`} className="flex items-center gap-3 py-2 hover:text-accent">
              <span className="w-14 shrink-0 text-xs text-muted">{dayFmt.format(new Date(r.eventDate))}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className={clsx('font-semibold tabular-nums', r.receita - r.despesa - r.cache < 0 ? 'text-danger' : 'text-ok')}>
                {brl(r.receita - r.despesa - r.cache)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
