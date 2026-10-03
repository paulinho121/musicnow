import { Database, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import type { CatalogDetails, CatalogResult } from '../lib/types'
import { Sheet } from './Sheet'
import { Spinner, useToast } from './ui'

/**
 * "Buscar dados": procura a música no MusicBrainz (banco aberto de metadados) e
 * preenche artista e compositores. Nunca traz letra ou cifra — só os dados da obra.
 */
export function MetadataLookup({
  title,
  artist,
  onPick,
}: {
  title: string
  artist: string | null
  onPick: (d: CatalogDetails) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<CatalogResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)

  const search = async () => {
    if (title.trim().length < 2) return toast('Digite o título da música primeiro.', 'error')
    setOpen(true)
    setLoading(true)
    setResults(null)
    try {
      const params = new URLSearchParams({ title: title.trim(), ...(artist?.trim() ? { artist: artist.trim() } : {}) })
      setResults(await api<CatalogResult[]>(`/catalog/search?${params}`))
    } catch (e) {
      toast((e as Error).message, 'error')
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const pick = async (r: CatalogResult) => {
    setPicking(r.id)
    try {
      const d = await api<CatalogDetails>(`/catalog/recording/${r.id}`)
      onPick(d)
      setOpen(false)
      toast(d.composer ? 'Artista e compositores preenchidos.' : 'Artista preenchido (o MusicBrainz não tem os compositores desta gravação).')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setPicking(null)
    }
  }

  return (
    <>
      <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline" onClick={search}>
        <Search className="size-3.5" /> Buscar artista e compositores
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Dados da música">
        {loading ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : results?.length ? (
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-surface-2 disabled:opacity-60"
                  onClick={() => pick(r)}
                  disabled={picking !== null}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {[r.artist, r.album, r.year].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {picking === r.id && <Loader2 className="size-4 animate-spin text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            Nada encontrado. Confira o título ou preencha o artista para refinar a busca.
          </p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Database className="size-3.5" /> Dados do{' '}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer" className="underline">
            MusicBrainz
          </a>
          , banco aberto de informações musicais.
        </p>
      </Sheet>
    </>
  )
}
