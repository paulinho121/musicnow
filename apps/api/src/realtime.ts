// Tempo real dos repertórios (Server-Sent Events).
//
// Cada aparelho com um repertório aberto mantém uma conexão SSE. O servidor guarda,
// em memória, quem está conectado em cada repertório ("sala") e o estado do Modo
// Palco (qual música o líder está tocando). A API roda num único processo na VM,
// então memória basta; se ela reiniciar, os aparelhos reconectam sozinhos e o líder
// reenvia a posição.
import { randomUUID } from 'node:crypto'

export interface StageState {
  leaderId: string
  leaderName: string
  /** Índice da música no repertório. */
  position: number
  /** Linha da seção para onde o líder mandou todos rolarem (null = topo). */
  section: number | null
  /** Sobe a cada comando, para o mesmo comando repetido (ex.: mesma seção) ser reaplicado. */
  seq: number
  /**
   * Tom que o líder escolheu em cada música durante o show (posição → tom). Vale só ao vivo:
   * o tom salvo no repertório não muda. Sem entrada = o tom do repertório.
   */
  keys: Record<string, string>
  startedAt: number
  updatedAt: number
}

export interface PresenceEntry {
  userId: string
  name: string
  following: boolean
  leading: boolean
  devices: number
}

interface Client {
  id: string
  userId: string
  name: string
  following: boolean
  send: (event: string, data: unknown) => Promise<void> | void
  close: () => void
}

interface Room {
  clients: Map<string, Client>
  stage: StageState | null
}

const rooms = new Map<string, Room>()

/** Limites para uma VM pequena: conexões por pessoa num repertório e no total. */
export const LIMITS = { perUserPerRoom: 4, total: 600 }

/** Palco sem nenhum comando há mais tempo que isso é encerrado sozinho. */
const STAGE_IDLE_MS = 3 * 60 * 60 * 1000

function room(setlistId: string) {
  let r = rooms.get(setlistId)
  if (!r) {
    r = { clients: new Map(), stage: null }
    rooms.set(setlistId, r)
  }
  return r
}

export function totalConnections() {
  let n = 0
  for (const r of rooms.values()) n += r.clients.size
  return n
}

export function connectionsOf(setlistId: string, userId: string) {
  let n = 0
  for (const c of rooms.get(setlistId)?.clients.values() ?? []) if (c.userId === userId) n++
  return n
}

export function getStage(setlistId: string): StageState | null {
  const r = rooms.get(setlistId)
  if (r?.stage && Date.now() - r.stage.updatedAt > STAGE_IDLE_MS) r.stage = null
  return r?.stage ?? null
}

export function presence(setlistId: string): PresenceEntry[] {
  const r = rooms.get(setlistId)
  if (!r) return []
  const byUser = new Map<string, PresenceEntry>()
  for (const c of r.clients.values()) {
    const e = byUser.get(c.userId) ?? { userId: c.userId, name: c.name, following: false, leading: false, devices: 0 }
    e.devices++
    e.following ||= c.following
    e.leading = r.stage?.leaderId === c.userId
    byUser.set(c.userId, e)
  }
  return [...byUser.values()].sort((a, b) => Number(b.leading) - Number(a.leading) || a.name.localeCompare(b.name))
}

/** Manda um evento para todos os aparelhos conectados ao repertório. */
export function publish(setlistId: string, event: string, data: unknown) {
  const r = rooms.get(setlistId)
  if (!r) return
  for (const c of r.clients.values()) {
    try {
      c.send(event, data)
    } catch {
      // conexão caindo: será removida no abort
    }
  }
}

function publishPresence(setlistId: string) {
  publish(setlistId, 'presence', presence(setlistId))
}

export function join(setlistId: string, user: { id: string; name: string }, send: Client['send'], close: Client['close']) {
  const r = room(setlistId)
  const client: Client = { id: randomUUID(), userId: user.id, name: user.name, following: true, send, close }
  r.clients.set(client.id, client)
  publishPresence(setlistId)
  return {
    id: client.id,
    leave() {
      r.clients.delete(client.id)
      if (!r.clients.size && !r.stage) rooms.delete(setlistId)
      else publishPresence(setlistId)
    },
  }
}

