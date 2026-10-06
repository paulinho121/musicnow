import {
  guessKey,
  isChordLine,
  MAJOR_KEYS,
  MINOR_KEYS,
  normalizeOffset,
  semitonesBetween,
  transposeKey,
  transposeSheet,
} from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowRightLeft, Check, Copy, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PublicPage, TryCta } from '../components/PublicChrome'

const EXAMPLE = `[Intro] G  D  Em  C

[Primeira Parte]
G              D
  Luz da manhã, acende em mim
Em             C
  Canção que não tem fim

[Refrão]
C        G         D
  Vem me guiar, me faz cantar
C        D         G
  Toda manhã eu vou te esperar`

/** "+1 tom", "−½ tom", "+1½ tom". */
function shiftLabel(shift: number) {
  if (shift === 0) return 'Tom original'
  const n = Math.abs(shift)
  const whole = Math.floor(n / 2)
  const amount = `${whole || ''}${n % 2 ? '½' : ''}`
  return `${shift > 0 ? '+' : '−'}${amount} ${n > 2 ? 'tons' : 'tom'}`
}

/** Formas abertas fáceis no violão: para tocar em outro tom com capotraste. */
const OPEN_SHAPES = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm']

function capoOptions(target: string) {
  const minor = target.endsWith('m')
  return OPEN_SHAPES.filter((s) => s.endsWith('m') === minor)
    .map((shape) => ({ shape, fret: normalizeOffset(semitonesBetween(shape, target)) }))
    .filter((o) => o.fret >= 1 && o.fret <= 7)
    .sort((a, b) => a.fret - b.fret)
    .slice(0, 3)
}

const FAQ = [
  {
    q: 'O que é transpor uma cifra?',
    a: 'É mudar o tom da música: todos os acordes sobem ou descem a mesma distância (em semitons). A melodia continua igual, só fica mais aguda ou mais grave, para caber na voz de quem canta.',
  },
  {
    q: 'Como descobrir o tom certo para a minha voz?',
    a: 'Cante o trecho mais agudo e o mais grave da música. Se forçar no agudo, desça 1 ou 2 tons; se ficar grave demais, suba. Teste até ficar confortável e sem esforço.',
  },
  {
    q: 'Para que serve o capotraste?',
    a: 'Com o capotraste você toca as formas fáceis de acordes (como G, C e D) e o som sai no tom que você quer. O transpositor mostra em qual casa colocar e qual forma usar.',
  },
  {
    q: 'Precisa criar conta?',
    a: 'Não. O transpositor é grátis e funciona direto no navegador. No Ensaio Fácil, você guarda as cifras, monta o repertório e a banda inteira troca de tom junto.',
  },
]

export function Transposer() {
  const [input, setInput] = useState('')
  const [shift, setShift] = useState(0)
  const [copied, setCopied] = useState(false)
  const content = input.trim() ? input : ''
  const fromKey = useMemo(() => guessKey(content), [content])
  const toKey = fromKey ? transposeKey(fromKey, shift) : null
  const output = useMemo(() => (content ? transposeSheet(content, shift, toKey) : ''), [content, shift, toKey])
  const keys = fromKey?.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS

  const copy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <PublicPage>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        <nav aria-label="Você está em" className="text-sm text-muted">
          <Link to="/" className="hover:text-text">
            Início
          </Link>{' '}
          › Transpor cifra
        </nav>
        <header className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Transpor cifra online</h1>
          <p className="mt-2 text-lg text-muted">
            Cole a cifra, escolha o novo tom e pronto. Grátis, sem cadastro, com sugestão de capotraste para o violão.
          </p>
        </header>

        <section className="card space-y-4 p-5 sm:p-6" aria-label="Transpositor">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button className="btn-icon size-10" onClick={() => setShift((s) => s - 1)} aria-label="Descer meio tom">
                <Minus className="size-4" />
              </button>
              <span className="min-w-28 text-center text-sm">{shiftLabel(shift)}</span>
              <button className="btn-icon size-10" onClick={() => setShift((s) => s + 1)} aria-label="Subir meio tom">
                <Plus className="size-4" />
              </button>
            </div>
            {fromKey && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">
                  De <b className="font-mono text-chord">{fromKey}</b> para
                </span>
                <select
                  className="input h-10 w-24 font-mono"
                  value={toKey ?? fromKey}
                  onChange={(e) => setShift(semitonesBetween(fromKey, e.target.value))}
                  aria-label="Novo tom"
                >
                  {keys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!input && (
              <button className="chip h-10" onClick={() => setInput(EXAMPLE)}>
                Usar um exemplo
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Cifra original</span>
              <textarea
                className="input h-80 resize-y py-3 font-mono text-sm leading-relaxed"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'Cole a cifra aqui (acordes em cima da letra).\n\nG            D\n  Luz da manhã, acende em mim'}
                spellCheck={false}
              />
            </label>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">{toKey ? `Cifra em ${toKey}` : 'Cifra transposta'}</span>
                {output && (
                  <button className="chip h-8 text-xs" onClick={copy}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copiado' : 'Copiar'}
                  </button>
                )}
              </div>
              <pre
                className="sheet h-80 overflow-auto rounded-xl border border-border bg-bg/60 p-3 text-sm leading-relaxed"
                aria-live="polite"
              >
                {output ? (
                  output.split('\n').map((l, i) => (
                    <div key={i} className={clsx(isChordLine(l) && 'font-bold text-chord')}>
                      {l || ' '}
                    </div>
                  ))
                ) : (
                  <span className="text-muted">A cifra no novo tom aparece aqui.</span>
                )}
              </pre>
            </div>
          </div>

          {toKey && shift !== 0 && capoOptions(toKey).length > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-accent/10 px-4 py-3 text-sm">
              <ArrowRightLeft className="size-4 text-accent" />
              <b>Com capotraste:</b>
              {capoOptions(toKey).map((o) => (
                <span key={o.shape}>
                  capo na <b>{o.fret}ª casa</b> com formas de <b className="font-mono text-chord">{o.shape}</b>
                </span>
              ))}
            </p>
          )}
        </section>

        <TryCta
          title="A banda inteira no novo tom, ao mesmo tempo"
          text="No Ensaio Fácil, quem lidera troca o tom e todos os músicos veem a cifra transposta na hora, no celular de cada um."
        />

        <section className="max-w-3xl space-y-3" aria-labelledby="como">
          <h2 id="como" className="text-xl font-bold">
            Como transpor uma cifra
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed">
            <li>Cole a cifra com os acordes em cima da letra (como nos sites de cifras).</li>
            <li>O tom original é descoberto pelo primeiro acorde. Escolha o novo tom ou use + e − (cada clique é meio tom).</li>
            <li>Copie a cifra transposta. No violão, se preferir formas fáceis, use o capotraste na casa sugerida.</li>
          </ol>
        </section>

        <section className="max-w-3xl space-y-2" aria-labelledby="duvidas">
          <h2 id="duvidas" className="mb-3 text-xl font-bold">
            Dúvidas frequentes
          </h2>
          {FAQ.map((f) => (
            <details key={f.q} className="card p-0">
              <summary className="cursor-pointer p-4 font-semibold">{f.q}</summary>
              <p className="-mt-1 px-4 pb-4 text-muted">{f.a}</p>
            </details>
          ))}
        </section>

        <p className="text-sm text-muted">
          Precisa ver como montar algum acorde?{' '}
          <Link to="/acordes" className="font-semibold text-accent hover:underline">
            Abra o dicionário de acordes
          </Link>
          .
        </p>
      </div>
    </PublicPage>
  )
}

export const TRANSPOSER_FAQ = FAQ
