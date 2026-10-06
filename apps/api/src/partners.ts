// Programa de parceiros: músicos divulgam o app com um cupom próprio (ex.: LUIZ).
// - Quem se cadastra com o cupom ganha mais dias de teste (30 em vez de 14).
// - O parceiro ganha uma comissão ÚNICA sobre o 1º pagamento de cada indicado, liberada
//   8 dias depois (prazo do direito de arrependimento); reembolso antes disso cancela.
// - A conta do próprio parceiro não paga enquanto ele estiver ativo.
import { and, eq, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db, schema } from './db'

const { partner, partnerReferral, billingAccount, user } = schema
const DAY = 24 * 60 * 60 * 1000

/** Prazo para liberar a comissão: 7 dias de arrependimento + 1 de folga. */
export const COMMISSION_HOLD_DAYS = 8
/** Até quantos dias depois de criar a conta ainda dá para usar um cupom. */
export const COUPON_WINDOW_DAYS = 7

/** "luiz " → "LUIZ" (letras e números, 3 a 20). */
export function normalizeCode(code: string) {
  return code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}
export const isValidCode = (code: string) => /^[A-Z0-9]{3,20}$/.test(code)

export async function activePartnerByCode(code: string) {
  const c = normalizeCode(code)
  if (!isValidCode(c)) return null
  const [p] = await db
    .select()
    .from(partner)
    .where(and(eq(partner.code, c), eq(partner.active, true)))
  return p ?? null
}

/** A pessoa é parceira ativa? (acesso grátis) */
export async function isActivePartner(userId: string) {
  const [p] = await db
    .select({ id: partner.id })
    .from(partner)
    .where(and(eq(partner.userId, userId), eq(partner.active, true)))
  return Boolean(p)
}

/** Dias de teste de quem chegou por um parceiro (null = o padrão). */
export async function referralTrialDays(userId: string) {
  const [r] = await db
    .select({ days: partner.trialDays })
    .from(partnerReferral)
    .innerJoin(partner, eq(partner.id, partnerReferral.partnerId))
    .where(eq(partnerReferral.userId, userId))
  return r?.days ?? null
}

/** Usa um cupom: registra a indicação e estende o teste. Uma vez por conta, logo após o cadastro. */
export async function redeemCoupon(userId: string, code: string) {
  const p = await activePartnerByCode(code)
  if (!p) throw new HTTPException(404, { message: 'Cupom não encontrado ou encerrado.' })
  if (p.userId === userId) throw new HTTPException(400, { message: 'Você não pode usar o seu próprio cupom.' })
  const [u] = await db.select({ createdAt: user.createdAt }).from(user).where(eq(user.id, userId))
  if (!u) throw new HTTPException(401, { message: 'Faça login para continuar.' })
  const [existing] = await db.select().from(partnerReferral).where(eq(partnerReferral.userId, userId))
  if (existing) {
    if (existing.partnerId === p.id) return { partner: p, applied: false }
    throw new HTTPException(400, { message: 'Sua conta já usou um cupom.' })
  }
  const [acc] = await db.select().from(billingAccount).where(eq(billingAccount.userId, userId))
  if (acc?.currentPeriodEnd) throw new HTTPException(400, { message: 'O cupom vale só para quem ainda não assinou.' })
  if (Date.now() - u.createdAt.getTime() > COUPON_WINDOW_DAYS * DAY) {
    throw new HTTPException(400, { message: `O cupom vale para contas criadas nos últimos ${COUPON_WINDOW_DAYS} dias.` })
  }
  await db.insert(partnerReferral).values({ userId, partnerId: p.id }).onConflictDoNothing()
  // Teste estendido: conta a partir do cadastro (nunca diminui um teste já maior).
  if (acc) {
    const ends = new Date(Math.max(acc.trialEndsAt.getTime(), u.createdAt.getTime() + p.trialDays * DAY))
    await db.update(billingAccount).set({ trialEndsAt: ends, updatedAt: new Date() }).where(eq(billingAccount.userId, userId))
  }
  return { partner: p, applied: true }
}

/** 1º pagamento de um indicado: calcula a comissão (uma vez só). */
export async function recordPartnerConversion(userId: string, payment: { id: string; value: number }, plan: string | null) {
  const [r] = await db
    .select({ status: partnerReferral.status, percent: partner.commissionPercent })
    .from(partnerReferral)
    .innerJoin(partner, eq(partner.id, partnerReferral.partnerId))
    .where(eq(partnerReferral.userId, userId))
  if (!r || r.status !== 'signed') return false
  const cents = Math.round(payment.value * 100)
  await db
    .update(partnerReferral)
    .set({
      status: 'converted',
      plan,
      paymentId: payment.id,
      paymentCents: cents,
      commissionCents: Math.round((cents * r.percent) / 100),
      convertedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(partnerReferral.userId, userId), eq(partnerReferral.status, 'signed')))
  return true
}

/** Reembolso/contestação do 1º pagamento antes de pagar o parceiro: sem comissão. */
export async function cancelPartnerCommission(userId: string, paymentId: string | undefined) {
  await db
    .update(partnerReferral)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(
      and(
        eq(partnerReferral.userId, userId),
        eq(partnerReferral.status, 'converted'),
        paymentId ? eq(partnerReferral.paymentId, paymentId) : sql`true`,
      ),
    )
}

/** Comissão já pode ser paga? (passou o prazo do arrependimento) */
export const isPayable = (r: { status: string; convertedAt: Date | null }, now = Date.now()) =>
  r.status === 'converted' && Boolean(r.convertedAt) && now - r.convertedAt!.getTime() >= COMMISSION_HOLD_DAYS * DAY

/** Números de um parceiro (painel dele e do administrador). */
export async function partnerStats(partnerId: string) {
  const rows = await db
    .select({
      status: partnerReferral.status,
      plan: partnerReferral.plan,
      commissionCents: partnerReferral.commissionCents,
      convertedAt: partnerReferral.convertedAt,
      paidAt: partnerReferral.paidAt,
      createdAt: partnerReferral.createdAt,
      userId: partnerReferral.userId,
    })
    .from(partnerReferral)
    .where(eq(partnerReferral.partnerId, partnerId))
    .orderBy(sql`${partnerReferral.createdAt} desc`)
  const now = Date.now()
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((n, r) => n + (r.commissionCents ?? 0), 0)
  return {
    rows,
    totals: {
      signups: rows.length,
      customers: rows.filter((r) => ['converted', 'paid'].includes(r.status)).length,
      /** Liberada para pagar. */
      payableCents: sum((r) => isPayable(r, now)),
      /** Aguardando o prazo de 8 dias. */
      holdingCents: sum((r) => r.status === 'converted' && !isPayable(r, now)),
      paidCents: sum((r) => r.status === 'paid'),
    },
  }
}
