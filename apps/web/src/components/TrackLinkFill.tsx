import { Link2, Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { useToast } from './ui'

export interface TrackInfo {
  title: string
  artist: string | null
  bpm: number | null
  durationSec: number | null
  url: string
  /** Já está na biblioteca da pessoa (mesmo nome e artista). */
  songId: string | null
}

/**
 * Música nova a partir do link do Deezer (o link do botão Compartilhar): preenche nome,
 * artista, BPM e o link da versão. A cifra a pessoa cola depois.
 */
export function TrackLinkFill({ onFill }: { onFill: (t: TrackInfo) => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<TrackInfo | null>(null)
  const toast = useToast()

  // Não é um <form>: ele fica dentro do formulário da música (form dentro de form não vale).
  const load = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    try {
      const t = await api<TrackInfo>('/songs/from-link', { method: 'POST', json: { url: url.trim() } })
      setFound(t)
      onFill(t)
      toast(`"${t.title}" preenchida. Agora é só colar a cifra.`)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card p-4 md:p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Link2 className="size-4 text-accent" /> Preencher pelo link do Deezer
      </p>
      <p className="mt-1 text-sm text-muted">No app do Deezer: abra a música → Compartilhar → Copiar link, e cole aqui.</p>
      <div className="mt-3 flex gap-2">
        <input
          className="input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') load(e)
          }}
          placeholder="https://link.deezer.com/s/…"
        />
        <button type="button" className="btn-primary shrink-0" onClick={() => load()} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
        </button>
      </div>
      {found?.songId && (
        <p className="mt-2 text-sm text-muted">
          Você já tem essa música na biblioteca.{' '}
          <Link to={`/musicas/${found.songId}`} className="font-semibold text-accent hover:underline">
            Abrir a que já existe
          </Link>
        </p>
      )}
    </section>
  )
}
