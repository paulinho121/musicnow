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
  Music2,
  Pencil,
  Play,
  Radio,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { BandPanel } from '../components/setlist/BandPanel'
import { SchedulePanel } from '../components/setlist/SchedulePanel'
import { RehearsalsPanel } from '../components/setlist/RehearsalsPanel'
import { FinancePanel } from '../components/setlist/FinancePanel'
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
import { CoverMosaic, DateBadge, roleLabel, StatusChip, whenLabel } from './Setlists'
import { Avatar } from '../components/Avatar'
import { CoverGlow } from '../components/SongCover'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

const TABS = [
  { id: 'musicas', label: 'Músicas' },
  { id: 'banda', label: 'Banda' },
  { id: 'escala', label: 'Escala' },
  { id: 'ensaios', label: 'Ensaios' },
  { id: 'financeiro', label: 'Financeiro' },
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
      <div className="flex items-center justify-between gap-2">
        <Link to="/repertorios" className="btn-ghost h-9 border-transparent bg-transparent px-2 text-sm text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Repertórios
        </Link>
        {isAdmin && (
          <div className="flex gap-2">
            <Link to={`/repertorios/${s.id}/editar`} className="btn-ghost h-9 px-3 text-sm">
              <Pencil className="size-4" /> <span className="hidden sm:inline">Editar</span>
            </Link>
            <button className="btn-icon size-9 shrink-0" aria-label="Mais opções" onClick={() => setMenu(true)}>
              <MoreVertical className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* Destaque: capas, nome, data e a banda */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
        {s.items[0] && <CoverGlow song={s.items[0].song} />}
        <div className="relative flex items-start gap-4 p-4 sm:items-center sm:gap-6 sm:p-6">
          <CoverMosaic
            songs={s.items.slice(0, 4).map((i) => i.song)}
            className="size-24 rounded-2xl shadow-2xl shadow-black/50 sm:size-36"
          />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-widest text-muted uppercase">
              {s.groupName ?? 'Repertório'}
              <StatusChip status={s.status} />
              {s.archived && <span className="rounded-md bg-surface-2 px-2 py-0.5 tracking-normal normal-case">Arquivado</span>}
            </p>
            <h1 className="mt-1 line-clamp-3 text-xl leading-tight font-extrabold tracking-tight break-words sm:text-3xl">{s.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {roleLabel(s.role)}
              {s.role !== 'owner' && ` · de ${s.ownerName}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <HeroChip>
                <Music2 className="size-3.5" /> {s.items.length} {s.items.length === 1 ? 'música' : 'músicas'}
              </HeroChip>
              {s.location && (
                <HeroChip>
                  <MapPin className="size-3.5" /> <span className="max-w-48 truncate">{s.location}</span>
                </HeroChip>
              )}
              {s.parent && (
                <Link to={`/repertorios/${s.parent.id}`} className="hover:text-text">
                  <HeroChip>
                    <GitBranch className="size-3.5" /> Versão de “{s.parent.name}”
                  </HeroChip>
                </Link>
              )}
              <button onClick={() => setParams({ aba: 'banda' }, { replace: true })} className="flex items-center pl-1.5" title="Ver a banda">
                {s.members.slice(0, 5).map((m) => (
                  <Avatar key={m.userId} name={m.name} image={m.image} className="-ml-1.5 size-7 text-[10px] ring-2 ring-surface" />
                ))}
                <span className="ml-1.5 text-muted">
                  {s.members.length} na banda
                </span>
              </button>
            </div>
          </div>
        </div>
        {s.eventDate && (
          <div className="relative flex items-center gap-3 border-t border-white/5 bg-black/20 px-4 py-3 sm:px-6">
            <DateBadge iso={s.eventDate} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold first-letter:uppercase">{dateFmt.format(new Date(s.eventDate))}</p>
              {whenLabel(s.eventDate) && <p className="text-xs font-semibold text-accent">{whenLabel(s.eventDate)}</p>}
            </div>
            <CalendarDays className="ml-auto size-5 text-muted" />
          </div>
        )}
      </section>

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

      {/* Principais: tocar e comandar a banda. */}
      <div className={clsx('grid gap-2 sm:flex sm:flex-wrap', isAdmin && !live.stage && s.items.length > 0 ? 'grid-cols-2' : 'grid-cols-1')}>
        <button className="btn-primary h-12 sm:h-11" disabled={!s.items.length} onClick={() => navigate(`/repertorios/${s.id}/tocar/0`)}>
          <Play className="size-4" /> {s.status === 'ensaio' ? 'Ensaiar' : 'Tocar'}
        </button>
        {isAdmin && !live.stage && s.items.length > 0 && (
          <button
            className="btn-primary h-12 border-red-500/30 bg-red-600 font-semibold text-white hover:bg-red-700 sm:h-11"
            onClick={() => navigate(`/repertorios/${s.id}/tocar/0?lead=1`)}
            title="Você passa as músicas e a banda acompanha no celular de cada um"
          >
            <Radio className="size-4 animate-pulse" /> <span className="sm:hidden">Ao vivo</span>
            <span className="hidden sm:inline">Comandar Banda ao Vivo</span>
          </button>
        )}
      </div>
      {/* Secundários: no celular, uma linha de atalhos com ícone em cima e o nome embaixo. */}
      <div
        className={clsx(
          'flex gap-2 sm:flex-wrap',
          'max-sm:[&>*]:h-auto max-sm:[&>*]:min-w-0 max-sm:[&>*]:flex-1 max-sm:[&>*]:flex-col max-sm:[&>*]:gap-1 max-sm:[&>*]:px-1 max-sm:[&>*]:py-2 max-sm:[&>*]:text-[11px] max-sm:[&>*]:leading-tight',
        )}
      >
        <ExportButton setlist={s} />
        <OfflineButton setlist={s} />
        <button className="btn-ghost" onClick={() => setSharing(true)} disabled={!s.items.length}>
          <Megaphone className="size-4" /> Divulgar
        </button>
        {isAdmin && (
          <button className="btn-ghost" onClick={() => setParams({ aba: 'banda' }, { replace: true })}>
            <UserPlus className="size-4" /> Convidar
          </button>
        )}
      </div>

      <ShareSetlistDialog setlist={s} open={sharing} onClose={() => setSharing(false)} />

      {/* Abas: grudam no topo ao rolar a lista de músicas. */}
      <div className="sticky top-0 z-10 -mx-1 bg-bg/90 px-1 pt-1 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ aba: t.id }, { replace: true })}
            className={clsx(
              '-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition',
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
      </div>

      {tab === 'musicas' && <SongsPanel setlist={s} />}
      {tab === 'banda' && <BandPanel setlist={s} />}
      {tab === 'escala' && <SchedulePanel setlist={s} />}
      {tab === 'ensaios' && <RehearsalsPanel setlist={s} />}
      {tab === 'financeiro' && <FinancePanel setlist={s} />}
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

function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 backdrop-blur-sm">{children}</span>
  )
}
