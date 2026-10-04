import { Hono } from 'hono'
import { z } from 'zod'
import { auth } from '../auth'
import { db, schema } from '../db'
import { validate } from '../http'
import { recordUserPresence } from '../realtime'

const visitInput = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).nullish(),
})

export const analyticsRoutes = new Hono()
  .post('/visit', validate('json', visitInput), async (c) => {
    const { path, referrer } = c.req.valid('json')
    const userAgent = c.req.header('user-agent')?.slice(0, 500) || null
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 50) || null

    // Identifica o usuário se estiver autenticado (sem bloquear a resposta)
    let userId: string | null = null
    try {
      const s = await auth.api.getSession({ headers: c.req.raw.headers })
      if (s?.user?.id) {
        userId = s.user.id
        recordUserPresence({
          userId: s.user.id,
          name: s.user.name,
          email: s.user.email,
          image: s.user.image,
          path,
          userAgent,
        })
      }
    } catch {
      // Ignora falha de autenticação em visitas anônimas
    }

    // Gravação assíncrona para responder ao cliente em < 5ms
    db.insert(schema.pageVisit)
      .values({
        path,
        referrer: referrer || null,
        userAgent,
        ip,
        userId,
      })
      .catch((err) => console.error('Erro ao registrar visita:', err))

    return c.json({ ok: true })
  })

  // Heartbeat a cada 25 segundos para manter o status online em tempo real
  .post('/heartbeat', validate('json', z.object({ path: z.string().min(1).max(500) })), async (c) => {
    const { path } = c.req.valid('json')
    const userAgent = c.req.header('user-agent')?.slice(0, 500) || null
    try {
      const s = await auth.api.getSession({ headers: c.req.raw.headers })
      if (s?.user?.id) {
        recordUserPresence({
          userId: s.user.id,
          name: s.user.name,
          email: s.user.email,
          image: s.user.image,
          path,
          userAgent,
        })
      }
    } catch {
      // silencioso
    }
    return c.json({ ok: true })
  })

