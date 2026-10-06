// Agenda do músico: shows e cachês só da própria pessoa. Banco de desenvolvimento.
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

let ana: User, beto: User
let gigId: string, betoSetlist: string

beforeAll(async () => {
  ;[ana, beto] = await Promise.all(['ana', 'beto'].map(signUp))
  betoSetlist = (await call(beto, 'POST', '/setlists', { name: `Show do Beto ${run}` })).data.id
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('agenda', () => {
  it('anota um show com o cachê', async () => {
    const mine = (await call(ana, 'POST', '/setlists', { name: `Meu show ${run}` })).data.id
    const r = await call(ana, 'POST', '/gigs', {
      title: 'Baile no Bar do Zé',
      startsAt: '2026-10-16T23:00:00.000Z',
      location: 'Bar do Zé, Fortaleza',
      contractor: 'Zé',
      contact: '(85) 99999-0000',
      feeCents: 80000,
      setlistId: mine,
    })
    expect(r.status).toBe(201)
    gigId = r.data.id
    const list = (await call(ana, 'GET', '/gigs')).data.gigs
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Baile no Bar do Zé',
      feeCents: 80000,
      paidAt: null,
      status: 'confirmed',
      setlistName: `Meu show ${run}`,
    })
  })

  it('marca o cachê como recebido e desfaz', async () => {
    expect((await call(ana, 'PATCH', `/gigs/${gigId}/paid`, { paid: true })).data.paidAt).toBeTruthy()
    expect((await call(ana, 'GET', '/gigs')).data.gigs[0].paidAt).toBeTruthy()
    expect((await call(ana, 'PATCH', `/gigs/${gigId}/paid`, { paid: false })).data.paidAt).toBeNull()
  })

  it('ninguém vê nem mexe na agenda de outra pessoa', async () => {
    expect((await call(beto, 'GET', '/gigs')).data.gigs).toHaveLength(0)
    expect((await call(beto, 'PATCH', `/gigs/${gigId}/paid`, { paid: true })).status).toBe(404)
    expect((await call(beto, 'PUT', `/gigs/${gigId}`, { title: 'Invadido', startsAt: '2026-10-16T23:00:00Z' })).status).toBe(404)
    expect((await call(beto, 'DELETE', `/gigs/${gigId}`)).status).toBe(404)
  })

  it('não liga a um repertório de outra pessoa', async () => {
    const r = await call(ana, 'POST', '/gigs', { title: 'Show', startsAt: '2026-11-01T22:00:00Z', setlistId: betoSetlist })
    expect(r.status).toBe(400)
  })

  it('edita e exclui', async () => {
    const r = await call(ana, 'PUT', `/gigs/${gigId}`, {
      title: 'Baile (2 sets)',
      startsAt: '2026-10-16T23:00:00Z',
      feeCents: 120000,
      status: 'tentative',
    })
    expect(r.status).toBe(200)
    const g = (await call(ana, 'GET', '/gigs')).data.gigs[0]
    expect(g).toMatchObject({ title: 'Baile (2 sets)', feeCents: 120000, status: 'tentative', location: null, setlistId: null })
    expect((await call(ana, 'DELETE', `/gigs/${gigId}`)).status).toBe(204)
    expect((await call(ana, 'GET', '/gigs')).data.gigs).toHaveLength(0)
  })

  it('guarda o adiantamento e recusa adiantamento maior que o cachê', async () => {
    const ok = await call(ana, 'POST', '/gigs', { title: 'Festa', startsAt: '2026-12-05T23:00:00Z', feeCents: 80000, depositCents: 30000 })
    expect(ok.status).toBe(201)
    const g = (await call(ana, 'GET', '/gigs')).data.gigs.find((x: { id: string }) => x.id === ok.data.id)
    expect(g).toMatchObject({ feeCents: 80000, depositCents: 30000, paidAt: null })
    const bad = await call(ana, 'POST', '/gigs', { title: 'Festa', startsAt: '2026-12-05T23:00:00Z', feeCents: 80000, depositCents: 90000 })
    expect(bad.status).toBe(400)
  })
})
