import { MAJOR_KEYS, MINOR_KEYS } from '@ensaio/shared'
import clsx from 'clsx'
import { FileUp, Music2, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SongRow } from '../components/SongRow'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { useFacets, useSongs } from '../lib/queries'

const SCOPES = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Minhas' },
  { value: 'favorites', label: 'Favoritas' },
  { value: 'public', label: 'Públicas' },
]

export function Library() {
  const [params, setParams] = useSearchParams()
  const scope = params.get('escopo') ?? 'all'
  const key = params.get('tom') ?? ''
  const style = params.get('estilo') ?? ''
  const [text, setText] = useState(params.get('q') ?? '')
  const [q, setQ] = useState(text)

  // Busca enquanto digita, sem disparar uma requisição por tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(t)
  }, [text])

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [q, params, setParams])

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  const { data: songs, isLoading, error, refetch, isFetching } = useSongs({ q, scope, key, style })
  const { data: facets } = useFacets()
  const filtered = Boolean(q || key || style || scope !== 'all')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Músicas</h1>
        <div className="flex gap-2">
          <Link to="/musicas/importar" className="btn-ghost">
            <FileUp className="size-4" /> Importar
          </Link>
          <Link to="/musicas/nova" className="btn-primary">
            <Plus className="size-4" /> Nova
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className="input h-12 pr-10 pl-10"
          placeholder="Título, artista, estilo, tom ou tag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Buscar músicas"
        />
        {text && (
          <button className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center text-muted" onClick={() => setText('')} aria-label="Limpar busca">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map((s) => (
          <button key={s.value} className={clsx('chip', scope === s.value && 'chip-on')} onClick={() => setParam('escopo', s.value)}>
            {s.label}
          </button>
        ))}
        <select className="chip appearance-none pr-3" value={key} onChange={(e) => setParam('tom', e.target.value)} aria-label="Filtrar por tom">
          <option value="">Qualquer tom</option>
          {[...MAJOR_KEYS, ...MINOR_KEYS].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        {Boolean(facets?.styles.length) && (
          <select className="chip appearance-none pr-3" value={style} onChange={(e) => setParam('estilo', e.target.value)} aria-label="Filtrar por estilo">
            <option value="">Qualquer estilo</option>
            {facets!.styles.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="card space-y-3 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : songs && songs.length > 0 ? (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {songs.length} {songs.length === 1 ? 'música' : 'músicas'}
            {isFetching && ' · atualizando...'}
          </p>
          <div className="card overflow-hidden">
            {songs.map((s) => (
              <SongRow key={s.id} song={s} />
            ))}
          </div>
        </>
      ) : filtered ? (
        <EmptyState icon={Search} title="Nada encontrado">
          Tente outro termo ou limpe os filtros. A busca ignora acentos: “manha” encontra “Manhã”.
        </EmptyState>
      ) : (
        <EmptyState
          icon={Music2}
          title="Sua biblioteca está vazia"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to="/musicas/importar" className="btn-primary">
                <FileUp className="size-4" /> Importar cifras
              </Link>
              <Link to="/musicas/nova" className="btn-ghost">
                <Plus className="size-4" /> Cadastrar uma
              </Link>
            </div>
          }
        >
          Cadastre músicas com cifra para transpor, marcar e montar repertórios.
        </EmptyState>
      )}
    </div>
  )
}
