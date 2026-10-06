// Página de pagamento do app: Pix e boleto vindos do Asaas, só para a dona da cobrança.
// As respostas do Asaas são simuladas (sem rede). Banco de desenvolvimento.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.ASAAS_API_KEY = 'chave-de-teste'
process.env.ASAAS_ENV = 'sandbox'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')
const CUSTOMER = `cus_${run}`

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
const get = async (u: User, p: string) => {
  const res = await app.request(`/api${p}`, { headers: { origin: ORIGIN, cookie: u.cookie } })
  return { status: res.status, data: await res.json() }
}

// Asaas de mentira: uma cobrança pendente da dona e uma de outra pessoa.
const payments: Record<string, object> = {
  pay_dela: {
    id: 'pay_dela',
    customer: CUSTOMER,
    value: 14.9,
    status: 'PENDING',
    dueDate: '2026-10-20',
    billingType: 'UNDEFINED',
    invoiceUrl: 'https://sandbox.asaas.com/i/x',
    bankSlipUrl: 'https://sandbox.asaas.com/b/x',
  },
  pay_outra: {
    id: 'pay_outra',
    customer: 'cus_de_outra_pessoa',
    value: 14.9,
    status: 'PENDING',
    dueDate: '2026-10-20',
    billingType: 'UNDEFINED',
    invoiceUrl: 'x',
  },
  pay_paga: {
    id: 'pay_paga',
    customer: CUSTOMER,
    value: 14.9,
    status: 'RECEIVED',
    dueDate: '2026-10-20',
    billingType: 'PIX',
    invoiceUrl: 'x',
  },
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const asaasCalls: string[] = []
vi.stubGlobal('fetch', async (input: string | URL) => {
  const url = String(input)
  asaasCalls.push(url)
  const m = /\/payments\/([^/]+)(\/(pixQrCode|identificationField))?$/.exec(url)
  if (!m || !payments[m[1]]) return json({ errors: [{ description: 'não encontrado' }] }, 404)
  if (m[3] === 'pixQrCode')
    return json({ encodedImage: 'iVBORw0KGgo=', payload: '00020126PIXDETESTE', expirationDate: '2026-10-21 23:59:59' })
  if (m[3] === 'identificationField') return json({ identificationField: '23793.38128 60000.000003 00000.000400 1 99990000001490' })
  return json(payments[m[1]])
})

let dona: User, outra: User

beforeAll(async () => {
  ;[dona, outra] = await Promise.all(['dona', 'outra'].map(signUp))
  await get(dona, '/me')
  await client`insert into billing_account (user_id, trial_ends_at, asaas_customer_id, plan)
    values (${dona.id}, now() + interval '14 days', ${CUSTOMER}, 'monthly')
    on conflict (user_id) do update set asaas_customer_id = ${CUSTOMER}, plan = 'monthly'`
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('página de pagamento do app', () => {
  it('mostra Pix (QR e copia e cola) e boleto da cobrança da própria pessoa', async () => {
    const r = await get(dona, '/billing/pay/pay_dela')
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ id: 'pay_dela', value: 14.9, paid: false, plan: 'monthly' })
    expect(r.data.pix.image).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(r.data.pix.payload).toBe('00020126PIXDETESTE')
    expect(r.data.boleto.line).toContain('23793')
    expect(asaasCalls.every((u) => u.startsWith('https://api-sandbox.asaas.com/v3/'))).toBe(true)
  })

  it('cobrança paga: avisa que já foi paga e não busca Pix', async () => {
    asaasCalls.length = 0
    const r = await get(dona, '/billing/pay/pay_paga')
    expect(r.data).toMatchObject({ paid: true, pix: null, boleto: null })
    expect(asaasCalls.some((u) => u.includes('pixQrCode'))).toBe(false)
  })

  it('ninguém vê a cobrança de outra pessoa', async () => {
    expect((await get(dona, '/billing/pay/pay_outra')).status).toBe(404)
    expect((await get(outra, '/billing/pay/pay_dela')).status).toBe(404)
    expect((await get(dona, '/billing/pay/nao-e-id')).status).toBe(400)
  })
})
