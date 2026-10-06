// Programa de parceiros: cupom com mais dias de teste, comissão única no 1º pagamento,
// liberada depois de 8 dias e cancelada em caso de reembolso; parceiro não paga.
// Rodam contra o banco de desenvolvimento (cobrança ligada, sem falar com o Asaas).
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TOKEN = 'token-de-teste-parceiros'
process.env.BILLING_ENFORCED = 'true'
process.env.ASAAS_WEBHOOK_TOKEN = TOKEN
delete process.env.ASAAS_API_KEY

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')
const CODE = `TESTE${run.toUpperCase()}`.slice(0, 20)

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
  return { name, cookie, id: (await res.json()).user.id }
}

const webhook = (event: string, userId: string, value: number, id = `pay_${run}_${event}`) =>
  call(
    null,
    'POST',
    '/billing/webhook',
    {
      id: `evt_${id}_${event}`,
      event,
      payment: {
        id,
        customer: `cus_${run}`,
        value,
        status: 'RECEIVED',
        dueDate: new Date().toISOString().slice(0, 10),
        billingType: 'PIX',
        invoiceUrl: 'https://exemplo',
        externalReference: userId,
      },
    },
    { 'asaas-access-token': TOKEN },
  )

const referral = async (userId: string) => (await client`select * from partner_referral where user_id = ${userId}`)[0]
const daysOfTrial = async (u: User) => {
  const [a] =
    await client`select trial_ends_at, (select created_at from "user" where id = ${u.id}) as created from billing_account where user_id = ${u.id}`
  return Math.round((new Date(a.trial_ends_at).getTime() - new Date(a.created).getTime()) / 86_400_000)
}

let parceiro: User, fa: User, outro: User
let partnerId: string

beforeAll(async () => {
  ;[parceiro, fa, outro] = await Promise.all(['parceiro', 'fa', 'outro'].map(signUp))
  // Primeiro acesso cria a conta de cobrança com o teste padrão de 14 dias.
  await Promise.all([fa, outro].map((u) => call(u, 'GET', '/me')))
  ;[{ id: partnerId }] = await client`
    insert into partner (code, name, user_id, commission_percent, trial_days)
    values (${CODE}, 'Parceiro Teste', ${parceiro.id}, 50, 30) returning id`
})

afterAll(async () => {
  await client`delete from billing_event where id like ${'%' + run + '%'}`
  await client`delete from partner where code = ${CODE}`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('parceiros', () => {
  it('consulta o cupom sem login (aceita minúsculas e espaços)', async () => {
    const r = await call(null, 'GET', `/partners/coupon/${encodeURIComponent(' ' + CODE.toLowerCase() + ' ')}`)
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ code: CODE, trialDays: 30 })
    expect((await call(null, 'GET', '/partners/coupon/NAOEXISTE123')).status).toBe(404)
  })

  it('usar o cupom estende o teste para 30 dias, uma vez só', async () => {
    expect(await daysOfTrial(fa)).toBe(14)
    const r = await call(fa, 'POST', '/partners/redeem', { code: CODE })
    expect(r.status).toBe(200)
    expect(r.data.applied).toBe(true)
    expect(await daysOfTrial(fa)).toBe(30)
    expect((await call(fa, 'POST', '/partners/redeem', { code: CODE })).data.applied).toBe(false)
    expect((await referral(fa.id)).status).toBe('signed')
  })

  it('o parceiro não usa o próprio cupom e tem acesso grátis', async () => {
    expect((await call(parceiro, 'POST', '/partners/redeem', { code: CODE })).status).toBe(400)
    const me = (await call(parceiro, 'GET', '/me')).data
    expect(me.billing.reason).toBe('partner')
    expect(me.billing.active).toBe(true)
  })

  it('1º pagamento gera a comissão de 50%; os seguintes não', async () => {
    expect((await webhook('PAYMENT_RECEIVED', fa.id, 149)).status).toBe(200)
    const r = await referral(fa.id)
    expect(r.status).toBe('converted')
    expect(r.payment_cents).toBe(14900)
    expect(r.commission_cents).toBe(7450)
    // Renovação: não muda a comissão.
    await webhook('PAYMENT_CONFIRMED', fa.id, 149, `pay_${run}_renovacao`)
    expect((await referral(fa.id)).commission_cents).toBe(7450)
  })

  it('painel do parceiro: aguardando 8 dias, depois liberada; sem nomes', async () => {
    let d = (await call(parceiro, 'GET', '/partners/me')).data
    expect(d.partner.code).toBe(CODE)
    expect(d.totals).toMatchObject({ signups: 1, customers: 1, holdingCents: 7450, payableCents: 0 })
    expect(JSON.stringify(d.referrals)).not.toContain('fa-')
    await client`update partner_referral set converted_at = now() - interval '9 days' where user_id = ${fa.id}`
    d = (await call(parceiro, 'GET', '/partners/me')).data
    expect(d.totals).toMatchObject({ holdingCents: 0, payableCents: 7450 })
    expect(d.referrals[0].status).toBe('payable')
  })

  it('reembolso antes de pagar o parceiro cancela a comissão', async () => {
    await call(outro, 'POST', '/partners/redeem', { code: CODE })
    await webhook('PAYMENT_RECEIVED', outro.id, 14.9, `pay_${run}_outro`)
    expect((await referral(outro.id)).commission_cents).toBe(745)
    await call(
      null,
      'POST',
      '/billing/webhook',
      {
        id: `evt_${run}_refund`,
        event: 'PAYMENT_REFUNDED',
        payment: {
          id: `pay_${run}_outro`,
          customer: `cus_${run}`,
          value: 14.9,
          status: 'REFUNDED',
          dueDate: new Date().toISOString().slice(0, 10),
          billingType: 'PIX',
          invoiceUrl: 'x',
          externalReference: outro.id,
        },
      },
      { 'asaas-access-token': TOKEN },
    )
    expect((await referral(outro.id)).status).toBe('canceled')
  })

  it('só o administrador vê e gerencia os parceiros', async () => {
    expect((await call(fa, 'GET', '/admin/partners')).status).toBe(403)
    expect((await call(fa, 'POST', `/admin/referrals/${fa.id}/paid`)).status).toBe(403)
    expect(partnerId).toBeTruthy()
  })
})
