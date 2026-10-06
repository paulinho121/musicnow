import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { ErrorState, PageSpinner } from '../../components/ui'
import { api } from '../../lib/api'

interface Funnel {
  days: number
  signups: number
  profile: number
  opened: number
  setlist: number
  band: number
  paid: number
  viaPartner: number
}

const STEPS: { key: keyof Funnel; label: string; hint: string }[] = [
  { key: 'signups', label: 'Criaram a conta', hint: 'Cadastros no período (sem administradores).' },
  { key: 'profile', label: 'Completaram o perfil', hint: 'Escolheram função e instrumentos.' },
  { key: 'opened', label: 'Abriram uma música', hint: 'Viram pelo menos uma cifra.' },
  { key: 'setlist', label: 'Montaram um repertório', hint: 'Criaram um repertório com músicas.' },
  { key: 'band', label: 'Chamaram a banda', hint: 'Alguém entrou no repertório ou criaram um convite.' },
  { key: 'paid', label: 'Assinaram', hint: 'Fizeram pelo menos um pagamento.' },
]

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

/** Funil: onde as pessoas param entre o cadastro e a assinatura. */
export function AdminFunnel() {
  const [days, setDays] = useState(30)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'funnel', days],
    queryFn: () => api<Funnel>(`/admin/funnel?days=${days}`),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Funil de conversão</h2>
          <p className="text-xs text-muted">Das pessoas que se cadastraram no período, quantas chegaram a cada passo.</p>
        </div>
        <div className="inline-flex rounded-xl border border-border p-1" role="radiogroup" aria-label="Período">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={clsx(
                'h-8 rounded-lg px-3 text-xs font-semibold',
                days === d ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text',
              )}
            >
              {d === 365 ? '1 ano' : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <ol className="space-y-2">
            {STEPS.map((s, i) => {
              const n = data[s.key]
              const prev = i ? data[STEPS[i - 1].key] : n
              const ofTotal = pct(n, data.signups)
              const drop = i ? pct(prev - n, prev) : 0
              return (
                <li key={s.key} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {s.label}
                    </p>
                    <p className="text-sm">
                      <b className="text-lg">{n}</b> <span className="text-muted">· {ofTotal}% dos cadastros</span>
                      {i > 0 && prev > 0 && (
                        <span className={clsx('ml-2 text-xs font-semibold', drop >= 50 ? 'text-danger' : 'text-muted')}>
                          −{drop}% em relação ao passo anterior
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(ofTotal, n ? 2 : 0)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{s.hint}</p>
                </li>
              )
            })}
          </ol>
          <p className="text-sm text-muted">
            {data.viaPartner} {data.viaPartner === 1 ? 'cadastro veio' : 'cadastros vieram'} de cupom de parceiro (
            {pct(data.viaPartner, data.signups)}%). O passo com a maior queda (em vermelho) é onde vale a pena melhorar primeiro.
          </p>
        </>
      )}
    </div>
  )
}
