import { ImageOff, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { SongCover } from './SongCover'
import { useToast } from './ui'

/**
 * Capa da música no editor: a capa do álbum (Cover Art Archive, pelo título e artista)
 * ou a capa desenhada pelo app.
 */
export function CoverPicker({
  title,
  artist,
  value,
  onChange,
}: {
  title: string
  artist: string | null
  /** link da capa · '' = capa gerada · null = procurar sozinho */
  value: string | null | undefined
  onChange: (v: string | null) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const canSearch = title.trim().length > 0 && Boolean(artist?.trim())

  const search = async () => {
    setBusy(true)
    try {
      const qs = new URLSearchParams({ title: title.trim(), artist: artist!.trim() })
      const { url } = await api<{ url: string | null }>(`/catalog/cover?${qs}`)
      if (url) {
        onChange(url)
        toast('Capa do álbum encontrada.')
      } else toast('Não achamos a capa desse álbum. A música fica com a capa gerada.', 'error')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const status = value
    ? 'Capa do álbum (Cover Art Archive)'
    : value === ''
      ? 'Capa gerada pelo app'
      : canSearch
        ? 'O app procura a capa do álbum sozinho depois de salvar'
        : 'Capa gerada pelo app (informe o artista para buscar a do álbum)'

  return (
    <div className="flex items-center gap-4">
      <SongCover song={{ title: title || 'Nova música', artist, coverUrl: value }} hd className="size-20 rounded-xl shadow-lg shadow-black/40 sm:size-24" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm text-muted">{status}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost h-9 px-3 text-sm whitespace-nowrap" onClick={search} disabled={!canSearch || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar capa
          </button>
          {value !== '' && (
            <button type="button" className="btn-ghost h-9 px-3 text-sm whitespace-nowrap" onClick={() => onChange('')}>
              <ImageOff className="size-4" /> Usar capa gerada
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
