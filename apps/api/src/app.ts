import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { auth, enabledProviders } from './auth'
import { client } from './db'
import type { AppEnv } from './http'
import { meRoutes } from './routes/me'
import { songsRoutes } from './routes/songs'

const api = new Hono<AppEnv>()
  .get('/health', async (c) => {
    await client`select 1`
    return c.json({ ok: true })
  })
  // Informações públicas para a tela de login (quais logins sociais estão ativos).
  .get('/meta', (c) => c.json({ providers: enabledProviders }))
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/me', meRoutes)
  .route('/songs', songsRoutes)

export const app = new Hono()
  .use(logger())
  .use(secureHeaders())
  .route('/api', api)

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Erro interno. Tente novamente em instantes.' }, 500)
})

export type ApiRoutes = typeof api
