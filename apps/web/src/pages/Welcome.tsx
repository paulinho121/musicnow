import { formatBRL, PLANS, TRIAL_DAYS } from '@ensaio/shared'
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronDown,
  ClipboardPaste,
  FileMusic,
  ListMusic,
  Megaphone,
  MousePointerClick,
  Printer,
  Radio,
  Smartphone,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'
import { PublicFooter, PublicHeader } from '../components/PublicChrome'

const FEATURES = [
  { icon: Radio, title: 'Modo Palco ao vivo', text: 'Quem lidera troca a música e o tom; a banda toda vê na hora, no celular de cada um.' },
  {
    icon: ArrowRightLeft,
    title: 'Qualquer tom, num toque',
    text: 'Transponha a cifra inteira sem reescrever. Cada músico pode ter o seu tom.',
  },
  {
    icon: ClipboardPaste,
    title: 'Cole a lista do WhatsApp',
    text: 'O app separa blocos, estilos, BPM e tons sozinho. Repertório pronto em 1 minuto.',
  },
  { icon: ListMusic, title: 'Repertório por blocos', text: 'Organize o show em blocos coloridos, com marcações e observações da banda.' },
  { icon: Printer, title: 'Folha de palco e PDF', text: 'Imprima a lista grande para o chão do palco, ou o caderno de cifras completo.' },
  { icon: FileMusic, title: 'Partituras e Guitar Pro', text: 'Anexe partituras e arquivos .gp à música e abra tudo no mesmo lugar.' },
  {
    icon: MousePointerClick,
    title: 'Acorde no lugar certo',
    text: 'Toque no acorde e depois na sílaba: ele vai pro lugar, sem contar espaços.',
  },
  { icon: Megaphone, title: 'Divulgue o show', text: 'Gere a imagem do repertório para Stories, WhatsApp, Facebook e X.' },
]

const AUDIENCES = [
  { title: 'Ministérios de louvor', text: 'O culto de domingo pronto, com o tom de cada voz e a banda inteira na mesma versão.' },
  { title: 'Bandas de bar e baile', text: 'Blocos, BPM e a sequência na mão. Pediram uma música? Troque ao vivo, todos acompanham.' },
  {
    title: 'Artistas e músicos freelancers',
    text: 'Seu repertório organizado para cada contratante, sem pastas de PDF perdidas no celular.',
  },
]

const STEPS = [
  { title: 'Cole a sua lista', text: 'Do WhatsApp, do papel ou do bloco de notas. O app entende blocos e tons.' },
  { title: 'Chame a banda', text: 'Mande um link. Os músicos entram de graça, sem precisar assinar.' },
  { title: 'Toque no Modo Palco', text: 'Você comanda a música e o tom; todo mundo acompanha na mesma hora.' },
]

export const FAQ = [
  {
    q: 'Preciso de cartão para testar?',
    a: `Não. São ${TRIAL_DAYS} dias grátis com tudo liberado, sem cartão. Depois, você escolhe se quer assinar.`,
  },
  {
    q: 'A banda toda precisa pagar?',
    a: 'Não. Paga só quem cria os repertórios. Os músicos convidados entram de graça e veem tudo, inclusive no Modo Palco.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim, no celular, tablet e computador. Dá para instalar como aplicativo direto pelo navegador, sem loja.',
  },
  { q: 'Como pago?', a: 'Pix, boleto ou cartão, com nota fiscal. A cobrança é feita pelo Asaas, com segurança.' },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, em dois cliques, na tela da assinatura. Sem multa e sem fidelidade. O acesso vale até o fim do período pago.',
  },
  {
    q: 'E se o teste acabar e eu não assinar?',
    a: 'Suas músicas e repertórios continuam salvos e você continua abrindo e tocando tudo. Só criar e editar ficam para quem assina.',
  },
]

