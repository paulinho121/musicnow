import { formatBRL, PLANS, TRIAL_DAYS } from '@ensaio/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bug, CircleCheck, Lightbulb, LifeBuoy, Loader2, MessageCircleQuestion, Search, Send } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useToast } from '../components/ui'
import { api } from '../lib/api'

type Kind = 'problem' | 'question' | 'idea'
interface Ticket {
  id: string
  kind: Kind
  message: string
  status: 'open' | 'resolved'
  reply: string | null
  createdAt: string
  resolvedAt: string | null
}

const KINDS: { id: Kind; label: string; icon: typeof Bug; placeholder: string }[] = [
  {
    id: 'problem',
    label: 'Problema',
    icon: Bug,
    placeholder: 'O que aconteceu? O que você estava fazendo e o que esperava que acontecesse?',
  },
  { id: 'question', label: 'Dúvida', icon: MessageCircleQuestion, placeholder: 'Qual é a sua dúvida?' },
  { id: 'idea', label: 'Sugestão', icon: Lightbulb, placeholder: 'O que deixaria o Ensaio Fácil melhor para você e a sua banda?' },
]

const FAQ: { topic: string; items: { q: string; a: string }[] }[] = [
  {
    topic: 'Começando',
    items: [
      {
        q: 'Como monto meu primeiro repertório?',
        a: 'Em Repertórios, toque em "Novo repertório". O jeito mais rápido é colar a lista que você já manda no WhatsApp: o app separa os blocos, os tons e as músicas sozinho.',
      },
      {
        q: 'Como coloco músicas no app?',
        a: 'Em Músicas: "Nova música" para colar ou escrever a cifra (acordes em cima da letra), "Importar" para trazer arquivos (ChordPro, OnSong, OpenSong ou texto) e "Encontrar" para buscar no catálogo.',
      },
      {
        q: 'Como instalo o app no celular?',
        a: 'Android (Chrome): menu ⋮ → "Instalar app" ou "Adicionar à tela inicial". iPhone (Safari): botão Compartilhar → "Adicionar à Tela de Início". Ele abre como um aplicativo, em tela cheia.',
      },
    ],
  },
  {
    topic: 'Banda e Modo Palco',
    items: [
      {
        q: 'Como chamo a minha banda?',
        a: 'Abra o repertório → aba Banda → "Convidar músicos" e mande o link no grupo. Os músicos convidados entram de graça e veem a mesma versão, com os tons e as marcações.',
      },
      {
        q: 'Como funciona o Modo Palco?',
        a: 'No repertório, toque em "Comandar Banda ao Vivo". Quando você troca de música ou de tom, todos que estão seguindo veem na hora. Precisa de internet (ou do Wi-Fi do local) em todos os celulares.',
      },
      {
        q: 'Cada músico pode tocar num tom diferente?',
        a: 'Sim. Na música, mude o tom com − e + e toque em "Salvar como meu tom": vale só para você (ex.: quem usa capotraste).',
      },
    ],
  },
  {
    topic: 'Cifras e tons',
    items: [
      {
        q: 'Como mudo o tom da música?',
        a: 'Na música, use os botões − e + embaixo, ou toque no tom para escolher. A cifra inteira muda na hora.',
      },
      {
        q: 'Um acorde está no lugar errado da letra. Como corrijo?',
        a: 'Na música, toque em "Ajustar posição dos acordes": toque no acorde e depois na sílaba onde ele entra. Não precisa contar espaços.',
      },
      {
        q: 'Não sei montar um acorde. E agora?',
        a: 'Toque no acorde dentro da cifra: abre o dicionário com o desenho no violão e no teclado, já no tom em que você está.',
      },
    ],
  },
  {
    topic: 'No palco',
    items: [
      {
        q: 'Vai faltar internet no local do show. Funciona?',
        a: 'Funciona: no repertório, toque em "Baixar para o show" antes de sair de casa. Cifras, tons e partituras ficam no aparelho e abrem sem internet. (Só o Modo Palco ao vivo precisa de conexão.)',
      },
      {
        q: 'Como uso um pedal Bluetooth?',
        a: 'Pareie o pedal nas configurações de Bluetooth do celular. Na música, toque em "Aa" (ajustes) → Pedal: escolha se ele rola a cifra ou troca de música, e aperte o pedal para testar. Espaço liga e pausa a rolagem automática.',
      },
      {
        q: 'A tela do celular apaga no meio da música.',
        a: 'Com a música aberta, o app pede para a tela ficar acesa. Alguns celulares no modo economia de bateria ignoram o pedido: desligue a economia durante o show.',
      },
    ],
  },
  {
    topic: 'Assinatura e pagamento',
    items: [
      {
        q: 'Quanto custa?',
        a: `${formatBRL(PLANS.monthly.price)} por mês ou ${formatBRL(PLANS.yearly.price)} por ano, com ${TRIAL_DAYS} dias grátis sem cartão. Só paga quem cria os repertórios: os músicos convidados nunca pagam.`,
      },
      {
        q: 'Como assino, troco de plano ou cancelo?',
        a: 'Em Perfil → Assinatura. O cancelamento é em dois cliques, sem multa: o acesso vale até o fim do período pago.',
      },
      {
        q: 'Paguei e ainda aparece como não assinado.',
        a: 'Pix confirma em segundos; boleto leva até 3 dias úteis. Se passou disso, mande um pedido abaixo como "Problema" que a gente confere.',
      },
    ],
  },
  {
    topic: 'Conta e privacidade',
    items: [
      {
        q: 'Esqueci a minha senha.',
        a: 'Na tela de entrar, toque em "Esqueci minha senha": chega um link no seu e-mail (veja também o spam).',
      },
      {
        q: 'Como excluo a minha conta?',
        a: 'Em Perfil → "Excluir minha conta". Seus dados são apagados na hora, como diz a Política de Privacidade.',
      },
    ],
  },
]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Aba Ajuda: perguntas frequentes, "Fale com a gente" e os pedidos da pessoa. */
export function Help() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Kind>(params.get('tipo') === 'erro' ? 'problem' : 'question')
  const [message, setMessage] = useState('')
  // Tela de onde a pessoa veio (a tela de erro manda ?de=/caminho).
  const from = params.get('de')
  const toast = useToast()
  const qc = useQueryClient()
  const tickets = useQuery({ queryKey: ['support', 'mine'], queryFn: () => api<{ tickets: Ticket[] }>('/support/mine') })
  const send = useMutation({
    mutationFn: () =>
      api('/support', {
        method: 'POST',
        json: { kind, message, page: from ?? document.referrer.replace(location.origin, '') ?? null, release: __RELEASE__ },
      }),
    onSuccess: () => {
      setMessage('')
      toast('Recebemos! Vamos responder por e-mail e aqui mesmo.', 'ok')
      qc.invalidateQueries({ queryKey: ['support', 'mine'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const results = useMemo(() => {
    const t = norm(q.trim())
    if (!t) return FAQ
    return FAQ.map((g) => ({ ...g, items: g.items.filter((i) => norm(`${i.q} ${i.a}`).includes(t)) })).filter((g) => g.items.length)
  }, [q])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (message.trim().length < 10) return toast('Conte um pouco mais (pelo menos 10 letras).', 'error')
    send.mutate()
  }
  const current = KINDS.find((k) => k.id === kind)!

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent">
          <LifeBuoy className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Ajuda</h1>
          <p className="text-sm text-muted">Respostas rápidas, ou fale com a gente.</p>
        </div>
      </div>

      {/* Perguntas frequentes */}
      <section className="space-y-4" aria-labelledby="perguntas">
        <h2 id="perguntas" className="sr-only">
          Perguntas frequentes
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar: tom, pedal, internet, pagamento…"
            aria-label="Buscar nas perguntas"
          />
        </div>
        {results.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted">
            Não achamos nada sobre “{q}”. Pergunte abaixo que a gente responde.
          </p>
        ) : (
          results.map((g) => (
            <div key={g.topic}>
              <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{g.topic}</p>
              <div className="space-y-2">
                {g.items.map((i) => (
                  <details key={i.q} className="card group p-0" open={Boolean(q.trim())}>
                    <summary className="cursor-pointer list-none p-4 font-semibold [&::-webkit-details-marker]:hidden">{i.q}</summary>
                    <p className="-mt-1 px-4 pb-4 text-sm leading-relaxed text-muted">{i.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Fale com a gente */}
      <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="fale">
        <div>
          <h2 id="fale" className="text-lg font-bold">
            Fale com a gente
          </h2>
          <p className="text-sm text-muted">
            Achou um erro, ficou com dúvida ou tem uma ideia? A resposta chega no seu e-mail e aparece aqui.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo do pedido">
            {KINDS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                onClick={() => setKind(id)}
                className={clsx(
                  'flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
                  kind === id ? 'border-accent bg-accent/10' : 'border-border text-muted hover:text-text',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <textarea
            className="input h-36 resize-y py-3"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={current.placeholder}
            maxLength={4000}
            aria-label="Mensagem"
          />
          {kind === 'problem' && (
            <p className="text-xs text-muted">
              Junto vão a tela onde você estava{from ? ` (${from})` : ''}, o aparelho e a versão do app, para a gente achar o problema mais
              rápido.
            </p>
          )}
          <button className="btn-primary w-full sm:w-auto" disabled={send.isPending}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar
          </button>
        </form>
      </section>

      {/* Pedidos da pessoa */}
      {tickets.data && tickets.data.tickets.length > 0 && (
        <section aria-labelledby="pedidos">
          <h2 id="pedidos" className="mb-3 text-lg font-bold">
            Seus pedidos
          </h2>
          <ul className="space-y-2">
            {tickets.data.tickets.map((t) => {
              const k = KINDS.find((x) => x.id === t.kind)!
              return (
                <li key={t.id} className="card p-4">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <k.icon className="size-3.5" /> {k.label} · {dateFmt.format(new Date(t.createdAt))}
                    <span
                      className={clsx(
                        'ml-auto rounded-full px-2 py-0.5 font-semibold',
                        t.status === 'resolved' ? 'bg-ok/15 text-ok' : 'bg-accent/15 text-accent',
                      )}
                    >
                      {t.status === 'resolved' ? 'Resolvido' : 'Recebido'}
                    </span>
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{t.message}</p>
                  {t.reply && (
                    <p className="mt-3 flex gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm whitespace-pre-wrap">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
                      <span>
                        <b>Resposta do suporte:</b> {t.reply}
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
