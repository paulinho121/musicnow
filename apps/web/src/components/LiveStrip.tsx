import clsx from 'clsx'
import { Crown, Link2, Link2Off, Radio, Users, WifiOff } from 'lucide-react'
import { useState } from 'react'
import type { LiveStatus, PresenceEntry, StageState } from '../lib/live'
import { Sheet } from './Sheet'

export interface LiveControls {
  status: LiveStatus
  stage: StageState | null
  presence: PresenceEntry[]
  isLeader: boolean
  canLead: boolean
  following: boolean
  onToggleFollow: () => void
  onLead: () => void
  onStop: () => void
  onSection: (line: number) => void
}

/** Faixa do Modo Palco no topo da tela de tocar: quem comanda, quem segue, quem está online. */
export function LiveStrip({ live }: { live: LiveControls }) {
  const [open, setOpen] = useState(false)
  const followers = live.presence.filter((p) => p.following && !p.leading).length
  const online = live.presence.length

  const People = (
    <button
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-text"
      onClick={() => setOpen(true)}
      aria-label={`${online} conectados. Ver quem está online`}
    >
      <Users className="size-3.5" /> {online}
    </button>
  )

  let body
  if (live.status !== 'live') {
    body = (
      <p className="flex flex-1 items-center gap-2 text-xs text-muted">
        <WifiOff className="size-3.5" />
        {live.status === 'connecting' ? 'Conectando ao vivo...' : 'Sem conexão ao vivo: atualizando a cada 15 s'}
      </p>
    )
  } else if (live.stage && live.isLeader) {
    body = (
      <>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
          </span>
          <span className="truncate">
            <b>Você está no comando</b> · {followers} {followers === 1 ? 'seguindo' : 'seguindo'}
          </span>
        </p>
        {People}
        <button className="h-8 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-2" onClick={live.onStop}>
          Encerrar
        </button>
      </>
    )
  } else if (live.stage) {
    body = (
      <>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          <span className="relative flex size-2.5 shrink-0">
            <span className={clsx('absolute inline-flex size-full rounded-full bg-danger opacity-60', live.following && 'animate-ping')} />
            <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
          </span>
          <span className="truncate">
            <b>Ao vivo</b> · {live.stage.leaderName.split(' ')[0]} no comando
          </span>
        </p>
        {People}
        <button
          className={clsx(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold',
            live.following ? 'bg-accent text-accent-ink' : 'border border-accent text-accent',
          )}
          onClick={live.onToggleFollow}
          aria-pressed={live.following}
        >
          {live.following ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
          {live.following ? 'Seguindo' : 'Seguir'}
        </button>
        {live.canLead && (
          <button className="h-8 shrink-0 rounded-lg px-2 text-xs text-muted hover:text-text" onClick={live.onLead} title="Assumir o comando">
            <Crown className="size-3.5" />
          </button>
        )}
      </>
    )
  } else {
    body = (
      <>
        <p className="flex flex-1 items-center gap-2 text-xs text-muted">
          <Radio className="size-3.5 text-ok" /> {online > 1 ? `${online} conectados` : 'Conectado ao vivo'}
        </p>
        {online > 1 && People}
        {live.canLead && (
          <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink" onClick={live.onLead}>
            <Crown className="size-3.5" /> Comandar a banda
          </button>
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-1.5">{body}</div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quem está conectado">
        <ul className="divide-y divide-border">
          {live.presence.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {p.leading ? '👑 comandando' : p.following ? 'seguindo' : 'livre'}
                {p.devices > 1 && ` · ${p.devices} aparelhos`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          “Seguindo” muda de música junto com quem comanda. “Livre” navega por conta própria.
        </p>
      </Sheet>
    </>
  )
}
