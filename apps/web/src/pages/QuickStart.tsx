import { parseSetlistText } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ClipboardPaste, ListMusic, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { blockColor, blockSubtitle, EXAMPLE, PreviewSongs } from '../components/setlist/Blocks'
import { useToast } from '../components/ui'
import { api } from '../lib/api'
import { keys as songKeys } from '../lib/queries'
import { type ImportTextResult, setlistKeys } from '../lib/setlists'

/**
 * Primeiro minuto de quem acabou de criar a conta: dá nome ao show, cola a lista que já
 * tem no WhatsApp e sai com o repertório montado (blocos, tons e músicas).
 */
export function QuickStart() {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const parsed = useMemo(() => parseSetlistText(text), [text])
  const songs = parsed.loose.length + parsed.blocks.reduce((n, b) => n + b.songs.length, 0)

  const create = async () => {
    setBusy(true)
    try {
      const { id } = await api<{ id: string }>('/setlists', {
        method: 'POST',
        json: {
          name: name.trim() || 'Meu primeiro repertório',
          eventDate: date ? new Date(`${date}T20:00`).toISOString() : null,
          location: null,
          groupName: null,
          notes: null,
          status: 'ensaio',
        },
      })
      if (songs > 0) {
        const r = await api<ImportTextResult>(`/setlists/${id}/import-text`, { method: 'POST', json: { text } })
        toast(`Repertório pronto: ${r.songs} ${r.songs === 1 ? 'música' : 'músicas'}${r.blocks ? ` em ${r.blocks} blocos` : ''}.`)
      }
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      qc.invalidateQueries({ queryKey: songKeys.dashboard })
      navigate(`/repertorios/${id}`, { replace: true })
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-accent">Passo 1 de 2 · leva 1 minuto</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Monte seu primeiro repertório</h1>
        <p className="mt-1.5 text-muted">
          Cole a lista que você já manda no WhatsApp. O app separa os blocos, os tons e as músicas sozinho.
        </p>
      </div>

      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <label className="block">
            <span className="label">Nome do show, culto ou ensaio</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Baile de sexta, Culto de domingo"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="label">Data (opcional)</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="label flex items-center gap-1.5">
              <ClipboardPaste className="size-4" /> Cole a lista
            </span>
            <textarea
              className="input h-56 resize-none py-3 font-mono text-sm leading-relaxed md:h-72"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              spellCheck={false}
            />
          </label>
          <div>
            <span className="label">O que o app entendeu</span>
            <div className="h-56 overflow-y-auto rounded-xl border border-border bg-bg/60 p-3 md:h-72" aria-live="polite">
              {songs === 0 ? (
                <div className="grid h-full place-items-center text-center text-sm text-muted">
                  <span>
                    <ListMusic className="mx-auto mb-2 size-6 opacity-60" />
                    Uma música por linha, com o tom: <b className="text-text">Fada - A</b>
                    <br />
                    Blocos: <b className="text-text">BLOCO 1 (Balada - 80)</b>
                  </span>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {parsed.loose.length > 0 && <PreviewSongs songs={parsed.loose} />}
                  {parsed.blocks.map((b, i) => (
                    <div key={i}>
                      <p className="font-bold" style={{ color: blockColor(i) }}>
                        {b.name}
                        {blockSubtitle(b) && <span className="ml-1.5 font-medium text-muted">· {blockSubtitle(b)}</span>}
                      </p>
                      {b.songs.length ? <PreviewSongs songs={b.songs} /> : <p className="text-xs text-muted">(sem músicas)</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/inicio" className="text-center text-sm text-muted hover:text-text">
            Pular, explorar o app primeiro
          </Link>
          <button className="btn-primary h-12 px-6 text-base" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {songs > 0 ? `Criar repertório com ${songs} ${songs === 1 ? 'música' : 'músicas'}` : 'Criar repertório vazio'}
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        Depois é só <b className="text-text">convidar a banda</b> (passo 2) e tocar no Modo Palco: todos veem a mesma música, no mesmo tom.
      </p>
    </div>
  )
}