export function setFollowing(setlistId: string, clientId: string, userId: string, following: boolean) {
  const c = rooms.get(setlistId)?.clients.get(clientId)
  if (!c || c.userId !== userId) return false
  if (c.following !== following) {
    c.following = following
    publishPresence(setlistId)
  }
  return true
}

export function updateStage(
  setlistId: string,
  patch: { leaderId: string; leaderName: string; position: number; section?: number | null },
): StageState {
  const r = room(setlistId)
  const now = Date.now()
  const prev = getStage(setlistId)
  r.stage = {
    leaderId: patch.leaderId,
    leaderName: patch.leaderName,
    position: patch.position,
    section: patch.section ?? null,
    seq: (prev?.seq ?? 0) + 1,
    // Outro admin assumindo o comando continua com os tons escolhidos até ali.
    keys: prev?.keys ?? {},
    startedAt: prev && prev.leaderId === patch.leaderId ? prev.startedAt : now,
    updatedAt: now,
  }
  publish(setlistId, 'stage', r.stage)
  publishPresence(setlistId)
  return r.stage
}

/**
 * O líder mudou o tom da música (null = volta ao tom do repertório). Não sobe o `seq`:
 * quem segue troca os acordes sem a tela rolar.
 */
export function setStageKey(setlistId: string, leaderId: string, position: number, key: string | null): StageState | null {
  const stage = getStage(setlistId)
  if (!stage || stage.leaderId !== leaderId) return null
  const keys = { ...stage.keys }
  if (key) keys[String(position)] = key
  else delete keys[String(position)]
  const r = room(setlistId)
  r.stage = { ...stage, keys, updatedAt: Date.now() }
  publish(setlistId, 'stage', r.stage)
  return r.stage
}

export function stopStage(setlistId: string) {
  const r = rooms.get(setlistId)
  if (!r?.stage) return
  r.stage = null
  publish(setlistId, 'stage', null)
  publishPresence(setlistId)
  if (!r.clients.size) rooms.delete(setlistId)
}

/** O repertório mudou (músicas, tons, ordem...): os aparelhos recarregam. */
export function notifyChanged(setlistId: string, revision: number) {
  publish(setlistId, 'revision', { revision })
}

/** Repertório excluído: avisa e fecha a sala. */
export function closeRoom(setlistId: string) {
  publish(setlistId, 'deleted', {})
  rooms.delete(setlistId)
}

/** A pessoa perdeu o acesso (removida ou saiu): avisa e fecha as conexões dela neste repertório. */
export function kick(setlistId: string, userId: string) {
  const r = rooms.get(setlistId)
  if (!r) return
  for (const c of [...r.clients.values()]) {
    if (c.userId !== userId) continue
    // Fecha só depois de o aviso sair: o app precisa saber por que caiu.
    Promise.resolve()
      .then(() => c.send('removed', {}))
      .catch(() => {})
      .finally(() => c.close())
  }
}

// ---------------------------------------------------------------------------
// Monitoramento Global de Usuários Online em Tempo Real (Super Admin)

export interface GlobalOnlineUser {
  userId: string
  name: string
  email: string
  image?: string | null
  path: string
  userAgent?: string | null
  lastSeen: number
}

const onlineUsersMap = new Map<string, GlobalOnlineUser>()
const ONLINE_TTL_MS = 60 * 1000 // 60 segundos de tolerância para usuário ativo

export function recordUserPresence(info: {
  userId: string
  name: string
  email: string
  image?: string | null
  path: string
  userAgent?: string | null
}) {
  onlineUsersMap.set(info.userId, {
    ...info,
    lastSeen: Date.now(),
  })
}

export function getGlobalOnlineUsers(): GlobalOnlineUser[] {
  const now = Date.now()
  const active: GlobalOnlineUser[] = []
  for (const [id, user] of onlineUsersMap.entries()) {
    if (now - user.lastSeen > ONLINE_TTL_MS) {
      onlineUsersMap.delete(id)
    } else {
      active.push(user)
    }
  }
  return active.sort((a, b) => b.lastSeen - a.lastSeen)
}

