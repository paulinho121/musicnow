import { atLeast, INSTRUMENTS, PERMISSION_HINTS, PERMISSIONS, type Instrument, type Permission } from '@ensaio/shared'
import clsx from 'clsx'
import { Copy, Crown, LogOut, Mail, MessageCircle, Share2, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../../lib/auth'
import { shareLink, useCreateInvite, useRemoveMember, useRevokeInvite, useUpdateMember, whatsappUrl } from '../../lib/setlists'
import type { SetlistDetail, SetlistInvite } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

const expiresFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

export function BandPanel({ setlist }: { setlist: SetlistDetail }) {
  const { data: session } = useSession()
  const uid = session?.user.id
  const isAdmin = atLeast(setlist.role, 'admin')
  const isOwner = setlist.role === 'owner'
  const update = useUpdateMember(setlist.id)
  const remove = useRemoveMember(setlist.id)
  const toast = useToast()
  const navigate = useNavigate()
  const [inviting, setInviting] = useState(false)

  const leave = () => {
    if (!uid || !confirm('Sair deste repertório? Você vai precisar de um novo convite para voltar.')) return
    remove.mutate(uid, {
      onSuccess: () => {
        toast('Você saiu do repertório.')
        navigate('/repertorios', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    })
  }

  return (
    <div className="space-y-5">
      {isAdmin && (
        <button className="btn-primary w-full sm:w-auto" onClick={() => setInviting(true)}>
          <UserPlus className="size-4" /> Convidar músicos
        </button>
      )}

      <ul className="card divide-y divide-border">
        {setlist.members.map((m) => {
          const me = m.userId === uid
          const isOwnerRow = m.permission === 'owner'
          // Dar/tirar "administrar" é só do dono; admin gerencia os demais níveis.
          const canChangePerm = isAdmin && !isOwnerRow && !me && (isOwner || m.permission !== 'admin')
          const canRemove = isAdmin && !isOwnerRow && !me && (isOwner || m.permission !== 'admin')
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar name={m.name} image={m.image} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {m.name}
                  {me && <span className="text-xs font-normal text-muted">(você)</span>}
                  {isOwnerRow && <Crown className="size-3.5 text-accent" aria-label="Dono" />}
                </p>
                {me && !isOwnerRow ? (
                  <select
                    className="mt-0.5 h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                    value={m.instrument ?? ''}
                    onChange={(e) => update.mutate({ userId: m.userId, instrument: e.target.value || null }, { onSuccess: () => toast('Instrumento atualizado.') })}
                    aria-label="Meu instrumento neste repertório"
                  >
                    <option value="">Instrumento...</option>
                    {(Object.keys(INSTRUMENTS) as Instrument[]).map((i) => (
                      <option key={i} value={i}>
                        {INSTRUMENTS[i]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted">{m.instrument ? INSTRUMENTS[m.instrument] : 'Instrumento não informado'}</p>
                )}
              </div>
              {isOwnerRow ? (
                <span className="text-xs font-semibold text-accent">Dono</span>
              ) : canChangePerm ? (
                <select
                  className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm"
                  value={m.permission}
                  onChange={(e) =>
                    update.mutate(
                      { userId: m.userId, permission: e.target.value as Permission },
                      { onSuccess: () => toast('Permissão atualizada.'), onError: (err) => toast(err.message, 'error') },
                    )
                  }
                  aria-label={`Permissão de ${m.name}`}
                >
                  {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                    <option key={p} value={p} disabled={p === 'admin' && !isOwner}>
                      {PERMISSIONS[p]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted">{PERMISSIONS[m.permission as Permission]}</span>
              )}
              {canRemove && (
                <button
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={`Remover ${m.name}`}
                  onClick={() =>
                    confirm(`Remover ${m.name} do repertório?`) &&
                    remove.mutate(m.userId, { onSuccess: () => toast(`${m.name} foi removido.`), onError: (e) => toast(e.message, 'error') })
                  }
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {isAdmin && setlist.invites.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">Convites ativos</h3>
          <ul className="card divide-y divide-border">
            {setlist.invites.map((i) => (
              <InviteRow key={i.id} setlist={setlist} invite={i} />
            ))}
          </ul>
        </section>
      )}

      <details className="text-sm text-muted">
        <summary className="cursor-pointer">O que cada permissão pode fazer?</summary>
        <ul className="mt-2 space-y-1 pl-4">
          {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
            <li key={p}>
              <b className="text-text">{PERMISSIONS[p]}:</b> {PERMISSION_HINTS[p]}
            </li>
          ))}
        </ul>
      </details>

      {!isOwner && (
        <button className="btn-ghost text-danger" onClick={leave}>
          <LogOut className="size-4" /> Sair do repertório
        </button>
      )}

      {isAdmin && <InviteDialog open={inviting} onClose={() => setInviting(false)} setlist={setlist} />}
    </div>
  )
}

function inviteText(setlist: SetlistDetail) {
  return `Você foi convidado para o repertório "${setlist.name}" no Ensaio Fácil.`
}

function InviteRow({ setlist, invite }: { setlist: SetlistDetail; invite: SetlistInvite }) {
  const revoke = useRevokeInvite(setlist.id)
  const toast = useToast()
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-base font-bold tracking-widest">{invite.code}</p>
        <p className="text-xs text-muted">
          {PERMISSIONS[invite.permission]}
          {invite.email && ` · para ${invite.email}`}
          {invite.maxUses ? ` · ${invite.uses}/${invite.maxUses} usos` : ` · ${invite.uses} uso(s)`}
          {invite.expiresAt && ` · até ${expiresFmt.format(new Date(invite.expiresAt))}`}
        </p>
      </div>
      <button
        className="btn-icon size-9"
        aria-label="Copiar link do convite"
        onClick={async () => {
          await navigator.clipboard.writeText(invite.url)
          toast('Link copiado.')
        }}
      >
        <Copy className="size-4" />
      </button>
      <button
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
        aria-label="Cancelar convite"
        onClick={() => confirm('Cancelar este convite? O link deixa de funcionar.') && revoke.mutate(invite.id, { onSuccess: () => toast('Convite cancelado.') })}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}

function InviteDialog({ open, onClose, setlist }: { open: boolean; onClose: () => void; setlist: SetlistDetail }) {
  const create = useCreateInvite(setlist.id)
  const toast = useToast()
  const isOwner = setlist.role === 'owner'
  const [permission, setPermission] = useState<Permission>('view')
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<SetlistInvite | null>(null)

  const close = () => {
    setCreated(null)
    setEmail('')
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(
      { permission, email: email.trim() || null },
      {
        onSuccess: (inv) => {
          setCreated(inv as SetlistInvite)
          if (email.trim()) toast(`Convite enviado para ${email.trim()}.`)
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  const text = inviteText(setlist)
  return (
    <Sheet open={open} onClose={close} title="Convidar músicos">
      {created ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted">Envie o link ou o código. Vale por 14 dias.</p>
          <p className="rounded-2xl bg-bg py-4 font-mono text-3xl font-bold tracking-[0.3em] text-accent">{created.code}</p>
          <p className="truncate rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{created.url}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <a className="btn-primary" href={whatsappUrl(`${text}\n${created.url}`)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <button
              className="btn-ghost"
              onClick={async () => {
                const r = await shareLink(setlist.name, text, created.url)
                if (r === 'copied') toast('Link copiado.')
              }}
            >
              <Share2 className="size-4" /> Compartilhar
            </button>
            <button
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(created.url)
                toast('Link copiado.')
              }}
            >
              <Copy className="size-4" /> Copiar
            </button>
          </div>
          <button className="text-sm text-muted hover:text-text" onClick={() => setCreated(null)}>
            Gerar outro convite
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="label">O que quem entrar vai poder fazer</p>
            <div className="space-y-2">
              {(Object.keys(PERMISSIONS) as Permission[])
                .filter((p) => p !== 'admin' || isOwner)
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermission(p)}
                    aria-pressed={permission === p}
                    className={clsx(
                      'w-full rounded-xl border px-4 py-2.5 text-left text-sm',
                      permission === p ? 'border-accent bg-accent/10' : 'border-border',
                    )}
                  >
                    <b>{PERMISSIONS[p]}</b>
                    <span className="block text-xs text-muted">{PERMISSION_HINTS[p]}</span>
                  </button>
                ))}
            </div>
          </div>
          <label className="block">
            <span className="label">
              <Mail className="mr-1 inline size-3.5" /> Enviar por e-mail (opcional)
            </span>
            <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="musico@exemplo.com" />
            <span className="mt-1 block text-xs text-muted">Com e-mail, o convite vale para uma pessoa. Sem, o link serve para a banda toda.</span>
          </label>
          <button className="btn-primary w-full" disabled={create.isPending}>
            {create.isPending ? 'Gerando...' : 'Gerar convite'}
          </button>
        </form>
      )}
    </Sheet>
  )
}
