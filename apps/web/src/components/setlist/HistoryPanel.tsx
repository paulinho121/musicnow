import { PERMISSIONS, type Permission } from '@ensaio/shared'
import { History } from 'lucide-react'
import { useSetlistHistory } from '../../lib/setlists'
import type { HistoryEntry, SetlistDetail } from '../../lib/types'
import { EmptyState, Skeleton } from '../ui'

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function describe(e: HistoryEntry, setlist: SetlistDetail): string {
  const d = (e.diff ?? {}) as Record<string, string | undefined>
  const song = d.title ?? setlist.items.find((i) => i.song.id === d.songId || i.id === d.itemId)?.song.title
  const member = setlist.members.find((m) => m.userId === d.userId)?.name
  switch (e.action) {
    case 'create': return 'criou o repertório'
    case 'duplicate': return 'criou como cópia de outro repertório'
    case 'version': return 'criou como nova versão de outro repertório'
    case 'update': return 'editou os dados do repertório'
    case 'archive': return 'arquivou o repertório'
    case 'unarchive': return 'desarquivou o repertório'
    case 'add_song': return `adicionou ${song ? `"${song}"` : 'uma música'}`
    case 'remove_song': return 'tirou uma música'
    case 'update_song': return `alterou ${song ? `"${song}"` : 'uma música'}${d.key ? ` (tom ${d.key})` : ''}`
    case 'reorder': return 'mudou a ordem das músicas'
    case 'add_block': return `criou o bloco ${d.name ? `"${d.name}"` : ''}`.trim()
    case 'update_block': return `editou o bloco ${d.name ? `"${d.name}"` : ''}`.trim()
    case 'remove_block': return `apagou o bloco ${d.name ? `"${d.name}"` : ''}`.trim()
    case 'import_text': return `colou uma lista com ${d.songs ?? 'várias'} músicas${Number(d.blocks) ? ` em ${d.blocks} blocos` : ''}`
    case 'join': return `entrou no repertório${d.permission ? ` (${PERMISSIONS[d.permission as Permission]?.toLowerCase()})` : ''}`
    case 'leave': return 'saiu do repertório'
    case 'remove_member': return `removeu ${member ?? 'um músico'}`
    case 'update_member': return d.permission ? `mudou a permissão de ${member ?? 'um músico'} para ${PERMISSIONS[d.permission as Permission]?.toLowerCase()}` : `atualizou o instrumento de ${member ?? 'um músico'}`
    case 'accept_suggestion': return 'aceitou uma sugestão'
    case 'reject_suggestion': return 'recusou uma sugestão'
    default: return e.action
  }
}

export function HistoryPanel({ setlist }: { setlist: SetlistDetail }) {
  const { data, isLoading } = useSetlistHistory(setlist.id, true)
  if (isLoading) return <Skeleton className="h-40" />
  if (!data?.length) return <EmptyState icon={History} title="Sem alterações registradas" />
  return (
    <ol className="card divide-y divide-border">
      {data.map((e) => (
        <li key={e.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <b>{e.userName ?? 'Alguém'}</b> {describe(e, setlist)}
          </span>
          <time className="shrink-0 text-xs text-muted" dateTime={e.createdAt}>
            {fmt.format(new Date(e.createdAt))}
          </time>
        </li>
      ))}
    </ol>
  )
}
