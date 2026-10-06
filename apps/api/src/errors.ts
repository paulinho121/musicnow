// Registro de erros próprio (sem serviço externo): as telas do app e a API mandam os erros
// para cá; o mesmo erro é agrupado e só soma no contador. O administrador vê no painel.
// Não guarda IP nem o que a pessoa digitou: só mensagem, pilha, tela e navegador.
import { createHash } from 'node:crypto'
import { count, lt, sql } from 'drizzle-orm'
import { db, schema } from './db'

const { appError } = schema

/** Limite de erros diferentes guardados (protege o banco de um robô inventando erros). */
const MAX_DISTINCT = 500
export const ERROR_RETENTION_DAYS = 30

export interface ErrorReport {
  source: 'web' | 'api'
  message: string
  stack?: string | null
  url?: string | null
  userAgent?: string | null
  release?: string | null
  userId?: string | null
}

/** Mesmo erro = mesma origem, mensagem (sem números/ids) e primeira linha útil da pilha. */
export function fingerprintOf(r: Pick<ErrorReport, 'source' | 'message' | 'stack'>) {
  const msg = r.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>').replace(/\d+/g, '<n>')
  const frame =
    (r.stack ?? '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('at ') || l.includes('@'))
      // Arquivos com hash do build mudam a cada versão: o nome base basta.
      ?.replace(/-[A-Za-z0-9_]{8}\.js/g, '.js')
      .replace(/:\d+:\d+/g, '') ?? ''
  return createHash('sha256').update(`${r.source}|${msg}|${frame}`).digest('hex').slice(0, 32)
}

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null)

export async function recordError(r: ErrorReport) {
  const fingerprint = fingerprintOf(r)
  const now = new Date()
  const values = {
    source: r.source,
    fingerprint,
    message: cut(r.message, 1000) ?? 'Erro sem mensagem',
    stack: cut(r.stack, 8000),
    url: cut(r.url, 500),
    userAgent: cut(r.userAgent, 300),
    release: cut(r.release, 40),
    lastUserId: r.userId ?? null,
  }
  const updated = await db
    .update(appError)
    .set({
      count: sql`${appError.count} + 1`,
      lastSeenAt: now,
      url: values.url,
      userAgent: values.userAgent,
      release: values.release,
      lastUserId: values.lastUserId,
    })
    .where(sql`${appError.fingerprint} = ${fingerprint}`)
    .returning({ id: appError.id })
  if (updated.length) return
  const [{ n }] = await db.select({ n: count() }).from(appError)
  if (n >= MAX_DISTINCT) return
  await db
    .insert(appError)
    .values(values)
    .onConflictDoUpdate({ target: appError.fingerprint, set: { count: sql`${appError.count} + 1`, lastSeenAt: now } })
}

/** Erros que não aparecem há mais de 30 dias são apagados todo dia. */
export function startErrorRetention() {
  const purge = () =>
    db
      .delete(appError)
      .where(lt(appError.lastSeenAt, sql`now() - make_interval(days => ${ERROR_RETENTION_DAYS})`))
      .catch((e) => console.error('Erros: falha na limpeza', e))
  setTimeout(purge, 90_000).unref()
  setInterval(purge, 24 * 60 * 60 * 1000).unref()
}
