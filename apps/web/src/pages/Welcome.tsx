import { ArrowRightLeft, ListMusic, MonitorSmartphone, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'

const FEATURES = [
  { icon: ArrowRightLeft, title: 'Transposição instantânea', text: 'Troque o tom com um toque, sem reescrever a cifra.' },
  { icon: MonitorSmartphone, title: 'Feito para o palco', text: 'Letra grande, modo escuro, rolagem automática e tela bloqueada.' },
  { icon: ListMusic, title: 'Repertórios organizados', text: 'Monte a ordem do culto, do show ou do ensaio com o tom de cada música.' },
  { icon: Users, title: 'Toda a banda na mesma versão', text: 'Compartilhe com os músicos e todos veem as mesmas marcações.' },
]

export function Welcome() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8">
      <Logo />
      <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-2">
        <div>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">
            Cifras, tons e repertório. <span className="text-accent">Tudo pronto para tocar.</span>
          </h1>
          <p className="mt-4 text-lg text-muted">
            Para músicos de igreja, bandas de bar e artistas independentes que querem ensaiar melhor e errar menos ao vivo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/criar-conta" className="btn-primary h-12 px-6 text-base">
              Criar conta grátis
            </Link>
            <Link to="/entrar" className="btn-ghost h-12 px-6 text-base">
              Já tenho conta
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden p-5" aria-hidden>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-bold">Luz da Manhã</p>
              <p className="text-sm text-muted">Tom: D → E</p>
            </div>
            <span className="rounded-lg bg-accent/15 px-2.5 py-1 font-mono font-bold text-chord">E</span>
          </div>
          <div className="sheet text-[15px] leading-relaxed">
            <div className="mb-1">
              <span className="rounded-md border-l-4 border-sec-refrao bg-surface-2 px-2 py-0.5 font-sans text-xs font-bold text-sec-refrao uppercase">
                Refrão
              </span>
            </div>
            <div className="font-bold text-chord">{'E            B'}</div>
            <div>{'Luz da manhã, acende em mim'}</div>
            <div className="font-bold text-chord">{'C#m          A'}</div>
            <div>{'Canção que não tem fim'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-4">
            <Icon className="mb-2 size-5 text-accent" />
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
