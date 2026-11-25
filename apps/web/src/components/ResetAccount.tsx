import { Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { clearOfflineData } from '../lib/auth'
import { Sheet } from './Sheet'

const CONFIRM_WORD = 'ZERAR'
/** Preferências guardadas neste aparelho que voltam ao padrão (o tema fica como está). */
const LOCAL_KEYS = ['ef-viewer', 'ef-chords', 'ef-print', 'ef-stage-sheet', 'ef-afinador']
const LOCAL_PREFIXES = ['ef-ensaio-', 'ef-offline:']

/** Zerar os dados (configuração de fábrica): apaga o conteúdo e deixa a conta como nova. */
export function ResetAccount() {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setWord('')
    setError(null)
  }

  const confirm = async () => {
    setError(null)
    setBusy(true)
    try {
      await api('/me/reset', { method: 'POST', json: { confirm: CONFIRM_WORD } })
    } catch (e) {
      setBusy(false)
      return setError((e as Error).message)
    }
    await clearOfflineData()
    try {
      for (const k of Object.keys(localStorage)) {
        if (LOCAL_KEYS.includes(k) || LOCAL_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k)
      }
    } catch {
      // navegação privada: nada guardado
    }
    // Recarrega o app do zero (nada da biblioteca antiga fica na memória).
    window.location.assign('/inicio')
  }

  return (
    <>
      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-semibold">Zerar meus dados</h2>
        <p className="mt-1 text-sm text-muted">Volta o app ao começo, como uma conta nova. Seu login e sua assinatura continuam.</p>
        <button type="button" className="btn mt-3 border border-border text-text hover:bg-surface-2" onClick={() => setOpen(true)}>
          <RotateCcw className="size-4" /> Zerar dados
        </button>
      </section>

      <Sheet open={open} onClose={close} title="Zerar meus dados">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">É apagado, sem como recuperar:</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm">
              <li>
                Suas <b>músicas</b> (com partituras, áudios e marcações), <b>repertórios</b> e <b>shows da agenda</b>.
              </li>
              <li>Favoritos, tons pessoais, anotações da Sala de ensaio e ajustes de leitura.</li>
              <li>Repertórios que você criou deixam de existir também para os músicos convidados.</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Continua como está:</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm text-muted">
              <li>Seu login, perfil, assinatura e página da banda.</li>
              <li>
                Repertórios <b>de outras pessoas</b> em que você toca. Músicas suas que estão neles ficam lá como cópia do dono, para não
                atrapalhar o show de ninguém.
              </li>
            </ul>
          </div>
          <p className="text-sm text-muted">A música de exemplo volta para você começar de novo.</p>

          <label className="block">
            <span className="label">
              Para confirmar, digite <b className="text-text">{CONFIRM_WORD}</b>
            </span>
            <input className="input" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={close}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn bg-danger text-white hover:brightness-110"
              disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={confirm}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Zerar tudo
            </button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
