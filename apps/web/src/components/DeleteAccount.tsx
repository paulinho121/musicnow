import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { authClient, authErrorMessage, clearOfflineData } from '../lib/auth'
import { Sheet } from './Sheet'
import { useToast } from './ui'

const CONFIRM_WORD = 'EXCLUIR'

/** Excluir a conta (LGPD): explica o que acontece, pede a senha e a palavra de confirmação. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const close = () => {
    setOpen(false)
    setPassword('')
    setWord('')
    setError(null)
  }

  const confirm = async () => {
    setError(null)
    setBusy(true)
    // Quem entrou com Google não tem senha: vale o login recente.
    const res = await authClient.deleteUser(password ? { password } : {})
    setBusy(false)
    if (res.error) {
      const code = (res.error as { code?: string }).code
      return setError(
        code === 'SESSION_EXPIRED' ? 'Por segurança, saia e entre de novo antes de excluir a conta.' : authErrorMessage(res.error),
      )
    }
    await clearOfflineData()
    qc.clear()
    toast('Sua conta foi excluída. Obrigado por ter tocado com a gente.')
    navigate('/', { replace: true })
  }

  return (
    <>
      <section className="rounded-2xl border border-danger/30 p-4">
        <h2 className="font-semibold">Excluir minha conta</h2>
        <p className="mt-1 text-sm text-muted">Apaga para sempre sua conta, suas músicas, repertórios e arquivos.</p>
        <button type="button" className="btn mt-3 border border-danger/40 text-danger hover:bg-danger/10" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Excluir conta
        </button>
      </section>

      <Sheet open={open} onClose={close} title="Excluir a conta">
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>
              Suas <b>músicas, repertórios, marcações, partituras e imagens</b> são apagados e não dá para recuperar.
            </li>
            <li>Repertórios que você criou deixam de existir também para os músicos convidados.</li>
            <li>
              Músicas suas que estão no repertório <b>de outras pessoas</b> continuam lá como cópia delas, sem o seu nome, para não
              atrapalhar o show de ninguém.
            </li>
            <li>Sua assinatura é cancelada e nada mais é cobrado.</li>
          </ul>

          <label className="block">
            <span className="label">Sua senha</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <span className="mt-1 block text-xs text-muted">Se você entra com o Google, deixe em branco.</span>
          </label>
          <label className="block">
            <span className="label">
              Para confirmar, digite <b className="text-text">{CONFIRM_WORD}</b>
            </span>
            <input
              className="input"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
            />
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
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Excluir para sempre
            </button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
