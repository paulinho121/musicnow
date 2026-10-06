// Cobrança: teste grátis, bloqueio só da criação, convidado nunca paga e os avisos do Asaas.
// Rodam contra o banco de desenvolvimento (sem falar com o Asaas) e apagam tudo no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const run = randomBytes(4).toString('hex')
const TOKEN = `tok-${run}`
process.env.BILLING_ENFORCED = 'true'
process.env.ASAAS_WEBHOOK_TOKEN = TOKEN
delete process.env.ASAAS_API_KEY

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'

type User = { name: string; cookie: string; id: string }

async function call(u: User | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(u ? { cookie: u.cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const { user } = await res.json()
  return { name, cookie, id: user.id }
}

const expireTrial = (u: User) => client`update billing_account set trial_ends_at = now() - interval '1 day' where user_id = ${u.id}`
const webhook = (body: unknown, token = TOKEN) => call(null, 'POST', '/billing/webhook', body, { 'asaas-access-token': token })
const payment = (over: Record<string, unknown>) => ({
  id: `pay_${run}`,
  customer: `cus_${run}`,
  value: 14.9,
  status: 'RECEIVED',
  dueDate: new Date().toISOString().slice(0, 10),
  billingType: 'PIX',
  invoiceUrl: 'https://exemplo',
  ...over,
})

let lider: User, musico: User
let setlistId: string, songId: string

beforeAll(async () => {
  ;[lider, musico] = await Promise.all(['lider', 'musico'].map(signUp))
})

afterAll(async () => {
  await client`delete from billing_event where id like ${'%' + run + '%'}`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('teste grátis', () => {
  it('conta nova começa com 14 dias e pode criar', async () => {
    const me = (await call(lider, 'GET', '/me')).data
    expect(me.billing).toMatchObject({ enforced: true, active: true, reason: 'trial', trialDaysLeft: 14, status: 'trialing' })
    songId = (await call(lider, 'POST', '/songs', { title: `Cobrança ${run}`, content: '[Intro] C G' })).data.id
    setlistId = (await call(lider, 'POST', '/setlists', { name: `Show ${run}` })).data.id
    expect((await call(lider, 'POST', `/setlists/${setlistId}/items`, { songId })).status).toBe(201)
    const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'mark' })
    expect((await call(musico, 'POST', `/invites/${inv.data.code}/accept`)).status).toBe(201)
  })
})

describe('teste vencido', () => {
  it('não cria nem edita (402), mas vê, toca, favorita e apaga o que é seu', async () => {
    await expireTrial(lider)
    expect((await call(lider, 'GET', '/me')).data.billing).toMatchObject({ active: false, reason: 'expired' })

    const blocked = await call(lider, 'POST', '/songs', { title: 'Nova' })
    expect(blocked.status).toBe(402)
    expect(blocked.data.error).toMatch(/teste grátis terminou/)
    expect((await call(lider, 'PUT', `/setlists/${setlistId}`, { name: 'Outro nome' })).status).toBe(402)
    expect((await call(lider, 'POST', '/setlists', { name: 'Outro' })).status).toBe(402)

    expect((await call(lider, 'GET', `/songs/${songId}`)).status).toBe(200)
    expect((await call(lider, 'GET', `/setlists/${setlistId}`)).status).toBe(200)
    expect((await call(lider, 'POST', `/songs/${songId}/favorite`)).status).toBeLessThan(300)
    const extra = await client`insert into song (owner_id, title) values (${lider.id}, ${'Apagar ' + run}) returning id`
    expect((await call(lider, 'DELETE', `/songs/${extra[0].id}`)).status).toBe(204)
  })

  it('o músico convidado toca o repertório e faz as marcações, sem pagar', async () => {
    await expireTrial(musico)
    expect((await call(musico, 'GET', `/setlists/${setlistId}`)).status).toBe(200)
    expect((await call(musico, 'GET', `/songs/${songId}?setlistId=${setlistId}`)).status).toBe(200)
    const mark = await call(musico, 'POST', `/songs/${songId}/marks`, { lineIndex: 0, type: 'nota', text: 'entrar suave', setlistId })
    expect(mark.status).toBe(201)
    // Mas não cria as próprias músicas.
    expect((await call(musico, 'POST', '/songs', { title: 'Minha' })).status).toBe(402)
  })
})

describe('avisos do Asaas', () => {
  const subId = `sub_${run}`

  it('token errado é recusado', async () => {
    expect((await webhook({ event: 'PAYMENT_RECEIVED' }, 'errado')).status).toBe(401)
  })

  it('pagamento confirmado libera na hora; aviso repetido não conta de novo', async () => {
    await client`update billing_account set asaas_subscription_id = ${subId}, asaas_customer_id = ${'cus_' + run}, plan = 'monthly' where user_id = ${lider.id}`
    const body = { id: `evt_pago_${run}`, event: 'PAYMENT_RECEIVED', payment: payment({ subscription: subId }) }
    expect((await webhook(body)).data.result).toBe('ativada')
    expect((await webhook(body)).data.result).toBe('repetido')

    const me = (await call(lider, 'GET', '/me')).data
    expect(me.billing).toMatchObject({ active: true, reason: 'subscription', status: 'active', plan: 'monthly', pending: false })
    // Período pago: ~1 mês a partir do vencimento.
    const days = (new Date(me.billing.currentPeriodEnd).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(27)
    expect(days).toBeLessThan(33)
    expect((await call(lider, 'POST', '/songs', { title: 'Agora pode' })).status).toBe(201)
  })

  it('aviso da assinatura antiga (troca de plano) não cancela a atual', async () => {
    const r = await webhook({
      id: `evt_velha_${run}`,
      event: 'SUBSCRIPTION_DELETED',
      subscription: { id: `sub_velha_${run}`, externalReference: lider.id },
    })
    expect(r.data.result).toMatch(/assinatura antiga/)
    expect((await call(lider, 'GET', '/me')).data.billing.status).toBe('active')
  })

  it('cancelar a renovação mantém o acesso até o fim do período pago', async () => {
    expect((await webhook({ id: `evt_cancel_${run}`, event: 'SUBSCRIPTION_DELETED', subscription: { id: subId } })).data.result).toBe(
      'cancelada',
    )
    expect((await call(lider, 'GET', '/me')).data.billing).toMatchObject({ status: 'canceled', active: true, reason: 'subscription' })
  })

  it('reembolso (direito de arrependimento) encerra o acesso pago', async () => {
    const r = await webhook({
      id: `evt_reemb_${run}`,
      event: 'PAYMENT_REFUNDED',
      payment: payment({ externalReference: lider.id, status: 'REFUNDED' }),
    })
    expect(r.data.result).toBe('reembolsada')
    // Sem período pago e com o teste vencido: volta a ficar só para leitura (depois da tolerância de 3 dias).
    await client`update billing_account set current_period_end = now() - interval '4 days' where user_id = ${lider.id}`
    expect((await call(lider, 'GET', '/me')).data.billing).toMatchObject({ status: 'canceled', active: false })
  })
})

describe('pagamento', () => {
  it('sem a chave do Asaas, avisa que ainda não foi configurado; CPF inválido é recusado antes', async () => {
    const ok = await call(lider, 'POST', '/billing/checkout', { plan: 'monthly', name: 'Fulano de Tal', cpfCnpj: '529.982.247-25' })
    expect(ok.status).toBe(503)
    const bad = await call(lider, 'POST', '/billing/checkout', { plan: 'monthly', name: 'Fulano de Tal', cpfCnpj: '111.111.111-11' })
    expect(bad.status).toBe(400)
  })
})
