import { formatBRL } from '@ensaio/shared'
import { AlertCircle, Eye, FileMusic, Music, Shield, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorState, PageSpinner } from '../../components/ui'
import { useAdminOverview } from '../../lib/admin'

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 KB'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function AdminOverview() {
  const { data, isLoading, error, refetch } = useAdminOverview()

  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const { users, songs, setlists, scores, reports, visits, activeUsers, online } = data
  const onlineList = online?.users ?? []
  const onlineCount = online?.count ?? 0

  return (
    <div className="space-y-6">
      {/* Card de Usuários Online em Tempo Real */}
      <div className="card border-emerald-500/30 bg-emerald-950/20 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text">Usuários Online em Tempo Real</h2>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {onlineCount} {onlineCount === 1 ? 'músico conectado' : 'músicos conectados'}
                </span>
              </div>
              <p className="text-xs text-muted">Atualizado ao vivo a cada poucos segundos</p>
            </div>
          </div>

          <Link
            to="/admin/usuarios"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline"
          >
            Ver todos os usuários &rarr;
          </Link>
        </div>

        {onlineList.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {onlineList.map((u) => (
              <div
                key={u.userId}
                className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-surface/80 p-2.5 backdrop-blur shadow-xs"
              >
                <div className="relative grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-xs uppercase text-emerald-300 border border-emerald-500/30">
                  {u.image ? (
                    <img src={u.image} alt={u.name} className="size-full rounded-full object-cover" />
                  ) : (
                    u.name.slice(0, 2)
                  )}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-text">{u.name}</p>
                  <p className="truncate text-[10px] text-muted">{u.email}</p>
                  <p className="truncate font-mono text-[10px] text-emerald-400/90 mt-0.5">
                    Navegando: {u.path}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted italic">Nenhum outro usuário ativo no momento.</p>
        )}
      </div>

      {/* Alerta de moderação se houver denúncias abertas */}
      {reports.open > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold">
                {reports.open} {reports.open === 1 ? 'denúncia pendente' : 'denúncias pendentes'} para moderação
              </p>
              <p className="text-xs text-amber-300/80">Revise músicas reportadas por usuários.</p>
            </div>
          </div>
          <Link
            to="/admin/denuncias"
            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition"
          >
            Ver Denúncias
          </Link>
        </div>
      )}

      {/* Assinaturas e receita */}
      {data.billing && (
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-muted uppercase">Receita mensal</p>
            <p className="text-2xl font-bold tracking-tight">{formatBRL(data.billing.mrr)}</p>
            <p className="text-[11px] text-muted">{data.billing.enforced ? 'cobrança ativa' : 'cobrança ainda desligada'}</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-muted uppercase">Assinantes</p>
            <p className="text-2xl font-bold tracking-tight">{data.billing.paying}</p>
            <p className="text-[11px] text-muted">
              {data.billing.monthly} mensal · {data.billing.yearly} anual
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-muted uppercase">Em teste</p>
            <p className="text-2xl font-bold tracking-tight">{data.billing.trialing}</p>
            <p className="text-[11px] text-muted">{data.billing.expired} testes vencidos sem assinar</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-muted uppercase">Atenção</p>
            <p className="text-2xl font-bold tracking-tight">{data.billing.pastDue}</p>
            <p className="text-[11px] text-muted">atrasados · {data.billing.canceling} cancelando</p>
          </div>
        </div>
      )}

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card Usuários */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Usuários Totais</span>
            <Users className="size-4 text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-text">{users.total}</span>
            <span className="text-xs text-ok font-medium">+{users.new7d} últimos 7d</span>
          </div>
          <div className="border-t border-border/50 pt-2 text-[11px] text-muted flex justify-between">
            <span>Hoje: +{users.newToday}</span>
            <span>Mês: +{users.new30d}</span>
            <span>Admins: {users.admins}</span>
          </div>
        </div>

        {/* Card Visitas & Atividade */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Visitas (Hoje / 7d)</span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-text">{visits.today}</span>
            <span className="text-xs text-muted">/ {visits.last7d} (7d)</span>
          </div>
          <div className="border-t border-border/50 pt-2 text-[11px] text-muted flex justify-between">
            <span>DAU (Ativos hoje): {activeUsers.dau}</span>
            <span>MAU: {activeUsers.mau}</span>
          </div>
        </div>

        {/* Card Músicas */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Músicas & Cifras</span>
            <Music className="size-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-text">{songs.total}</span>
            <span className="text-xs text-muted">cadastradas</span>
          </div>
          <div className="border-t border-border/50 pt-2 text-[11px] text-muted flex justify-between">
            <span>{songs.public} públicas</span>
            <span>{songs.shared} compartilhadas</span>
            <span>{songs.private} privadas</span>
          </div>
        </div>

        {/* Card Repertórios & Partituras */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Repertórios & Partituras</span>
            <FileMusic className="size-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-text">{setlists.total}</span>
            <span className="text-xs text-muted">repertórios ({setlists.active} ativos)</span>
          </div>
          <div className="border-t border-border/50 pt-2 text-[11px] text-muted flex justify-between">
            <span>Partituras: {scores.totalParts}</span>
            <span>Armazenamento: {formatBytes(scores.totalBytes)}</span>
          </div>
        </div>
      </div>

      {/* Seção com atalhos rápidos e detalhes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="size-4 text-accent" />
              Monitoramento de Tráfego
            </h3>
            <Link to="/admin/visitas" className="text-xs text-accent hover:underline">
              Ver Gráficos &rarr;
            </Link>
          </div>
          <p className="text-xs text-muted">
            Acompanhe o volume de acessos diários, as páginas mais visualizadas (músicas, repertórios, etc.) e o perfil de dispositivos dos músicos.
          </p>
          <div className="rounded-xl bg-surface-2 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Acessos hoje:</span>
              <span className="font-semibold">{visits.today}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Acessos nos últimos 30 dias:</span>
              <span className="font-semibold">{visits.last30d}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Músicos logados ativos (30d):</span>
              <span className="font-semibold text-accent">{activeUsers.mau}</span>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="size-4 text-accent" />
              Gestão de Acessos & Usuários
            </h3>
            <Link to="/admin/usuarios" className="text-xs text-accent hover:underline">
              Gerenciar Usuários &rarr;
            </Link>
          </div>
          <p className="text-xs text-muted">
            Visualize a lista de todos os usuários registrados, busque por nome ou e-mail, promova administradores e controle o status da conta.
          </p>
          <div className="rounded-xl bg-surface-2 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Total de Contas:</span>
              <span className="font-semibold">{users.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Novos nesta semana:</span>
              <span className="font-semibold text-ok">+{users.new7d}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Administradores no sistema:</span>
              <span className="font-semibold">{users.admins}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
