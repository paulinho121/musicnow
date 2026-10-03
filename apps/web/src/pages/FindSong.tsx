import { ArrowLeft, AudioLines, Check, Database, Loader2, PenLine, Search } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FindLinks } from '../components/FindLinks'
import { Spinner, useToast } from '../components/ui'
import { api } from '../lib/api'
import type { CatalogDetails, CatalogResult } from '../lib/types'

/**
 * Encontrar uma música: dados pelo MusicBrainz + links para a cifra e a gravação
 * nos sites de origem. O músico tira a música lá e guarda a versão DELE aqui (privada).
 */
export function FindSong() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [title, setTitle] = useState(params.get('q') ?? '')
  const [artist, setArtist] = useState(params.get('artista') ?? '')
  const [results, setResults] = useState<CatalogResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<(CatalogDetails & { id: string }) | null>(null)
  const [picking, setPicking] = useState<string | null>(null)

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    if (title.trim().length < 2) return toast('Digite o nome da música.', 'error')
    setParams({ q: title.trim(), ...(artist.trim() ? { artista: artist.trim() } : {}) }, { replace: true })
    setLoading(true)
    setPicked(null)
    try {
      const qs = new URLSearchParams({ title: title.trim(), ...(artist.trim() ? { artist: artist.trim() } : {}) })
      setResults(await api<CatalogResult[]>(`/catalog/search?${qs}`))
    } catch (err) {
      toast((err as Error).message, 'error')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Veio da busca da biblioteca (?q=...): já pesquisa.
  useEffect(() => {
    if (params.get('q')) void search()
    // Só ao abrir a tela; as buscas seguintes são pelo botão.
  }, [])

  const pick = async (r: CatalogResult) => {
    setPicking(r.id)
    try {
      const d = await api<CatalogDetails>(`/catalog/recording/${r.id}`)
      setPicked({ ...d, id: r.id, artist: d.artist ?? r.artist })
    } catch {
      setPicked({ id: r.id, title: r.title, artist: r.artist, composer: null, year: r.year, source: '' })
    } finally {
      setPicking(null)
    }
  }

  const createMine = (song: { title: string; artist: string | null; composer: string | null }) =>
    navigate('/musicas/nova', {
      state: {
        draft: {
          title: song.title,
          artist: song.artist,
          composer: song.composer,
          visibility: 'private',
          license: 'unknown',
          lyricsAuthorized: false,
        },
      },
    })

  const typed = { title: title.trim(), artist: artist.trim() || null }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/musicas" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Encontrar música</h1>
          <p className="text-sm text-muted">Ache a música, veja a cifra no site de origem e monte a sua versão aqui.</p>
        </div>
      </div>

      <form onSubmit={search} className="card grid gap-3 p-4 md:grid-cols-[2fr_1.4fr_auto] md:items-end">
        <label className="block">
          <span className="label">Música</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Talking to the Moon" autoFocus />
        </label>
        <label className="block">
          <span className="label">Artista (opcional)</span>
          <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ex.: Bruno Mars" />
        </label>
        <button className="btn-primary" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar
        </button>
        {!artist.trim() && (
          <p className="text-xs text-muted md:col-span-3">Dica: informe o artista para achar a gravação certa (muitas músicas têm regravações).</p>
        )}
      </form>

      {picked ? (
        <section className="card space-y-4 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ok">
              <Check className="size-3.5" /> Música encontrada
            </p>
            <h2 className="mt-1 text-xl font-bold">{picked.title}</h2>
            <p className="text-sm text-muted">
              {[picked.artist, picked.year].filter(Boolean).join(' · ')}
              {picked.composer && <span className="block">Composição: {picked.composer}</span>}
            </p>
          </div>
          <div>
            <p className="label">1. Veja a cifra e ouça a música</p>
            <FindLinks song={picked} />
          </div>
          <div>
            <p className="label">2. Monte a sua versão no Ensaio Fácil</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary" onClick={() => createMine(picked)}>
                <PenLine className="size-4" /> Criar minha versão
              </button>
              <Link to="/musicas/detectar" className="btn-ghost">
                <AudioLines className="size-4" /> Detectar acordes de uma gravação
              </Link>
            </div>
            <p className="mt-2 text-xs text-muted">
              Título, artista e compositores já vêm preenchidos. Você escreve ou cola a cifra que tirou; ela fica privada
              (só você e as bandas dos seus repertórios veem).
            </p>
          </div>
          <button className="text-sm text-muted hover:text-text" onClick={() => setPicked(null)}>
            ← Escolher outra gravação
          </button>
        </section>
      ) : loading ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : results ? (
        <section className="space-y-4">
          {results.length > 0 ? (
            <ul className="card divide-y divide-border">
              {results.map((r) => (
                <li key={r.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-60" onClick={() => pick(r)} disabled={picking !== null}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block truncate text-sm text-muted">{[r.artist, r.album, r.year].filter(Boolean).join(' · ')}</span>
                    </span>
                    {picking === r.id && <Loader2 className="size-4 animate-spin text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card p-4 text-sm text-muted">Nada encontrado no catálogo com esse nome.</p>
          )}
          {/* Não achou no catálogo (ou é uma música pouco conhecida): usa o que a pessoa digitou. */}
          <div className="card space-y-3 p-4">
            <p className="text-sm">
              Não é nenhuma dessas? Use “<b>{typed.title}</b>”{typed.artist && <> de <b>{typed.artist}</b></>}:
            </p>
            <FindLinks song={typed} compact />
            <button className="btn-ghost h-9 px-3 text-sm" onClick={() => createMine({ ...typed, composer: null })}>
              <PenLine className="size-4" /> Criar minha versão assim mesmo
            </button>
          </div>
        </section>
      ) : null}

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Database className="mt-0.5 size-3.5 shrink-0" />
        Os dados das músicas vêm do MusicBrainz, banco aberto de informações musicais. As cifras ficam nos sites de origem: o
        Ensaio Fácil só abre a página para você.
      </p>
    </div>
  )
}
