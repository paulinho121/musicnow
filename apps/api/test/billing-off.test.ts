// Antes de ligar a cobrança: tudo liberado e NADA gravado (o teste de 14 dias só começa
// quando a cobrança for ligada, senão no lançamento todo mundo já estaria vencido).
import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

process.env.BILLING_ENFORCED = 'false'
const run = randomBytes(4).toString('hex')
const { app } = await import('../src/app')
const { client } = await import('../src/db')
const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('cobrança desligada', () => {
  it('conta nova: tudo liberado, sem contar dias de teste', async () => {
    const res = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'antes', email: `antes-${run}@${DOMAIN}`, password: `senha-${run}-antes` }),
    })
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    const { user } = await res.json()
    const me = await (await app.request('/api/me', { headers: { origin: ORIGIN, cookie } })).json()
    expect(me.billing).toMatchObject({ enforced: false, active: true, reason: 'free' })
    const created = await app.request('/api/songs', {
      method: 'POST',
      headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Livre' }),
    })
    expect(created.status).toBe(201)
    expect(await client`select 1 from billing_account where user_id = ${user.id}`).toHaveLength(0)
  })
})
