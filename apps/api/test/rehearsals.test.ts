// Ensaio no estúdio: custo dividido entre os músicos e quem já acertou. Banco de desenvolvimento.
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

beforeAll(async () => {
  ;[lider, musico, fora] = await Promise.all(['lider', 'musico', 'fora'].map(signUp))
  setlistId = (await call(lider, 'POST', '/setlists', { name: `Banda ${run}` })).data.id
  const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

const startsAt = new Date(Date.now() + 3 * 86400_000).toISOString()

describe('ensaio no estúdio', () => {
  let rid: string
  it('divide o custo entre a banda; quem pagou o estúdio já está quite', async () => {
    const r = await call(lider, 'POST', `/ensaios/setlist/${setlistId}`, {
      startsAt,
      studioName: `Estúdio ${run}`,
      room: 'Sala 2',
      costCents: 12001,
      paidBy: lider.id,
    })
    expect(r.status).toBe(201)
    rid = r.data.id
    const list = await call(musico, 'GET', `/ensaios/setlist/${setlistId}`)
    expect(list.data.canEdit).toBe(false)
    const shares = list.data.rehearsals[0].shares
    expect(shares.map((s: { amountCents: number }) => s.amountCents).sort()).toEqual([6000, 6001])
    expect(shares.find((s: { userId: string }) => s.userId === lider.id).paidAt).not.toBeNull()
    expect(shares.find((s: { userId: string }) => s.userId === musico.id).paidAt).toBeNull()
  })

  it('o músico marca a própria parte; não marca a de outro nem cria ensaio', async () => {
    expect((await call(musico, 'PATCH', `/ensaios/${rid}/partes/${musico.id}`, { paid: true })).status).toBe(200)
    expect((await call(musico, 'PATCH', `/ensaios/${rid}/partes/${lider.id}`, { paid: false })).status).toBe(403)
    expect((await call(musico, 'POST', `/ensaios/setlist/${setlistId}`, { startsAt })).status).toBe(403)
    const mine = await call(musico, 'GET', '/ensaios/meus')
    expect(mine.data).toMatchObject([{ id: rid, studioName: `Estúdio ${run}`, amountCents: expect.any(Number) }])
    expect(mine.data[0].paidAt).not.toBeNull()
  })

  it('mudar o valor refaz a divisão sem perder quem já acertou; estúdio fica salvo', async () => {
    await call(lider, 'PUT', `/ensaios/${rid}`, { startsAt, studioName: `Estúdio ${run}`, costCents: 10000, paidBy: lider.id })
    const list = await call(lider, 'GET', `/ensaios/setlist/${setlistId}`)
    const shares = list.data.rehearsals[0].shares
    expect(shares.every((s: { amountCents: number; paidAt: string | null }) => s.amountCents === 5000 && s.paidAt)).toBe(true)
    const studios = await call(musico, 'GET', '/ensaios/estudios')
    expect(studios.data.some((s: { studioName: string }) => s.studioName === `Estúdio ${run}`)).toBe(true)
  })

  it('quem é de fora não vê nem mexe', async () => {
    expect((await call(fora, 'GET', `/ensaios/setlist/${setlistId}`)).status).toBe(404)
    expect((await call(fora, 'PATCH', `/ensaios/${rid}/partes/${fora.id}`, { paid: true })).status).toBe(404)
    expect((await call(fora, 'GET', '/ensaios/meus')).data).toEqual([])
    expect((await call(fora, 'DELETE', `/ensaios/${rid}`)).status).toBe(404)
  })
})
