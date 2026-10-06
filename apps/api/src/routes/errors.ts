import { Hono } from 'hono'
import { z } from 'zod'
import { auth } from '../auth'
import { recordError } from '../errors'
import { validate } from '../http'
import { allow } from './analytics'

const reportInput = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).nullish(),
  url: z.string().max(1000).nullish(),
  release: z.string().max(60).nullish(),
})

/** As telas do app avisam os erros aqui (sem login obrigatório: o erro pode ser no login). */
export const errorsRoutes = new Hono().post('/', validate('json', reportInput), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
  // Acima do limite: responde ok sem gravar (um erro em loop não enche o banco).
  if (!allow(`e:${ip}`, 20)) return c.json({ ok: true })
  let userId: string | null = null
  try {
    userId = (await auth.api.getSession({ headers: c.req.raw.headers }))?.user.id ?? null
  } catch {
    // sem sessão: erro anônimo
  }
  await recordError({ source: 'web', ...body, userAgent: c.req.header('user-agent'), userId }).catch((e) =>
    console.error('Erros: falha ao gravar', e),
  )
  return c.json({ ok: true })
})
