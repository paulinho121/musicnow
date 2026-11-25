import { MAJOR_KEYS, MINOR_KEYS } from '@ensaio/shared'
import clsx from 'clsx'
import { CheckSquare, FileUp, Globe, Loader2, Music2, Plus, Search, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LibraryShelf } from '../components/LibraryShelf'
import { SelectionBar } from '../components/SelectionBar'
import { Sheet } from '../components/Sheet'
import { SongRow } from '../components/SongRow'
import { EmptyState, ErrorState, Skeleton, useToast } from '../components/ui'
import { useBulkDeleteSongs, useFacets, useMe, useSongs } from '../lib/queries'

const SCOPES = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Minhas' },
  { value: 'favorites', label: 'Favoritas' },
  { value: 'shared', label: 'Compartilhadas comigo' },
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

  const filtered = Boolean(q || key || style || scope !== 'all')
  // Sem busca: a estante precisa da biblioteca inteira; com busca, os primeiros resultados bastam.
  const { data: songs, isLoading, error, refetch, isFetching } = useSongs({ q, scope, key, style, limit: filtered ? '200' : '1000' })
  const { data: facets } = useFacets()
  const { data: me } = useMe()
  const toast = useToast()

  // Seleção para excluir várias: só as músicas que a pessoa cadastrou.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const bulkDelete = useBulkDeleteSongs()
  const selectable = useMemo(() => (songs ?? []).filter((s) => s.ownerId === me?.id).map((s) => s.id), [songs, me?.id])
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const deleteSelected = () =>
    bulkDelete.mutate([...selected], {
      onSuccess: ({ deleted, kept }) => {
        setConfirmOpen(false)
        stopSelecting()
        const done = `${deleted} ${deleted === 1 ? 'música excluída' : 'músicas excluídas'}.`
        toast(
          kept.length
            ? `${done} ${kept.length === 1 ? 'Ficou 1, que está' : `Ficaram ${kept.length}, que estão`} em repertório: ${kept.map((k) => k.title).join(', ')}.`
            : done,
          kept.length ? 'error' : undefined,
        )
      },
      onError: (e) => toast(e.message, 'error'),
    })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Músicas</h1>
        <div className="flex gap-2">
          <Link to="/musicas/encontrar" className="btn-ghost hidden sm:inline-flex">
            <Globe className="size-4" /> Encontrar
          </Link>
          <Link to="/musicas/importar" className="btn-ghost hidden sm:inline-flex">
            <FileUp className="size-4" /> Importar
          </Link>
          {Boolean(songs?.length) && !selecting && (
            <button className="btn-ghost" onClick={() => setSelecting(true)} title="Selecionar músicas para excluir">
              <CheckSquare className="size-4" /> <span className="hidden sm:inline">Selecionar</span>
            </button>
          )}
          <Link to="/musicas/nova" className="btn-primary">
            <Plus className="size-4" /> Nova
          </Link>
        </div>
      </div>
      {/* Celular: as outras formas de trazer música dividem uma linha, embaixo do título. */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <Link to="/musicas/encontrar" className="btn-ghost">
          <Globe className="size-4" /> Encontrar
        </Link>
        <Link to="/musicas/importar" className="btn-ghost">
          <FileUp className="size-4" /> Importar
        </Link>
      </div>

      {/* Busca fixa no topo ao rolar (a biblioteca pode ser longa). */}
      <div className="sticky top-0 z-20 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
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
            <button
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center text-muted"
              onClick={() => setText('')}
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros: no celular, uma linha que desliza para o lado (não ocupa meia tela). */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] *:shrink-0 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {SCOPES.map((s) => (
          <button key={s.value} className={clsx('chip', scope === s.value && 'chip-on')} onClick={() => setParam('escopo', s.value)}>
            {s.label}
          </button>
        ))}
        <select
          className="chip appearance-none pr-3"
          value={key}
          onChange={(e) => setParam('tom', e.target.value)}
          aria-label="Filtrar por tom"
        >
          <option value="">Qualquer tom</option>
          {[...MAJOR_KEYS, ...MINOR_KEYS].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        {Boolean(facets?.styles.length) && (
          <select
            className="chip appearance-none pr-3"
            value={style}
            onChange={(e) => setParam('estilo', e.target.value)}
            aria-label="Filtrar por estilo"
          >
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
      ) : songs && songs.length > 0 && !filtered && !selecting ? (
        <LibraryShelf songs={songs} />
      ) : songs && songs.length > 0 ? (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {songs.length} {songs.length === 1 ? 'música' : 'músicas'}
            {isFetching && ' · atualizando...'}
          </p>
          <div className="card overflow-hidden">
            {songs.map((s) =>
              selecting ? (
                <SongRow
                  key={s.id}
                  song={s}
                  select={{ checked: selected.has(s.id), disabled: s.ownerId !== me?.id, onToggle: () => toggle(s.id) }}
                />
              ) : (
                <SongRow key={s.id} song={s} />
              ),
            )}
          </div>
        </>
      ) : scope === 'shared' && !q ? (
        <EmptyState icon={Share2} title="Ninguém compartilhou músicas com você ainda">
          Quando alguém mandar o link de uma música, ela aparece aqui. Para compartilhar uma música sua, abra a música e toque em
          Compartilhar.
        </EmptyState>
      ) : filtered ? (
        <EmptyState
          icon={Search}
          title="Nada encontrado na sua biblioteca"
          action={
            q && (
              <Link to={`/musicas/encontrar?q=${encodeURIComponent(q)}`} className="btn-primary">
                <Globe className="size-4" /> Encontrar “{q}” na internet
              </Link>
            )
          }
        >
          {q
            ? 'Ainda não tem essa música? Encontre a cifra no site de origem e monte a sua versão aqui.'
            : 'Tente outro termo ou limpe os filtros. A busca ignora acentos: “manha” encontra “Manhã”.'}
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

      {selecting && (
        <>
          {/* Espaço para a barra de seleção não cobrir a última música. */}
          <div className="h-20" />
          <SelectionBar
            count={selected.size}
            total={selectable.length}
            onAll={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable))}
            onCancel={stopSelecting}
            onDelete={() => setConfirmOpen(true)}
          />
        </>
      )}

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Excluir ${selected.size} ${selected.size === 1 ? 'música' : 'músicas'}?`}>
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>As músicas somem da sua biblioteca, com partituras, áudios e marcações. Não dá para desfazer.</li>
            <li>
              Músicas que estão em algum repertório <b>não são apagadas</b>, para não atrapalhar o show. Tire do repertório antes (ou
              exclua o repertório junto com as músicas, na tela de Repertórios).
            </li>
          </ul>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn bg-danger text-white hover:brightness-110" disabled={bulkDelete.isPending} onClick={deleteSelected}>
              {bulkDelete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
