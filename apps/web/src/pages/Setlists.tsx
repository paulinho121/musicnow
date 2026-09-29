import { ListMusic, Music2 } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/ui'

export function Setlists() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Repertórios</h1>
      <EmptyState
        icon={ListMusic}
        title="Chegando na próxima etapa"
        action={
          <Link to="/musicas" className="btn-ghost">
            <Music2 className="size-4" /> Ir para as músicas
          </Link>
        }
      >
        Aqui você vai montar a ordem das músicas de cada ensaio ou apresentação, definir o tom de cada uma e convidar a
        banda por link ou código. Enquanto isso, cadastre as músicas que vão entrar nos repertórios.
      </EmptyState>
    </div>
  )
}
