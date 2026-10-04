import clsx from 'clsx'
import { Ban, ChevronLeft, ChevronRight, Search, Shield, ShieldAlert, User, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { ErrorState, PageSpinner, useToast } from '../../components/ui'
import { useAdminUsers, useUpdateUserRole, useUpdateUserStatus } from '../../lib/admin'

export function AdminUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useAdminUsers({
    q: search || undefined,
    role: roleFilter || undefined,
    page,
    limit: 15,
  })

  const updateRole = useUpdateUserRole()
  const updateStatus = useUpdateUserStatus()
  const toast = useToast()

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin'
    const confirmText =
      nextRole === 'admin'
        ? 'Tem certeza de que deseja tornar este usuário um Administrador?'
        : 'Tem certeza de que deseja remover os privilégios de administrador deste usuário?'

    if (!window.confirm(confirmText)) return

    try {
      await updateRole.mutateAsync({ id: userId, role: nextRole })
      toast(`Papel alterado para ${nextRole === 'admin' ? 'Administrador' : 'Usuário normal'}.`, 'ok')
    } catch {
      toast('Não foi possível alterar o papel do usuário.', 'error')
    }
  }

  const handleStatusToggle = async (userId: string, currentBanned: boolean) => {
    const nextBanned = !currentBanned
    const confirmText = nextBanned
      ? 'Deseja realmente bloquear este usuário? Ele não conseguirá mais acessar a plataforma.'
      : 'Deseja desbloquear o acesso deste usuário?'

    if (!window.confirm(confirmText)) return

    try {
      await updateStatus.mutateAsync({ id: userId, banned: nextBanned })
      toast(nextBanned ? 'Usuário bloqueado com sucesso.' : 'Usuário ativado com sucesso.', 'ok')
    } catch {
      toast('Não foi possível atualizar o status da conta.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou cidade..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-border bg-surface-2 pl-9 pr-4 py-2 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="">Todos os papéis</option>
            <option value="admin">Apenas Administradores</option>
            <option value="user">Apenas Usuários Normais</option>
          </select>
        </div>
      </div>

      {/* Conteúdo da Tabela */}
      {isLoading ? (
        <PageSpinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.users.length === 0 ? (
        <div className="card p-12 text-center text-muted text-xs">
          Nenhum usuário encontrado para a busca especificada.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-muted uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Músico / Usuário</th>
                  <th className="px-4 py-3">Papel & Status</th>
                  <th className="px-4 py-3">Músicas / Repertórios</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.users.map((u) => {
                  const isAdmin = u.role === 'admin'
                  const isBanned = u.banned
                  const isOnline = u.isOnline

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative grid size-8 place-items-center rounded-full bg-surface-2 text-muted font-bold text-xs uppercase overflow-visible border border-border shrink-0">
                            {u.image ? (
                              <img src={u.image} alt={u.name} className="size-full rounded-full object-cover" />
                            ) : (
                              u.name.slice(0, 2)
                            )}
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" title={`Online agora (${u.currentPath ?? ''})`} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-text truncate">
                              <span>{u.name}</span>
                              {isOnline && (
                                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                                  Online
                                </span>
                              )}
                            </div>
                            <div className="text-muted text-[11px] truncate">{u.email}</div>
                            {u.city && <div className="text-muted/80 text-[10px] truncate">{u.city}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                              isAdmin
                                ? 'bg-accent/15 text-accent border border-accent/20'
                                : 'bg-surface-2 text-muted border border-border',
                            )}
                          >
                            {isAdmin ? <Shield className="size-3" /> : <User className="size-3" />}
                            {isAdmin ? 'Admin' : 'Usuário'}
                          </span>

                          {isBanned && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger border border-danger/20">
                              <Ban className="size-3" /> Bloqueado
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted">
                        <div className="font-medium text-text">{u.songCount} cifras</div>
                        <div className="text-[11px]">{u.setlistCount} repertórios</div>
                      </td>

                      <td className="px-4 py-3 text-muted text-[11px]">
                        <div>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Tornar/Remover Admin */}
                          <button
                            onClick={() => handleRoleToggle(u.id, u.role)}
                            disabled={updateRole.isPending}
                            title={isAdmin ? 'Remover privilégio de Admin' : 'Promover a Administrador'}
                            className={clsx(
                              'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border',
                              isAdmin
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                : 'border-border bg-surface-2 text-muted hover:text-text hover:bg-surface-3',
                            )}
                          >
                            {isAdmin ? <ShieldAlert className="size-3.5" /> : <Shield className="size-3.5" />}
                            <span className="hidden md:inline">{isAdmin ? 'Remover Admin' : 'Tornar Admin'}</span>
                          </button>

                          {/* Botão Bloquear/Desbloquear */}
                          <button
                            onClick={() => handleStatusToggle(u.id, u.banned)}
                            disabled={updateStatus.isPending}
                            title={isBanned ? 'Desbloquear usuário' : 'Bloquear usuário'}
                            className={clsx(
                              'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border',
                              isBanned
                                ? 'border-ok/30 bg-ok/10 text-ok hover:bg-ok/20'
                                : 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
                            )}
                          >
                            {isBanned ? <UserCheck className="size-3.5" /> : <Ban className="size-3.5" />}
                            <span className="hidden md:inline">{isBanned ? 'Desbloquear' : 'Bloquear'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between text-xs text-muted">
            <div>
              Total: <span className="font-semibold text-text">{data.total}</span> usuários cadastrados
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1 disabled:opacity-40 hover:text-text"
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <span className="font-semibold text-text">
                {data.page} / {data.totalPages || 1}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1 disabled:opacity-40 hover:text-text"
              >
                Próximo <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
