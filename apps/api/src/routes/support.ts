// Aba Ajuda: a pessoa conta um problema, dúvida ou sugestão; o suporte recebe por e-mail e
// responde pelo painel (a resposta aparece para ela em "Seus pedidos").
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db, schema } from '../db'
import { env } from '../env'
import { requireUser, validate, type AppEnv } from '../http'
import { sendMail } from '../mail'

const { supportTicket } = schema

export const KIND_LABEL: Record<string, string> = { problem: 'Problema', question: 'Dúvida', idea: 'Sugestão' }
/** Pedidos por pessoa por hora (um robô ou um clique repetido não lota a caixa do suporte). */
const MAX_PER_HOUR = 5

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const ticketInput = z.object({
  kind: z.enum(['problem', 'question', 'idea']),
  message: z.string().trim().min(10, 'Conte um pouco mais (pelo menos 10 letras).').max(4000),
  page: z.string().max(500).nullish(),
  release: z.string().max(60).nullish(),
})

export const supportRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .post('/', validate('json', ticketInput), async (c) => {
    const u = c.var.user
    const input = c.req.valid('json')
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(supportTicket)
      .where(and(eq(supportTicket.userId, u.id), gte(supportTicket.createdAt, sql`now() - interval '1 hour'`)))
    if (n >= MAX_PER_HOUR)
      throw new HTTPException(429, { message: 'Você já mandou vários pedidos agora. Aguarde um pouco: vamos responder.' })

    const userAgent = c.req.header('user-agent')?.slice(0, 300) ?? null
    const [t] = await db
      .insert(supportTicket)
      .values({
        userId: u.id,
        kind: input.kind,
        message: input.message,
        page: input.page ?? null,
        release: input.release ?? null,
        userAgent,
      })
      .returning()

    // Aviso para a caixa do suporte (sem esperar: o pedido já está salvo).
    const to = env.SUPPORT_INBOX ?? env.MAIL_FROM ?? env.SMTP_USER
    if (to) {
      const label = KIND_LABEL[input.kind]
      sendMail({
        to,
        subject: `[Ajuda · ${label}] ${u.name}: ${input.message.slice(0, 60)}${input.message.length > 60 ? '…' : ''}`,
        text: `${label} de ${u.name} <${u.email}>\nTela: ${input.page ?? '-'}\nVersão: ${input.release ?? '-'}\nAparelho: ${userAgent ?? '-'}\n\n${input.message}\n\nResponda pelo painel: ${env.APP_URL}/admin/suporte`,
        html: `<p><b>${esc(label)}</b> de ${esc(u.name)} &lt;${esc(u.email)}&gt;</p>
               <p style="color:#666;font-size:13px">Tela: ${esc(input.page ?? '-')}<br>Versão: ${esc(input.release ?? '-')}<br>Aparelho: ${esc(userAgent ?? '-')}</p>
               <blockquote style="border-left:3px solid #f5a524;padding-left:12px;white-space:pre-wrap">${esc(input.message)}</blockquote>
               <p><a href="${esc(env.APP_URL)}/admin/suporte">Responder pelo painel</a></p>`,
      }).catch((e) => console.error('Suporte: falha ao avisar por e-mail', e))
    }
    return c.json({ ticket: t }, 201)
  })

  // Os pedidos da própria pessoa (com a resposta do suporte).
  .get('/mine', async (c) => {
    const rows = await db
      .select({
        id: supportTicket.id,
        kind: supportTicket.kind,
        message: supportTicket.message,
        status: supportTicket.status,
        reply: supportTicket.reply,
        createdAt: supportTicket.createdAt,
        resolvedAt: supportTicket.resolvedAt,
      })
      .from(supportTicket)
      .where(eq(supportTicket.userId, c.var.user.id))
      .orderBy(desc(supportTicket.createdAt))
      .limit(20)
    return c.json({ tickets: rows })
  })
