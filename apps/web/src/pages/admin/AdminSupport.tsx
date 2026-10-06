import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bug, Check, Inbox, Lightbulb, MessageCircleQuestion, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, PageSpinner, useToast } from '../../components/ui'
import { api } from '../../lib/api'

interface AdminTicket {
  id: string
  kind: 'problem' | 'question' | 'idea'
  message: string
  page: string | null
  userAgent: string | null
  release: string | null
  status: 'open' | 'resolved'
  reply: string | null
  createdAt: string
  resolvedAt: string | null
  userName: string
  userEmail: string
}

const KIND = {
  problem: { label: 'Problema', icon: Bug, tone: 'text-danger' },
  question: { label: 'Dúvida', icon: MessageCircleQuestion, tone: 'text-accent' },
  idea: { label: 'Sugestão', icon: Lightbulb, tone: 'text-ok' },
}
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Aparelho resumido: "Chrome · Android". */
function device(ua: string | null) {
  if (!ua) return null
  const b = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  const o = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'Mac'
          : null
  return [b, o].filter(Boolean).join(' · ') || null
}

/** Pedidos de ajuda: responder (a pessoa recebe por e-mail e vê na Ajuda) e resolver. */
export function AdminSupport() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'support', status],
    queryFn: () => api<{ tickets: AdminTicket[] }>(`/admin/support?status=${status}`),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Suporte</h2>
          <p className="text-xs text-muted">
            Problemas, dúvidas e sugestões enviados pela aba Ajuda. Você também recebe cada um por e-mail.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border p-1" role="radiogroup" aria-label="Situação">
          {(
            [
              ['open', 'Abertos'],
              ['resolved', 'Resolvidos'],
              ['all', 'Todos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={status === id}
              onClick={() => setStatus(id)}
              className={clsx(
                'h-8 rounded-lg px-3 text-xs font-semibold',
                status === id ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.tickets.length === 0 ? (
        <EmptyState icon={Inbox} title={status === 'open' ? 'Nenhum pedido aberto' : 'Nenhum pedido'}>
          Quando alguém pedir ajuda pela aba Ajuda, aparece aqui.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.tickets.map((t) => (
            <TicketRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TicketRow({ t }: { t: AdminTicket }) {
  const [reply, setReply] = useState(t.reply ?? '')
  const qc = useQueryClient()
  const toast = useToast()
  const save = useMutation({
    mutationFn: (body: { status?: 'open' | 'resolved'; reply?: string | null }) =>
      api(`/admin/support/${t.id}`, { method: 'PATCH', json: body }),
    onSuccess: (_, body) => {
      toast(body.reply ? 'Resposta enviada.' : body.status === 'resolved' ? 'Resolvido.' : 'Reaberto.', 'ok')
      qc.invalidateQueries({ queryKey: ['admin', 'support'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })
  const k = KIND[t.kind]

  return (
    <li className={clsx('card space-y-3 p-4', t.status === 'resolved' && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className={clsx('flex items-center gap-1 font-semibold', k.tone)}>
          <k.icon className="size-3.5" /> {k.label}
        </span>
        <span className="font-semibold text-text">{t.userName}</span>
        <a href={`mailto:${t.userEmail}`} className="hover:text-text">
          {t.userEmail}
        </a>
        <span>{dateFmt.format(new Date(t.createdAt))}</span>
        {t.page && <span className="font-mono">{t.page}</span>}
        {device(t.userAgent) && <span>{device(t.userAgent)}</span>}
        {t.release && <span>versão {t.release}</span>}
      </div>
      <p className="text-sm whitespace-pre-wrap">{t.message}</p>
      <textarea
        className="input h-20 resize-y py-2 text-sm"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Responder (a pessoa recebe por e-mail e vê na aba Ajuda)…"
        aria-label="Resposta"
      />
      <div className="flex flex-wrap justify-end gap-2">
        {t.status === 'resolved' ? (
          <button className="btn-ghost h-9 text-xs" onClick={() => save.mutate({ status: 'open' })} disabled={save.isPending}>
            <RotateCcw className="size-3.5" /> Reabrir
          </button>
        ) : (
          <button className="btn-ghost h-9 text-xs" onClick={() => save.mutate({ status: 'resolved' })} disabled={save.isPending}>
            <Check className="size-3.5" /> Resolver sem responder
          </button>
        )}
        <button
          className="btn-primary h-9 text-xs"
          onClick={() => save.mutate({ reply: reply.trim(), status: 'resolved' })}
          disabled={save.isPending || !reply.trim() || reply.trim() === t.reply}
        >
          <Send className="size-3.5" /> Responder e resolver
        </button>
      </div>
    </li>
  )
}
