import { PERMISSION_HINTS, PERMISSIONS } from '@ensaio/shared'
import { CalendarDays, ListMusic, MapPin, Music2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useAcceptInvite, useInvitePreview } from '../lib/setlists'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

/** /convite/:code — prévia do repertório e botão de entrar. */
export function InviteAccept() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error } = useInvitePreview(code)
  const accept = useAcceptInvite()

  if (isLoading) return <PageSpinner />
  if (error || !data)
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <ErrorState error={error ?? new Error('Convite inválido.')} />
        <Link to="/repertorios" className="btn-ghost w-full">
          Ir para meus repertórios
        </Link>
      </div>
    )
  if (data.alreadyMember) return <Navigate to={`/repertorios/${data.setlistId}`} replace />

  return (
    <div className="mx-auto max-w-md space-y-5 pt-4">
      <div className="card space-y-4 p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/15">
          <ListMusic className="size-7 text-accent" />
        </div>
        <div>
          <p className="text-sm text-muted">{data.ownerName} te convidou para</p>
          <h1 className="mt-1 text-2xl font-bold">{data.name}</h1>
          {data.groupName && <p className="text-sm text-muted">{data.groupName}</p>}
        </div>
        <div className="flex flex-col items-center gap-1 text-sm text-muted">
          {data.eventDate && (
            <span className="inline-flex items-center gap-1.5 first-letter:uppercase">
              <CalendarDays className="size-4" /> {dateFmt.format(new Date(data.eventDate))}
            </span>
          )}
          {data.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {data.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Music2 className="size-4" /> {data.songCount} {data.songCount === 1 ? 'música' : 'músicas'}
          </span>
        </div>
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <b>{PERMISSIONS[data.permission]}</b>
          <span className="block text-xs text-muted">{PERMISSION_HINTS[data.permission]}</span>
        </p>
        <button
          className="btn-primary w-full"
          disabled={accept.isPending}
          onClick={() =>
            accept.mutate(code, {
              onSuccess: (r) => {
                toast('Você entrou no repertório.')
                navigate(`/repertorios/${r.setlistId}`, { replace: true })
              },
              onError: (e) => toast(e.message, 'error'),
            })
          }
        >
          {accept.isPending ? 'Entrando...' : 'Entrar no repertório'}
        </button>
      </div>
    </div>
  )
}
