import { Copy, Link2, Link2Off, Loader2, MessageCircle, RefreshCw, UserMinus, Users } from 'lucide-react'
import { shareLink, whatsappUrl } from '../lib/setlists'
import { useSongShare, useSongShareActions } from '../lib/songShare'
import { Sheet } from './Sheet'
import { useToast } from './ui'

/** Compartilhar a música com outras pessoas por link (elas veem e tocam; só você edita). */
export function ShareSongDialog({ songId, title, open, onClose }: { songId: string; title: string; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { data, isLoading } = useSongShare(songId, open)
  const { create, disable, remove } = useSongShareActions(songId)
  const text = `Compartilhei a música "${title}" com você no Ensaio Fácil:`
  const fail = (e: Error) => toast(e.message, 'error')

  const copy = async () => {
    if (!data?.url) return
    const r = await shareLink(title, text, data.url)
    if (r === 'copied') toast('Link copiado.')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Compartilhar música">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Quem abrir o link e entrar na conta recebe <b className="text-text">“{title}”</b> na biblioteca: vê a cifra e a partitura, toca, muda o
          próprio tom e faz marcações. <b className="text-text">Só você edita.</b>
        </p>

        {isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="size-5 animate-spin text-muted" />
          </div>
        ) : data?.url ? (
          <div className="space-y-3">
            <p className="truncate rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-xs text-muted">{data.url}</p>
            <div className="grid grid-cols-2 gap-2">
              <a className="btn-primary" href={whatsappUrl(`${text}\n${data.url}`)} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              <button className="btn-ghost" onClick={copy}>
                <Copy className="size-4" /> Copiar / enviar
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <button
                className="inline-flex items-center gap-1 text-muted hover:text-text"
                onClick={() => confirm('Trocar o link? O link antigo deixa de funcionar (quem já recebeu continua com a música).') && create.mutate(true, { onError: fail })}
              >
                <RefreshCw className="size-3.5" /> Trocar link
              </button>
              <button
                className="inline-flex items-center gap-1 text-muted hover:text-danger"
                onClick={() => confirm('Desligar o link? Ninguém mais consegue entrar por ele.') && disable.mutate(undefined, { onError: fail })}
              >
                <Link2Off className="size-3.5" /> Desligar link
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-primary w-full" onClick={() => create.mutate(false, { onError: fail })} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Criar link de compartilhamento
          </button>
        )}

        {data && data.people.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Users className="size-4 text-muted" /> Com acesso ({data.people.length})
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.people.map((p) => (
                <li key={p.userId} className="flex items-center gap-3 px-3 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <button
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                    onClick={() => confirm(`Tirar o acesso de ${p.name}?`) && remove.mutate(p.userId, { onError: fail })}
                    aria-label={`Tirar o acesso de ${p.name}`}
                  >
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