export function Welcome() {
  const yearlyMonthly = PLANS.yearly.price / 12

  return (
    <div className="min-h-dvh bg-bg">
      <PublicHeader />

      {/* Destaque */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent),radial-gradient(40%_50%_at_0%_100%,color-mix(in_srgb,var(--accent)_8%,transparent),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Radio className="size-3.5" /> A banda toda no mesmo tom, ao vivo
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Ensaie menos tempo.
              <br />
              <span className="text-accent">Toque melhor.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Cifras em qualquer tom, repertórios por blocos e o Modo Palco que sincroniza a banda inteira. Para o louvor, o bar, o baile e
              o show.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/criar-conta" className="btn-primary h-13 px-7 text-base">
                Testar {TRIAL_DAYS} dias grátis <ArrowRight className="size-4" />
              </Link>
              <a href="#como-funciona" className="btn-ghost h-13 px-7 text-base">
                Ver como funciona
              </a>
            </div>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {['Sem cartão', 'Banda convidada não paga', 'Cancele quando quiser'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-ok" /> {t}
                </span>
              ))}
            </p>
          </div>

          <StageMockup />
        </div>
      </section>

      {/* Para quem */}
      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title}>
              <p className="font-bold">{a.title}</p>
              <p className="mt-1 text-sm text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <SectionTitle kicker="Como funciona" title="Do WhatsApp ao palco em 3 passos" />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-lg font-extrabold text-accent-ink">{i + 1}</span>
              <p className="mt-4 text-lg font-bold">{s.title}</p>
              <p className="mt-1 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Recursos */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <SectionTitle kicker="Recursos" title="Tudo o que a banda precisa, num lugar só" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5 transition hover:border-accent/40">
              <span className="grid size-10 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="scroll-mt-20 border-y border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionTitle kicker="Preços" title="Um preço justo. A banda entra de graça." />
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
            <PriceCard name="Mensal" price={formatBRL(PLANS.monthly.price)} period="/mês" note="Renova todo mês. Cancele quando quiser." />
            <PriceCard
              name="Anual"
              price={formatBRL(PLANS.yearly.price)}
              period="/ano"
              note={`Sai ${formatBRL(yearlyMonthly)}/mês: 2 meses grátis.`}
              highlight
            />
          </div>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-2 text-sm sm:grid-cols-2">
            {[
              'Músicas, repertórios e partituras ilimitados',
              'Modo Palco com toda a banda',
              'Músicos convidados não pagam',
              `${TRIAL_DAYS} dias grátis, sem cartão`,
              'Pix, boleto ou cartão, com nota fiscal',
              'Sem fidelidade',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-ok" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Perguntas */}
      <section className="mx-auto max-w-3xl px-5 py-20">
        <SectionTitle kicker="Dúvidas" title="Perguntas frequentes" />
        <div className="mt-10 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="-mt-1 px-5 pb-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Chamada final */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-accent/30 bg-surface p-10 text-center md:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,color-mix(in_srgb,var(--accent)_25%,transparent),transparent)]"
          />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">O próximo ensaio já pode ser diferente.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">Monte o repertório de hoje em 1 minuto e mande o link para a banda.</p>
            <Link to="/criar-conta" className="btn-primary mt-8 h-13 px-8 text-base">
              Começar grátis <ArrowRight className="size-4" />
            </Link>
            <p className="mt-3 text-xs text-muted">{TRIAL_DAYS} dias grátis · sem cartão · instale no celular</p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold tracking-widest text-accent uppercase">{kicker}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  )
}

function PriceCard({
  name,
  price,
  period,
  note,
  highlight = false,
}: {
  name: string
  price: string
  period: string
  note: string
  highlight?: boolean
}) {
  return (
    <div className={highlight ? 'relative rounded-2xl border-2 border-accent bg-surface p-6' : 'card p-6'}>
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-ink">Mais vantajoso</span>
      )}
      <p className="font-semibold text-muted">{name}</p>
      <p className="mt-2">
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        <span className="text-muted">{period}</span>
      </p>
      <p className="mt-2 text-sm text-muted">{note}</p>
      <Link to="/criar-conta" className={`${highlight ? 'btn-primary' : 'btn-ghost'} mt-6 w-full`}>
        Testar {TRIAL_DAYS} dias grátis
      </Link>
    </div>
  )
}

/** Ilustração do app: a cifra no Modo Palco e a banda conectada. */
function StageMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="card overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
            <Radio className="size-3.5 animate-pulse" /> AO VIVO
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Users className="size-3.5" /> 5 músicos conectados
          </span>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-wider text-[#f5a524] uppercase">Bloco 2 · Música 3 de 4</p>
              <p className="text-xl font-extrabold">Luz da Manhã</p>
              <p className="text-sm text-muted">Tom original D → tocando em E</p>
            </div>
            <span className="rounded-xl bg-accent/15 px-3 py-1.5 font-mono text-lg font-bold text-chord">E</span>
          </div>
          <div className="sheet text-[15px] leading-relaxed">
            <span className="mb-1 inline-block rounded-md border-l-4 border-sec-refrao bg-surface-2 px-2 py-0.5 font-sans text-xs font-bold text-sec-refrao uppercase">
              Refrão
            </span>
            <div className="font-bold text-chord">{'E            B'}</div>
            <div>{'Luz da manhã, acende em mim'}</div>
            <div className="font-bold text-chord">{'C#m          A'}</div>
            <div>{'Canção que não tem fim'}</div>
            <div className="font-bold text-chord">{'E       B      E'}</div>
            <div>{'Vem me guiar, me faz cantar'}</div>
          </div>
        </div>
      </div>
      {/* Celular de um músico acompanhando */}
      <div className="absolute -right-5 -bottom-12 hidden w-40 rotate-[5deg] rounded-[1.6rem] border-4 border-[#2a2e38] bg-[#0e0f13] p-3 shadow-2xl sm:block">
        <p className="flex items-center gap-1 text-[10px] text-muted">
          <Smartphone className="size-3" /> Baixista
        </p>
        <p className="mt-1 text-sm font-bold text-white">Luz da Manhã</p>
        <p className="font-mono text-xs font-bold text-[#f5b84a]">E · B · C#m · A</p>
        <p className="mt-2 rounded-md bg-[#f5a524]/15 px-2 py-1 text-[10px] font-semibold text-[#f5a524]">Seguindo o líder</p>
      </div>
    </div>
  )
}
