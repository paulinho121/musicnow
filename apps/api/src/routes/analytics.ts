import { createHash } from 'node:crypto'
import { lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { auth } from '../auth'
import { db, schema } from '../db'
import { validate } from '../http'
import { recordUserPresence } from '../realtime'
import { env } from '../env'

// ---------------------------------------------------------------- proteção

/** Limite simples por chave (IP), em memória: rota sem login não pode encher o banco. */
const hits = new Map<string, { n: number; reset: number }>()
function allow(key: string, max: number, windowMs = 60_000) {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + windowMs })
    return true
  }
  h.n++
  return h.n <= max
}
setInterval(() => {
  const now = Date.now()
  for (const [k, h] of hits) if (now > h.reset) hits.delete(k)
}, 5 * 60_000).unref()

/**
 * LGPD: não guardamos o IP. Guardamos uma "impressão" irreversível dele (com a chave
 * secreta do servidor), que ainda permite contar visitantes únicos.
 */
const ipFingerprint = (ip: string | null) =>
  ip ? createHash('sha256').update(`${env.BETTER_AUTH_SECRET}|${ip}`).digest('hex').slice(0, 24) : null

/** Visitas com mais de 90 dias são apagadas todo dia. */
export const VISIT_RETENTION_DAYS = 90
export function startVisitRetention() {
  const purge = () =>
    db
      .delete(schema.pageVisit)
      .where(lt(schema.pageVisit.createdAt, sql`now() - make_interval(days => ${VISIT_RETENTION_DAYS})`))
      .catch((e) => console.error('Visitas: falha na limpeza', e))
  setTimeout(purge, 60_000)
  setInterval(purge, 24 * 60 * 60 * 1000).unref()
}

const visitInput = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).nullish(),
})

export const analyticsRoutes = new Hono()
  .post('/visit', validate('json', visitInput), async (c) => {
    const { path, referrer } = c.req.valid('json')
    const userAgent = c.req.header('user-agent')?.slice(0, 500) || null
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 50) || null
    // Acima do limite: responde ok, mas não grava (não vale a pena dar pista a robôs).
    if (!allow(`v:${ip ?? 'sem-ip'}`, 30)) return c.json({ ok: true })

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
        ip: ipFingerprint(ip),
        userId,
      })
      .catch((err) => console.error('Erro ao registrar visita:', err))

    return c.json({ ok: true })
  })

  // Heartbeat a cada 25 segundos para manter o status online em tempo real
  .post('/heartbeat', validate('json', z.object({ path: z.string().min(1).max(500) })), async (c) => {
    const { path } = c.req.valid('json')
    const userAgent = c.req.header('user-agent')?.slice(0, 500) || null
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
    if (!allow(`h:${ip}`, 6)) return c.json({ ok: true })
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

