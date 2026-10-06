import { formatBRL, PLANS } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, Barcode, Check, CircleCheck, Copy, CreditCard, ExternalLink, Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorState, PageSpinner } from '../components/ui'
import { useCheckoutPayment } from '../lib/billing'
import { keys } from '../lib/queries'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
type Method = 'pix' | 'boleto' | 'card'

/**
 * Página de pagamento do próprio Ensaio Fácil: Pix (QR code e copia e cola) e boleto aqui
 * mesmo; cartão na página segura do Asaas. Confere sozinha quando o pagamento cai.
 */
export function Checkout() {
  const { id = '' } = useParams()
  const { data: p, isLoading, error, refetch } = useCheckoutPayment(id)
  const [method, setMethod] = useState<Method>('pix')
  const [copied, setCopied] = useState<string | null>(null)
  const qc = useQueryClient()

  // Pagou: atualiza a situação da assinatura no app (libera criar e editar na hora).
  useEffect(() => {
    if (p?.paid) {
      qc.invalidateQueries({ queryKey: keys.me })
      qc.invalidateQueries({ queryKey: ['billing', 'payments'] })
    }
  }, [p?.paid, qc])

  if (isLoading) return <PageSpinner />
  if (error || !p) return <ErrorState error={error} onRetry={() => refetch()} />

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }
  const planLabel = p.plan ? `Plano ${PLANS[p.plan].label.toLowerCase()}` : 'Assinatura'

  if (p.paid) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-ok/15 text-ok">
          <CircleCheck className="size-9" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Pagamento confirmado!</h1>
        <p className="mt-2 text-muted">
          Obrigado por assinar o Ensaio Fácil. {planLabel} de {formatBRL(p.value)} ativo: crie e edite à vontade.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/inicio" className="btn-primary">
            Ir para o início
          </Link>
          <Link to="/assinatura" className="btn-ghost">
            Ver minha assinatura
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/assinatura" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">Pagamento</h1>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-muted">Ensaio Fácil · {planLabel}</p>
          <p className="text-3xl font-extrabold tracking-tight">{formatBRL(p.value)}</p>
        </div>
        <p className="text-right text-sm text-muted">
          Vence em
          <br />
          <b className="text-text">{dateFmt.format(new Date(p.dueDate))}</b>
        </p>
      </section>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Forma de pagamento">
        {(
          [
            ['pix', 'Pix', QrCode],
            ['boleto', 'Boleto', Barcode],
            ['card', 'Cartão', CreditCard],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={method === m}
            onClick={() => setMethod(m)}
            className={clsx(
              'flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-semibold transition',
              method === m ? 'border-accent bg-accent/10 text-text' : 'border-border bg-surface text-muted hover:text-text',
            )}
          >
            <Icon className="size-5" /> {label}
          </button>
        ))}
      </div>

      <section className="card p-5 sm:p-6">
        {method === 'pix' &&
          (p.pix ? (
            <div className="grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
              <img src={p.pix.image} alt="QR code do Pix" className="mx-auto size-52 rounded-xl bg-white p-2" />
              <div className="space-y-3">
                <p className="font-semibold">Pague com o app do seu banco</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                  <li>Abra o app do banco e escolha Pix.</li>
                  <li>Leia o QR code ou use o “copia e cola”.</li>
                  <li>Confirme: a assinatura é liberada aqui em segundos.</li>
                </ol>
                <button className="btn-primary w-full" onClick={() => copy(p.pix!.payload, 'pix')}>
                  {copied === 'pix' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === 'pix' ? 'Código copiado!' : 'Copiar código Pix'}
                </button>
              </div>
            </div>
          ) : (
            <Unavailable invoiceUrl={p.invoiceUrl} what="o Pix" />
          ))}

        {method === 'boleto' &&
          (p.boleto ? (
            <div className="space-y-3">
              <p className="font-semibold">Linha digitável do boleto</p>
              <code className="block rounded-xl border border-border bg-bg p-3 font-mono text-sm break-all">{p.boleto.line}</code>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="btn-primary flex-1" onClick={() => copy(p.boleto!.line.replace(/\D/g, ''), 'boleto')}>
                  {copied === 'boleto' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === 'boleto' ? 'Copiado!' : 'Copiar código'}
                </button>
                {p.boleto.pdfUrl && (
                  <a href={p.boleto.pdfUrl} target="_blank" rel="noreferrer" className="btn-ghost flex-1">
                    <ExternalLink className="size-4" /> Abrir o boleto (PDF)
                  </a>
                )}
              </div>
              <p className="text-xs text-muted">O boleto leva até 3 dias úteis para compensar. Com Pix é na hora.</p>
            </div>
          ) : (
            <Unavailable invoiceUrl={p.invoiceUrl} what="o boleto" />
          ))}

        {method === 'card' && (
          <div className="space-y-3">
            <p className="font-semibold">Cartão de crédito</p>
            <p className="text-sm text-muted">
              Os dados do cartão são digitados direto no Asaas, nosso parceiro de pagamentos: o Ensaio Fácil nunca vê nem guarda o número do
              seu cartão. A renovação passa a ser automática no cartão.
            </p>
            <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="btn-primary w-full">
              <CreditCard className="size-4" /> Pagar com cartão
            </a>
          </div>
        )}
      </section>

      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin" /> Esperando a confirmação do pagamento… esta página atualiza sozinha.
      </p>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-3.5" /> Pagamento processado pelo Asaas, instituição de pagamento autorizada pelo Banco Central.
      </p>
    </div>
  )
}

function Unavailable({ invoiceUrl, what }: { invoiceUrl: string; what: string }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted">Não conseguimos gerar {what} agora.</p>
      <a href={invoiceUrl} target="_blank" rel="noreferrer" className="btn-ghost">
        <ExternalLink className="size-4" /> Pagar pela página do Asaas
      </a>
    </div>
  )
}
