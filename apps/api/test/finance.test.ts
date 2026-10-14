// Financeiro do show: receitas, despesas e cachês; cada músico vê só o próprio. Banco de desenvolvimento.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }
async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  return {
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
    id: (await res.json()).user.id,
  }
}
async function call(u: User, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

let lider: User, musico: User, fora: User
let setlistId: string
const now = new Date()
const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

beforeAll(async () => {
  ;[lider, musico, fora] = await Promise.all(['lider', 'musico', 'fora'].map(signUp))
  // Show no meio deste mês (12h UTC do dia 15).
  const eventDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12)).toISOString()
  setlistId = (await call(lider, 'POST', '/setlists', { name: `Casamento ${run}`, eventDate })).data.id
  const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('financeiro do show', () => {
  it('o líder lança receita, despesa e cachês; o resumo do mês soma', async () => {
    const r = await call(lider, 'POST', `/financeiro/setlist/${setlistId}`, {
      entries: [
        { kind: 'receita', description: 'Cachê do casamento', amountCents: 300000, settled: true },
        { kind: 'despesa', description: 'Som', amountCents: 50000 },
        { kind: 'cache', description: 'Baixo', amountCents: 80000, userId: musico.id },
      ],
    })
    expect(r.status).toBe(201)
    const all = await call(lider, 'GET', `/financeiro/setlist/${setlistId}`)
    expect(all.data.entries).toHaveLength(3)
    const resumo = await call(lider, 'GET', `/financeiro/resumo?mes=${mes}`)
    expect(resumo.data).toMatchObject([{ id: setlistId, receita: 300000, despesa: 50000, cache: 80000, aReceber: 0, aPagar: 130000 }])
  })

  it('o músico vê só o próprio cachê e confirma que recebeu', async () => {
    const mine = await call(musico, 'GET', `/financeiro/setlist/${setlistId}`)
    expect(mine.data.canEdit).toBe(false)
    expect(mine.data.entries).toMatchObject([{ kind: 'cache', amountCents: 80000, userId: musico.id }])
    expect((await call(musico, 'PATCH', `/financeiro/${mine.data.entries[0].id}/acerto`, { settled: true })).status).toBe(200)
    const all = await call(lider, 'GET', `/financeiro/setlist/${setlistId}`)
    const som = all.data.entries.find((e: { kind: string }) => e.kind === 'despesa')
    expect((await call(musico, 'PATCH', `/financeiro/${som.id}/acerto`, { settled: true })).status).toBe(404)
    expect((await call(musico, 'POST', `/financeiro/setlist/${setlistId}`, { entries: [{ kind: 'despesa', description: 'x', amountCents: 1 }] })).status).toBe(403)
    expect((await call(musico, 'GET', `/financeiro/resumo?mes=${mes}`)).data).toEqual([])
  })

  it('cachê só para quem é da banda; quem é de fora não vê', async () => {
    const bad = await call(lider, 'POST', `/financeiro/setlist/${setlistId}`, {
      entries: [{ kind: 'cache', description: 'x', amountCents: 1, userId: fora.id }],
    })
    expect(bad.status).toBe(403)
    expect((await call(fora, 'GET', `/financeiro/setlist/${setlistId}`)).status).toBe(404)
  })
})
