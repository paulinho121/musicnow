import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { auth, enabledProviders } from './auth'
import { client } from './db'
import { mailEnabled } from './mail'
import type { AppEnv } from './http'
import { meRoutes } from './routes/me'
import { songsRoutes } from './routes/songs'

const api = new Hono<AppEnv>()
  .get('/health', async (c) => {
    await client`select 1`
    return c.json({ ok: true })
  })
  // Informações públicas para a tela de login (quais logins sociais estão ativos).
  .get('/meta', (c) => c.json({ providers: enabledProviders, passwordReset: mailEnabled }))
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/me', meRoutes)
  .route('/songs', songsRoutes)

const KB = 1024
const tooLarge = (c: Context) => c.json({ error: 'Conteúdo grande demais para enviar de uma vez.' }, 413)

export const app = new Hono()
  .use(logger())
  .use(secureHeaders())
  // A VM tem 1 GB: recusa corpos grandes antes de ler tudo para a memória.
  // A importação em lote (até 100 cifras) tem um limite maior que o resto.
  .use('/api/songs/import', bodyLimit({ maxSize: 8 * KB * KB, onError: tooLarge }))
  .use('/api/*', async (c, next) =>
    c.req.path === '/api/songs/import' ? next() : bodyLimit({ maxSize: 1 * KB * KB, onError: tooLarge })(c, next),
  )
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
