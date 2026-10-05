import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import type { ValidationTargets } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'
import { auth, type Session } from './auth'
import { db, schema } from './db'
import { env } from './env'

/** zValidator com erro legível: `{ error: "Informe o título" }` em vez do objeto do Zod. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.join('.')
      const message = issue?.message ?? 'Dados inválidos.'
      return c.json({ error: field ? `${message} (${field})` : message, field }, 400)
    }
  })
}

export type AppEnv = {
  Variables: {
    user: Session['user']
    session: Session['session']
  }
}

/**
 * Bloqueio na hora: a sessão pode vir do cache do cookie (até 5 min), então o
 * bloqueio é conferido no banco a cada requisição (uma consulta pela chave, ~1 ms).
 */
async function assertNotBanned(userId: string) {
  const [u] = await db
    .select({ banned: schema.user.banned, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  // 401: o app sai da conta e volta para a tela de entrada, que mostra o motivo.
  if (!u || u.banned) throw new HTTPException(401, { message: 'Esta conta está bloqueada.' })
  return u
}

/** Exige sessão válida e expõe `c.var.user`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!s) throw new HTTPException(401, { message: 'Faça login para continuar.' })
  await assertNotBanned(s.user.id)
  c.set('user', s.user)
  c.set('session', s.session)
  await next()
})

export function isAdminUser(u?: { email?: string | null; role?: string | null } | null): boolean {
  if (!u || !u.email) return false
  const email = u.email.trim().toLowerCase()
  if (env.ADMIN_EMAILS.includes(email)) return true
  if (u.role === 'admin') return true
  return false
}

/** Exige sessão de Super Administrador. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!s) throw new HTTPException(401, { message: 'Faça login para continuar.' })
  // Papel lido do banco (a sessão em cache poderia estar com o papel antigo).
  const fresh = await assertNotBanned(s.user.id)
  c.set('user', s.user)
  c.set('session', s.session)
  if (!isAdminUser({ email: s.user.email, role: fresh.role })) {
    throw new HTTPException(403, { message: 'Acesso restrito a Super Administradores.' })
  }
  await next()
})

export function notFound(what = 'Registro'): never {
  throw new HTTPException(404, { message: `${what} não encontrado.` })
}

export function forbidden(message = 'Você não tem permissão para isso.'): never {
  throw new HTTPException(403, { message })
}
