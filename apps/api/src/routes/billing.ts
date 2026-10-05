import { isValidCpfCnpj, onlyDigits } from '@ensaio/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { billingSummary, cancelSubscription, handleWebhook, listPayments, startCheckout, type AsaasWebhook } from '../billing'
import { env } from '../env'
import { requireUser, validate, type AppEnv } from '../http'

export const billingRoutes = new Hono<AppEnv>()
  // Aviso do Asaas: sem login, conferido pelo token configurado no painel do Asaas.
  .post('/webhook', async (c) => {
    const expected = env.ASAAS_WEBHOOK_TOKEN
    const got = c.req.header('asaas-access-token') ?? ''
    if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
      throw new HTTPException(401, { message: 'Token inválido.' })
    }
    const body = (await c.req.json().catch(() => null)) as AsaasWebhook | null
    if (!body?.event) return c.json({ ok: true, result: 'sem evento' })
    const result = await handleWebhook(body)
    if (result !== 'ignorado' && result !== 'repetido') console.log(`Asaas: ${body.event} → ${result}`)
    // Sempre 200: se o Asaas receber erro, ele para a fila de avisos.
    return c.json({ ok: true, result })
  })

  .use(requireUser)

  .get('/', async (c) => c.json(await billingSummary(c.var.user as { id: string; email: string; role?: string | null })))

  .get('/payments', async (c) => c.json(await listPayments(c.var.user.id)))

  .post(
    '/checkout',
    validate(
      'json',
      z.object({
        plan: z.enum(['monthly', 'yearly']),
        name: z.string().trim().min(3, 'Informe o nome completo (vai na nota fiscal)').max(120),
        cpfCnpj: z.string().refine(isValidCpfCnpj, 'CPF ou CNPJ inválido'),
      }),
    ),
    async (c) => {
      const { plan, name, cpfCnpj } = c.req.valid('json')
      return c.json(await startCheckout(c.var.user.id, { plan, name, cpfCnpj: onlyDigits(cpfCnpj), email: c.var.user.email }))
    },
  )

  .post('/cancel', async (c) => {
    await cancelSubscription(c.var.user.id)
    return c.json({ ok: true })
  })
