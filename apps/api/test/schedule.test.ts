// Escala de músicos e datas indisponíveis. Banco de desenvolvimento; e-mail não sai (sem SMTP).
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
// Culto daqui a 10 dias, às 19h de Brasília.
const day = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10)
const eventDate = `${day}T22:00:00.000Z`

beforeAll(async () => {
  ;[lider, musico, fora] = await Promise.all(['lider', 'musico', 'fora'].map(signUp))
  setlistId = (await call(lider, 'POST', '/setlists', { name: `Culto ${run}`, eventDate })).data.id
  const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('escala', () => {
  it('quem administra escala; a data indisponível aparece para ele', async () => {
    await call(musico, 'POST', '/escala/indisponivel', { startsOn: day, endsOn: day, note: 'Viagem' })
    const before = await call(lider, 'GET', `/escala/setlist/${setlistId}`)
    expect(before.data.canEdit).toBe(true)
    const m = before.data.people.find((p: { userId: string }) => p.userId === musico.id)
    expect(m.unavailable).toBe('Viagem')
    expect(before.data.people.some((p: { userId: string }) => p.userId === lider.id)).toBe(true)

    expect((await call(lider, 'PUT', `/escala/setlist/${setlistId}/${musico.id}`, { instrument: 'baixo' })).status).toBe(200)
    const after = await call(lider, 'GET', `/escala/setlist/${setlistId}`)
    expect(after.data.assignments).toMatchObject([{ userId: musico.id, instrument: 'baixo', status: 'pendente' }])
  })

  it('o músico vê a escala e responde; quem só vê não escala nem enxerga a agenda alheia', async () => {
    const mine = await call(musico, 'GET', '/escala/minhas')
    expect(mine.data).toMatchObject([{ setlistId, status: 'pendente', instrument: 'baixo' }])
    expect((await call(musico, 'POST', `/escala/setlist/${setlistId}/responder`, { status: 'recusado', note: 'Viajando' })).status).toBe(200)
    const view = await call(musico, 'GET', `/escala/setlist/${setlistId}`)
    expect(view.data.canEdit).toBe(false)
    expect(view.data.people).toEqual([])
    expect(view.data.assignments[0]).toMatchObject({ status: 'recusado', note: 'Viajando' })
    expect((await call(musico, 'PUT', `/escala/setlist/${setlistId}/${lider.id}`, {})).status).toBe(403)
  })

  it('não escala quem não participa; quem é de fora nem vê o repertório', async () => {
    expect((await call(lider, 'PUT', `/escala/setlist/${setlistId}/${fora.id}`, {})).status).toBe(403)
    expect((await call(fora, 'GET', `/escala/setlist/${setlistId}`)).status).toBe(404)
    expect((await call(fora, 'POST', `/escala/setlist/${setlistId}/responder`, { status: 'confirmado' })).status).toBe(404)
  })

  it('indisponibilidade: lista só a própria e apaga', async () => {
    const list = await call(musico, 'GET', '/escala/indisponivel')
    expect(list.data).toHaveLength(1)
    expect((await call(fora, 'GET', '/escala/indisponivel')).data).toEqual([])
    const bad = await call(musico, 'POST', '/escala/indisponivel', { startsOn: day, endsOn: '2000-01-01' })
    expect(bad.status).toBe(400)
    await call(musico, 'DELETE', `/escala/indisponivel/${list.data[0].id}`)
    expect((await call(musico, 'GET', '/escala/indisponivel')).data).toEqual([])
  })
})
