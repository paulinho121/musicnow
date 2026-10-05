import { Library, Loader2, Music2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { SongCover } from '../components/SongCover'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useAcceptSharedSong, useSharedSongPreview } from '../lib/songShare'

/** /compartilhado/:code — prévia da música recebida e "Adicionar à minha biblioteca". */
export function SharedSongAccept() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error } = useSharedSongPreview(code)
  const accept = useAcceptSharedSong()

  if (isLoading) return <PageSpinner />
  if (error || !data)
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <ErrorState error={error ?? new Error('Link inválido.')} />
        <p className="text-center text-sm text-muted">O link pode ter sido trocado ou desligado por quem compartilhou. Peça um novo.</p>
        <Link to="/musicas" className="btn-ghost w-full">
          Ir para minhas músicas
        </Link>
      </div>
    )
  // Já tem (ou é a dona): vai direto para a música.
  if (data.alreadyHas) return <Navigate to={`/musicas/${data.id}`} replace />

  const add = () =>
    accept.mutate(code, {
      onSuccess: ({ songId }) => {
        toast(`"${data.title}" está na sua biblioteca.`)
        navigate(`/musicas/${songId}`, { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    })

  return (
    <div className="mx-auto max-w-md space-y-5 pt-4">
      <p className="text-center text-sm text-muted">
        <b className="text-text">{data.ownerName}</b> compartilhou uma música com você
      </p>
      <div className="card flex items-center gap-4 p-4">
        <SongCover song={data} hd className="size-24 rounded-2xl shadow-xl shadow-black/40" />
        <div className="min-w-0">
          <p className="line-clamp-2 text-xl leading-tight font-bold">{data.title}</p>
          {data.artist && <p className="mt-0.5 truncate text-sm text-muted">{data.artist}</p>}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm text-muted">
        <li className="flex items-center gap-2">
          <Music2 className="size-4 shrink-0 text-accent" /> Você vê a cifra e a partitura, toca e muda o seu tom.
        </li>
        <li className="flex items-center gap-2">
          <Library className="size-4 shrink-0 text-accent" /> Ela fica em Músicas → Compartilhadas comigo. Só {data.ownerName} edita.
        </li>
      </ul>
      <button className="btn-primary w-full" onClick={add} disabled={accept.isPending}>
        {accept.isPending && <Loader2 className="size-4 animate-spin" />} Adicionar à minha biblioteca
      </button>
    </div>
  )
}
