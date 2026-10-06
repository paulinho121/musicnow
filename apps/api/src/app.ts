import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { auth, enabledProviders } from './auth'
import { client } from './db'
import { mailEnabled } from './mail'
import type { AppEnv } from './http'
import { billingRoutes } from './routes/billing'
import { catalogRoutes } from './routes/catalog'
import { heroRoutes } from './routes/hero'
import { meRoutes } from './routes/me'
import { scoresRoutes } from './routes/scores'
import { invitesRoutes, setlistsRoutes } from './routes/setlists'
import { sharedSongRoutes, songsRoutes } from './routes/songs'
import { analyticsRoutes } from './routes/analytics'
import { errorsRoutes } from './routes/errors'
import { ogRoutes } from './routes/og'
import { partnersRoutes } from './routes/partners'
import { recordError } from './errors'
import { adminRoutes } from './routes/admin'

const api = new Hono<AppEnv>()
  .get('/health', async (c) => {
    await client`select 1`
    return c.json({ ok: true })
  })
  // Informações públicas para a tela de login (quais logins sociais estão ativos).
  .get('/meta', (c) => c.json({ providers: enabledProviders, passwordReset: mailEnabled }))
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/me/hero', heroRoutes)
  .route('/me', meRoutes)
  .route('/songs', songsRoutes)
  .route('/shared', sharedSongRoutes)
  .route('/setlists', setlistsRoutes)
  .route('/invites', invitesRoutes)
  .route('/catalog', catalogRoutes)
  .route('/scores', scoresRoutes)
  .route('/billing', billingRoutes)
  .route('/analytics', analyticsRoutes)
  .route('/errors', errorsRoutes)
  .route('/partners', partnersRoutes)
  .route('/og', ogRoutes)
  .route('/admin', adminRoutes)

const KB = 1024
const tooLarge = (c: Context) => c.json({ error: 'Conteúdo grande demais para enviar de uma vez.' }, 413)

export const app = new Hono()
  .use(logger())
  .use(secureHeaders())
  // A VM tem 1 GB: recusa corpos grandes antes de ler tudo para a memória.
  // A importação em lote (até 100 cifras) tem um limite maior que o resto.
  .use('/api/songs/import', bodyLimit({ maxSize: 8 * KB * KB, onError: tooLarge }))
  // Partitura: páginas já comprimidas no aparelho (até 30 páginas, ~16 MB no máximo).
  .use('/api/scores', bodyLimit({ maxSize: 16 * KB * KB, onError: tooLarge }))
  // Imagem do destaque do início (já reduzida no aparelho).
  .use('/api/me/hero', bodyLimit({ maxSize: 2 * KB * KB, onError: tooLarge }))
  .use('/api/*', async (c, next) =>
    c.req.path === '/api/songs/import' || c.req.path === '/api/scores' || c.req.path === '/api/me/hero'
      ? next()
      : bodyLimit({ maxSize: 1 * KB * KB, onError: tooLarge })(c, next),
  )
  .route('/api', api)

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error(err)
  // Erro inesperado: vai para o painel do administrador (rota sem ids, para agrupar).
  recordError({
    source: 'api',
    message: `${c.req.method} ${c.req.routePath}: ${err.message}`,
    stack: err.stack,
    url: c.req.path,
    userAgent: c.req.header('user-agent'),
    release: process.env.RELEASE ?? null,
    userId: (c.var as { user?: { id: string } }).user?.id ?? null,
  }).catch(() => {})
  return c.json({ error: 'Erro interno. Tente novamente em instantes.' }, 500)
})

export type ApiRoutes = typeof api
