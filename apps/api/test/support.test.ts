// Aba Ajuda: pedir ajuda, ver os próprios pedidos, limite por hora e resposta do suporte.
// Banco de desenvolvimento (sem mandar e-mail de verdade nos testes).
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const run = randomBytes(4).toString('hex')
const DOMAIN = 'teste.ensaiofacil.app'
process.env.ADMIN_EMAILS = `suporte-${run}@${DOMAIN}`

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const ORIGIN = process.env.APP_URL!

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
  return { status: res.status, data: await res.json().catch(() => null) }
}

let musico: User, outro: User, suporte: User

beforeAll(async () => {
  ;[musico, outro, suporte] = await Promise.all(['musico', 'outro', 'suporte'].map(signUp))
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('ajuda', () => {
  let ticketId: string

  it('manda um problema com a tela de onde veio', async () => {
    const r = await call(musico, 'POST', '/support', {
      kind: 'problem',
      message: `O Modo Palco travou na música 3 ${run}`,
      page: '/repertorios/x/tocar/3',
      release: 'abc1234',
    })
    expect(r.status).toBe(201)
    ticketId = r.data.ticket.id
    expect(r.data.ticket).toMatchObject({ kind: 'problem', status: 'open', page: '/repertorios/x/tocar/3' })
  })

  it('recusa mensagem curta demais', async () => {
    expect((await call(musico, 'POST', '/support', { kind: 'idea', message: 'oi' })).status).toBe(400)
  })

  it('cada um vê só os próprios pedidos', async () => {
    expect((await call(musico, 'GET', '/support/mine')).data.tickets).toHaveLength(1)
    expect((await call(outro, 'GET', '/support/mine')).data.tickets).toHaveLength(0)
  })

  it('o suporte vê, responde e resolve; a pessoa vê a resposta', async () => {
    expect((await call(musico, 'GET', '/admin/support')).status).toBe(403)
    const list = (await call(suporte, 'GET', '/admin/support')).data.tickets
    expect(list.some((t: { id: string }) => t.id === ticketId)).toBe(true)
    const r = await call(suporte, 'PATCH', `/admin/support/${ticketId}`, { status: 'resolved', reply: 'Corrigimos, atualize o app.' })
    expect(r.status).toBe(200)
    const mine = (await call(musico, 'GET', '/support/mine')).data.tickets[0]
    expect(mine).toMatchObject({ status: 'resolved', reply: 'Corrigimos, atualize o app.' })
  })

  it('no máximo 5 pedidos por hora', async () => {
    for (let i = 0; i < 4; i++)
      expect((await call(outro, 'POST', '/support', { kind: 'question', message: `Dúvida número ${i} ${run}` })).status).toBe(201)
    expect((await call(outro, 'POST', '/support', { kind: 'question', message: `Mais uma dúvida ${run}` })).status).toBe(201)
    expect((await call(outro, 'POST', '/support', { kind: 'question', message: `Passou do limite ${run}` })).status).toBe(429)
  })
})
