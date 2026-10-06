import { atLeast } from '@ensaio/shared'
import clsx from 'clsx'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Copy,
  GitBranch,
  MapPin,
  Megaphone,
  MoreVertical,
  Pencil,
  Play,
  Radio,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { BandPanel } from '../components/setlist/BandPanel'
import { ExportButton } from '../components/setlist/ExportButton'
import { OfflineButton } from '../components/setlist/OfflineButton'
import { HistoryPanel } from '../components/setlist/HistoryPanel'
import { ShareSetlistDialog } from '../components/setlist/ShareSetlistDialog'
import { SongsPanel } from '../components/setlist/SongsPanel'
import { Sheet } from '../components/Sheet'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useSession } from '../lib/auth'
import { useSetlistLive } from '../lib/live'
import { useArchiveSetlist, useDeleteSetlist, useDuplicateSetlist, useSetlist } from '../lib/setlists'
import { roleLabel, StatusChip } from './Setlists'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

const TABS = [
  { id: 'musicas', label: 'Músicas' },
  { id: 'banda', label: 'Banda' },
  { id: 'historico', label: 'Histórico' },
] as const

export function SetlistDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('aba') ?? 'musicas') as (typeof TABS)[number]['id']
  const navigate = useNavigate()
  const toast = useToast()
  const { data: s, isLoading, error, refetch } = useSetlist(id)
  // Ao vivo: alterações chegam na hora e o aviso do Modo Palco aparece aqui.
  const live = useSetlistLive(id, s?.revision)
  const { data: session } = useSession()
  const archive = useArchiveSetlist(id ?? '')
  const del = useDeleteSetlist(id ?? '')
  const duplicate = useDuplicateSetlist(id ?? '')
  const [menu, setMenu] = useState(false)
  const [sharing, setSharing] = useState(false)

  if (isLoading) return <PageSpinner />
  if (error || !s) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} onRetry={() => refetch()} />

  const isAdmin = atLeast(s.role, 'admin')
  const isOwner = s.role === 'owner'

  const doDuplicate = (asVersion: boolean) =>
    duplicate.mutate(
      { asVersion },
      {
        onSuccess: (r) => {
          setMenu(false)
          toast(asVersion ? 'Nova versão criada.' : 'Cópia criada.')
          navigate(`/repertorios/${r.id}`)
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <Link to="/repertorios" className="btn-icon shrink-0 border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl leading-tight font-bold">{s.name}</h1>
            <StatusChip status={s.status} />
            {s.archived && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">Arquivado</span>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {roleLabel(s.role)}
            {s.role !== 'owner' && ` · de ${s.ownerName}`}
          </p>
        </div>
        {isAdmin && (
          <button className="btn-icon shrink-0" aria-label="Mais opções" onClick={() => setMenu(true)}>
            <MoreVertical className="size-5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
        {s.eventDate && (
          <span className="inline-flex items-center gap-1.5 first-letter:uppercase">
            <CalendarDays className="size-4" /> {dateFmt.format(new Date(s.eventDate))}
          </span>
        )}
        {s.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" /> {s.location}
          </span>
        )}
        {s.groupName && (
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> {s.groupName}
          </span>
        )}
        {s.parent && (
          <Link to={`/repertorios/${s.parent.id}`} className="inline-flex items-center gap-1.5 hover:text-text">
            <GitBranch className="size-4" /> Versão de “{s.parent.name}”
          </Link>
        )}
      </div>
      {s.notes && <p className="rounded-xl border-l-4 border-accent bg-accent/10 px-3 py-2 text-sm whitespace-pre-line">{s.notes}</p>}

      {live.stage && s.items[live.stage.position] && (
        <button
          className="card flex w-full items-center gap-3 border-danger/50 bg-danger/10 p-4 text-left transition hover:border-danger"
          onClick={() => navigate(`/repertorios/${s.id}/tocar/${live.stage!.position}`)}
        >
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-danger" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {live.stage.leaderId === session?.user.id
                ? 'Você está comandando a banda'
                : `Ao vivo agora · ${live.stage.leaderName} no comando`}
            </span>
            <span className="block truncate text-sm text-muted">
              Tocando: {s.items[live.stage.position].song.title} · {live.presence.length} conectados
            </span>
          </span>
          <span className="btn-primary h-9 shrink-0 px-3">Entrar no Modo Ao Vivo</span>
        </button>
      )}

      {/* Celular: o botão principal ocupa a linha toda; os outros dividem a de baixo. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {isAdmin && !live.stage && s.items.length > 0 && (
          <button
            className="btn-primary col-span-2 sm:col-auto border-red-500/30 bg-red-600 hover:bg-red-700 text-white font-semibold"
            onClick={() => navigate(`/repertorios/${s.id}/tocar/0?lead=1`)}
          >
            <Radio className="size-4 animate-pulse" /> Comandar Banda ao Vivo
          </button>
        )}
        <button
          className="btn-primary col-span-2 sm:col-auto"
          disabled={!s.items.length}
          onClick={() => navigate(`/repertorios/${s.id}/tocar/0`)}
        >
          <Play className="size-4" /> {s.status === 'ensaio' ? 'Ensaiar' : 'Tocar'}
        </button>
        <ExportButton setlist={s} />
        <OfflineButton setlist={s} />
        <button className="btn-ghost" onClick={() => setSharing(true)} disabled={!s.items.length}>
          <Megaphone className="size-4" /> Divulgar
        </button>
        {isAdmin && (
          <button className="btn-ghost" onClick={() => setParams({ aba: 'banda' }, { replace: true })}>
            <UserPlus className="size-4" /> Convidar Músicos
          </button>
        )}
      </div>

      <ShareSetlistDialog setlist={s} open={sharing} onClose={() => setSharing(false)} />

      <div className="flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ aba: t.id }, { replace: true })}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition',
              tab === t.id ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {t.label}
            {t.id === 'musicas' && ` (${s.items.length})`}
            {t.id === 'banda' && ` (${s.members.length})`}
            {t.id === 'musicas' && isAdmin && s.suggestions.some((x) => x.status === 'open') && (
              <span className="ml-1.5 inline-block size-2 rounded-full bg-accent" aria-label="Há sugestões novas" />
            )}
          </button>
        ))}
      </div>

      {tab === 'musicas' && <SongsPanel setlist={s} />}
      {tab === 'banda' && <BandPanel setlist={s} />}
      {tab === 'historico' && <HistoryPanel setlist={s} />}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Repertório">
        <div className="space-y-2">
          <Link to={`/repertorios/${s.id}/editar`} className="btn-ghost w-full justify-start">
            <Pencil className="size-4" /> Editar dados
          </Link>
          <button className="btn-ghost w-full justify-start" onClick={() => doDuplicate(false)} disabled={duplicate.isPending}>
            <Copy className="size-4" /> Duplicar (para outro culto ou show)
          </button>
          <button className="btn-ghost w-full justify-start" onClick={() => doDuplicate(true)} disabled={duplicate.isPending}>
            <GitBranch className="size-4" /> Criar nova versão
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() =>
              archive.mutate(!s.archived, {
                onSuccess: () => {
                  setMenu(false)
                  toast(s.archived ? 'Repertório desarquivado.' : 'Repertório arquivado.')
                },
              })
            }
          >
            {s.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {s.archived ? 'Desarquivar' : 'Arquivar'}
          </button>
          {isOwner && (
            <button
              className="btn-ghost w-full justify-start text-danger"
              onClick={() => {
                if (!confirm(`Excluir "${s.name}"? A banda perde o acesso e isso não pode ser desfeito.`)) return
                del.mutate(undefined, {
                  onSuccess: () => {
                    toast('Repertório excluído.')
                    navigate('/repertorios', { replace: true })
                  },
                  onError: (e) => toast(e.message, 'error'),
                })
              }}
            >
              <Trash2 className="size-4" /> Excluir repertório
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}
