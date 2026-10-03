// Tempo real e Modo Palco: conexões SSE de verdade contra a API (banco de desenvolvimento).
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { name: string; cookie: string; id: string }

async function call(u: User, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-rt-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { name, cookie, id: (await res.json()).user.id }
}

/** Abre a conexão ao vivo e deixa esperar por eventos específicos. */
async function listen(u: User, setlistId: string) {
  const res = await app.request(`/api/setlists/${setlistId}/events`, { headers: { cookie: u.cookie } })
  if (res.status !== 200) return { status: res.status, events: [], waitFor: async () => null, close: async () => {} }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const events: { event: string; data: any }[] = []
  let buffer = ''
  let ended = false
  const pump = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let i: number
        while ((i = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, i)
          buffer = buffer.slice(i + 2)
          const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
          const data = /^data: (.*)$/m.exec(block)?.[1]
          events.push({ event, data: data ? JSON.parse(data) : null })
        }
      }
    } catch {
      // conexão cancelada pelo teste
    }
    ended = true
  })()
  return {
    status: res.status,
    events,
    get ended() {
      return ended
    },
    async waitFor(event: string, pred: (d: any) => boolean = () => true, ms = 5000) {
      const start = Date.now()
      while (Date.now() - start < ms) {
        const hit = events.find((e) => e.event === event && pred(e.data))
        if (hit) return hit.data
        await new Promise((r) => setTimeout(r, 25))
      }
      return null
    },
    async close() {
      await reader.cancel().catch(() => {})
      await pump
    },
  }
}

let lider: User, musico: User, estranho: User
let setlistId: string, itemIds: string[]

beforeAll(async () => {
  ;[lider, musico, estranho] = await Promise.all(['lider', 'musico', 'estranho'].map(signUp))
  const songs = await Promise.all(
    ['Primeira', 'Segunda'].map((t) =>
      call(lider, 'POST', '/songs', { title: `${t} ${run}`, content: '[Refrão]\nC G\nletra', lyricsAuthorized: true }),
    ),
  )
  setlistId = (await call(lider, 'POST', '/setlists', { name: `Palco ${run}` })).data.id
  itemIds = []
  for (const s of songs) itemIds.push((await call(lider, 'POST', `/setlists/${setlistId}/items`, { songId: s.data.id })).data.id)
  const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-rt-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('conexão ao vivo', () => {
  it('quem não participa não consegue escutar', async () => {
    const s = await listen(estranho, setlistId)
    expect(s.status).toBe(404)
  })

  it('ao conectar recebe a revisão e quem está online', async () => {
    const s = await listen(musico, setlistId)
    const hello = await s.waitFor('hello')
    expect(hello).toMatchObject({ stage: null })
    expect(typeof hello.clientId).toBe('string')
    expect(hello.presence.map((p: any) => p.userId)).toContain(musico.id)
    await s.close()
  })
})

describe('Modo Palco', () => {
  it('o líder comanda e quem está seguindo recebe a música e a seção', async () => {
    const s = await listen(musico, setlistId)
    await s.waitFor('hello')
    expect((await call(lider, 'POST', `/setlists/${setlistId}/stage`, { action: 'go', position: 1 })).status).toBe(200)
    expect(await s.waitFor('stage', (d) => d?.position === 1)).toMatchObject({ leaderId: lider.id, section: null })
    await call(lider, 'POST', `/setlists/${setlistId}/stage`, { action: 'go', position: 1, section: 0 })
    const sec = await s.waitFor('stage', (d) => d?.section === 0)
    expect(sec.seq).toBeGreaterThan(1)
    // Quem entra depois já recebe o palco em andamento.
    const tarde = await listen(musico, setlistId)
    expect((await tarde.waitFor('hello')).stage).toMatchObject({ position: 1 })
    await tarde.close()
    await s.close()
  })

  it('quem só visualiza não comanda; posição inválida é recusada', async () => {
    expect((await call(musico, 'POST', `/setlists/${setlistId}/stage`, { action: 'go', position: 0 })).status).toBe(403)
    expect((await call(lider, 'POST', `/setlists/${setlistId}/stage`, { action: 'go', position: 99 })).status).toBe(400)
  })

  it('"seguir" aparece na presença e só a própria pessoa muda o seu', async () => {
    const s = await listen(musico, setlistId)
    const { clientId } = await s.waitFor('hello')
    expect((await call(lider, 'POST', `/setlists/${setlistId}/presence`, { clientId, following: false })).status).toBe(404)
    expect((await call(musico, 'POST', `/setlists/${setlistId}/presence`, { clientId, following: false })).status).toBe(200)
    const p = await s.waitFor('presence', (list) => list.some((e: any) => e.userId === musico.id && !e.following))
    expect(p).not.toBeNull()
    await s.close()
  })

  it('encerrar o palco avisa todos', async () => {
    const s = await listen(musico, setlistId)
    await s.waitFor('hello')
    await call(lider, 'POST', `/setlists/${setlistId}/stage`, { action: 'stop' })
    for (let i = 0; i < 80 && !s.events.some((e) => e.event === 'stage' && e.data === null); i++) {
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(s.events.some((e) => e.event === 'stage' && e.data === null)).toBe(true)
    await s.close()
  })
})

describe('alterações chegam na hora', () => {
  it('trocar o tom avisa a banda com a nova revisão', async () => {
    const s = await listen(musico, setlistId)
    const { revision } = await s.waitFor('hello')
    await call(lider, 'PUT', `/setlists/${setlistId}/items/${itemIds[0]}`, { key: 'D' })
    const r = await s.waitFor('revision', (d) => d.revision > revision)
    expect(r.revision).toBeGreaterThan(revision)
    await s.close()
  })

  it('quem é removido é desconectado na hora', async () => {
    const s = await listen(musico, setlistId)
    await s.waitFor('hello')
    await call(lider, 'DELETE', `/setlists/${setlistId}/members/${musico.id}`)
    expect(await s.waitFor('removed')).not.toBeNull()
    for (let i = 0; i < 40 && !s.ended; i++) await new Promise((r) => setTimeout(r, 25))
    expect(s.ended).toBe(true)
    expect((await listen(musico, setlistId)).status).toBe(404)
  })
})
