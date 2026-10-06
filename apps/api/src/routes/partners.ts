import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db'
import { requireUser, validate, type AppEnv } from '../http'
import { activePartnerByCode, COMMISSION_HOLD_DAYS, isPayable, partnerStats, redeemCoupon } from '../partners'
import { allow } from './analytics'

const { partner } = schema

export const partnersRoutes = new Hono<AppEnv>()
  // Cupom válido? (tela de cadastro mostra "30 dias grátis com o cupom LUIZ"). Sem login.
  .get('/coupon/:code', validate('param', z.object({ code: z.string().max(40) })), async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
    if (!allow(`cupom:${ip}`, 30)) return c.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429)
    const p = await activePartnerByCode(c.req.valid('param').code)
    if (!p) return c.json({ error: 'Cupom não encontrado ou encerrado.' }, 404)
    return c.json({ code: p.code, name: p.name, trialDays: p.trialDays })
  })

  // Usar o cupom (logo depois do cadastro, também no login com Google).
  .post('/redeem', requireUser, validate('json', z.object({ code: z.string().min(1).max(40) })), async (c) => {
    const { partner: p, applied } = await redeemCoupon(c.var.user.id, c.req.valid('json').code)
    return c.json({ ok: true, applied, code: p.code, name: p.name, trialDays: p.trialDays })
  })

  // Painel do parceiro: o cupom, o link e os números (sem nomes de quem se cadastrou).
  .get('/me', requireUser, async (c) => {
    const [p] = await db.select().from(partner).where(eq(partner.userId, c.var.user.id))
    if (!p) return c.json({ partner: null })
    const { rows, totals } = await partnerStats(p.id)
    return c.json({
      partner: { code: p.code, name: p.name, active: p.active, commissionPercent: p.commissionPercent, trialDays: p.trialDays },
      holdDays: COMMISSION_HOLD_DAYS,
      totals,
      referrals: rows.map((r, i) => ({
        n: rows.length - i,
        createdAt: r.createdAt,
        status: isPayable(r) ? 'payable' : r.status,
        plan: r.plan,
        commissionCents: r.commissionCents,
        convertedAt: r.convertedAt,
        paidAt: r.paidAt,
      })),
    })
  })
