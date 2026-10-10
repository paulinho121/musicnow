// Cobrança: quem cria conteúdo assina (R$ 14,90/mês ou R$ 149/ano); quem só toca os
// repertórios dos outros nunca paga. Todo mundo começa com 14 dias de teste.
//
// Pagamento pelo Asaas: a pessoa paga na página de cobrança do próprio Asaas (Pix, cartão
// ou boleto) — o app nunca vê dados de cartão. O Asaas avisa o servidor (webhook) quando o
// pagamento entra, atrasa ou é cancelado, e é isso que libera ou bloqueia.
import { GRACE_DAYS, PLANS, TRIAL_DAYS, type PlanId } from '@ensaio/shared'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db, schema } from './db'
import { env } from './env'
import { isAdminUser } from './http'
import { paymentConfirmedEmail, paymentOverdueEmail } from './lifecycle'
import { cancelPartnerCommission, isActivePartner, recordPartnerConversion, referralTrialDays } from './partners'

const { billingAccount, user, setlist } = schema
type Account = typeof billingAccount.$inferSelect

const DAY = 24 * 60 * 60 * 1000

/** Conta de cobrança da pessoa (criada na hora, com o teste, se ainda não existir). */
export async function getAccount(userId: string): Promise<Account> {
  const [row] = await db.select().from(billingAccount).where(eq(billingAccount.userId, userId))
  if (row) return row
  // Quem chegou pelo cupom de um parceiro tem mais dias de teste.
  const days = (await referralTrialDays(userId)) ?? TRIAL_DAYS
  const [created] = await db
    .insert(billingAccount)
    .values({ userId, trialEndsAt: new Date(Date.now() + days * DAY) })
    .onConflictDoNothing()
    .returning()
  return created ?? (await db.select().from(billingAccount).where(eq(billingAccount.userId, userId)))[0]
}

export type AccessReason = 'admin' | 'partner' | 'free' | 'subscription' | 'trial' | 'expired'

/** Pode criar e editar? (admins, parceiros ativos e o período antes de a cobrança valer, sempre) */
export function accessOf(acc: Account, isAdmin: boolean, now = new Date(), isPartner = false) {
  const paidUntil = acc.currentPeriodEnd ? acc.currentPeriodEnd.getTime() + GRACE_DAYS * DAY : 0
  const reason: AccessReason = isAdmin
    ? 'admin'
    : isPartner
      ? 'partner'
      : !env.BILLING_ENFORCED
        ? 'free'
        : paidUntil > now.getTime()
          ? 'subscription'
          : acc.trialEndsAt.getTime() > now.getTime()
            ? 'trial'
            : 'expired'
  const trialDaysLeft = Math.max(0, Math.ceil((acc.trialEndsAt.getTime() - now.getTime()) / DAY))
  return { active: reason !== 'expired', reason, trialDaysLeft }
}

/** Resumo para o app (aviso do teste, tela "Minha assinatura"). */
export async function billingSummary(u: { id: string; email: string; role?: string | null }) {
  // Cobrança desligada: não grava nada. O teste de 14 dias de cada pessoa só começa quando a
  // cobrança for ligada (senão, no dia do lançamento, todo mundo já estaria com o teste vencido).
  if (!env.BILLING_ENFORCED) {
    // Quem assinou mesmo assim (pagamentos já valendo) vê o próprio plano; só não cria a conta
    // de quem não assinou, para o teste não começar antes da hora.
    const [acc] = await db.select().from(billingAccount).where(eq(billingAccount.userId, u.id))
    const paid = Boolean(acc?.currentPeriodEnd && acc.currentPeriodEnd.getTime() + GRACE_DAYS * DAY > Date.now())
    return {
      enforced: false,
      configured: Boolean(env.ASAAS_API_KEY),
      active: true,
      reason: (isAdminUser(u) ? 'admin' : paid ? 'subscription' : 'free') as AccessReason,
      trialDaysLeft: 0,
      status: acc?.status ?? 'trialing',
      plan: (acc?.plan as PlanId | null) ?? null,
      trialEndsAt: null,
      currentPeriodEnd: acc?.currentPeriodEnd ?? null,
      pending: Boolean(acc?.asaasSubscriptionId) && (!acc?.currentPeriodEnd || acc.currentPeriodEnd.getTime() < Date.now()),
    }
  }
  const acc = await getAccount(u.id)
  const access = accessOf(acc, isAdminUser(u), new Date(), await isActivePartner(u.id))
  return {
    enforced: env.BILLING_ENFORCED,
    configured: Boolean(env.ASAAS_API_KEY),
    ...access,
    status: acc.status,
    plan: acc.plan as PlanId | null,
    trialEndsAt: acc.trialEndsAt,
    currentPeriodEnd: acc.currentPeriodEnd,
    /** Escolheu um plano e ainda não pagou (a cobrança está esperando). */
    pending: Boolean(acc.asaasSubscriptionId) && (!acc.currentPeriodEnd || acc.currentPeriodEnd.getTime() < Date.now()),
  }
}

export const PAYWALL_MESSAGE = 'Seu teste grátis terminou. Assine o Ensaio Fácil para criar e editar (ver e tocar continua liberado).'

/** Exige assinatura (ou teste) ativa de quem vai criar/editar. 402 = "pagamento necessário". */
export async function assertCanCreate(userId: string) {
  if (!env.BILLING_ENFORCED) return
  const [u] = await db.select({ email: user.email, role: user.role }).from(user).where(eq(user.id, userId))
  if (!u) throw new HTTPException(401, { message: 'Faça login para continuar.' })
  if (!accessOf(await getAccount(userId), isAdminUser(u), new Date(), await isActivePartner(userId)).active)
    throw new HTTPException(402, { message: PAYWALL_MESSAGE })
}

/** Repertório de outra pessoa: o que vale é a assinatura do DONO (quem paga pelo repertório). */
export async function assertSetlistOwnerCanCreate(setlistId: string) {
  if (!env.BILLING_ENFORCED) return
  const [s] = await db.select({ ownerId: setlist.ownerId }).from(setlist).where(eq(setlist.id, setlistId))
  if (!s) return // a própria rota responde 404
  try {
    await assertCanCreate(s.ownerId)
  } catch (e) {
    if (e instanceof HTTPException && e.status === 402)
      throw new HTTPException(402, { message: 'A assinatura de quem criou este repertório está inativa: ele está só para leitura.' })
    throw e
  }
}

// ---------------------------------------------------------------- Asaas

const ASAAS_URL = () => (env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3')

export async function asaas<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.ASAAS_API_KEY) throw new HTTPException(503, { message: 'Os pagamentos ainda não foram configurados.' })
  const res = await fetch(`${ASAAS_URL()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      access_token: env.ASAAS_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'EnsaioFacil/1.0',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
  if (!res) throw new HTTPException(502, { message: 'O sistema de pagamento não respondeu. Tente de novo em instantes.' })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.errors?.[0]?.description
    console.error('Asaas', res.status, path, JSON.stringify(data?.errors ?? data))
    throw new HTTPException(res.status === 400 ? 400 : 502, { message: detail ?? 'Não foi possível falar com o sistema de pagamento.' })
  }
  return data as T
}

/** Data de hoje no horário de Brasília (o Asaas trabalha com datas, sem hora). */
const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/** Soma o ciclo do plano a uma data "AAAA-MM-DD" (fim do período pago). */
export function periodEnd(dueDate: string, plan: PlanId) {
  const [y, m, d] = dueDate.split('-').map(Number)
  // Fim do dia no horário de Brasília (UTC-3).
  return new Date(Date.UTC(y, m - 1 + PLANS[plan].months, d, 23 + 3, 59, 59))
}

interface AsaasPayment {
  id: string
  subscription?: string
  customer: string
  value: number
  status: string
  dueDate: string
  paymentDate?: string | null
  billingType: string
  invoiceUrl: string
  externalReference?: string | null
}

/**
 * Começa (ou retoma) a assinatura e devolve o link da página de pagamento do Asaas.
 * Quem ainda está no teste só paga a 1ª cobrança no fim do teste (não perde os dias).
 */
export async function startCheckout(userId: string, input: { plan: PlanId; name: string; cpfCnpj: string; email: string }) {
  const acc = await getAccount(userId)
  const plan = PLANS[input.plan]

  // Já existe uma assinatura em andamento no mesmo plano: devolve a cobrança pendente.
  if (acc.asaasSubscriptionId && acc.status !== 'canceled') {
    if (acc.plan === input.plan) {
      const open = await pendingPayment(acc.asaasSubscriptionId)
      if (open) return { invoiceUrl: open.invoiceUrl, paymentId: open.id }
    }
    // Troca de plano: encerra a anterior (o período já pago continua valendo).
    await asaas(`/subscriptions/${acc.asaasSubscriptionId}`, { method: 'DELETE' }).catch(() => {})
  }

  let customerId = acc.asaasCustomerId
  if (!customerId) {
    const c = await asaas<{ id: string }>('/customers', {
      method: 'POST',
      body: { name: input.name, cpfCnpj: input.cpfCnpj, email: input.email, externalReference: userId },
    })
    customerId = c.id
  } else {
    await asaas(`/customers/${customerId}`, { method: 'PUT', body: { name: input.name, cpfCnpj: input.cpfCnpj } })
  }

  // Primeira cobrança: hoje, ou no fim do teste / do período já pago (o que vier depois).
  const starts = [todayBR()]
  if (acc.trialEndsAt.getTime() > Date.now()) starts.push(acc.trialEndsAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
  if (acc.currentPeriodEnd && acc.currentPeriodEnd.getTime() > Date.now())
    starts.push(acc.currentPeriodEnd.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
  const nextDueDate = starts.sort().at(-1)!

  const sub = await asaas<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      // UNDEFINED: a pessoa escolhe Pix, cartão ou boleto na página do Asaas.
      billingType: 'UNDEFINED',
      value: plan.price,
      nextDueDate,
      cycle: plan.cycle,
      description: `Ensaio Fácil — plano ${plan.label.toLowerCase()}`,
      externalReference: userId,
    },
  })
  await db
    .update(billingAccount)
    .set({ asaasCustomerId: customerId, asaasSubscriptionId: sub.id, plan: input.plan, updatedAt: new Date() })
    .where(eq(billingAccount.userId, userId))

  const first = await pendingPayment(sub.id)
  if (!first) throw new HTTPException(502, { message: 'A cobrança foi criada, mas o link de pagamento ainda não saiu. Tente de novo.' })
  return { invoiceUrl: first.invoiceUrl, paymentId: first.id }
}

/**
 * Página de pagamento do próprio app: Pix (QR code e copia e cola) e boleto (linha digitável),
 * sem mandar a pessoa para a fatura do Asaas. Cartão continua na página segura do Asaas
 * (os dados do cartão nunca passam pelo nosso servidor). Só a dona da cobrança vê.
 */
export async function paymentForCheckout(userId: string, paymentId: string) {
  const acc = await getAccount(userId)
  if (!acc.asaasCustomerId) throw new HTTPException(404, { message: 'Cobrança não encontrada.' })
  const p = await asaas<AsaasPayment & { description?: string; bankSlipUrl?: string | null }>(
    `/payments/${encodeURIComponent(paymentId)}`,
  ).catch(() => null)
  if (!p || p.customer !== acc.asaasCustomerId) throw new HTTPException(404, { message: 'Cobrança não encontrada.' })
  const paid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)
  const open = p.status === 'PENDING' || p.status === 'OVERDUE'
  const [pix, slip] = open
    ? await Promise.all([
        asaas<{ encodedImage: string; payload: string; expirationDate?: string }>(`/payments/${p.id}/pixQrCode`).catch(() => null),
        asaas<{ identificationField: string }>(`/payments/${p.id}/identificationField`).catch(() => null),
      ])
    : [null, null]
  return {
    id: p.id,
    status: p.status,
    paid,
    value: p.value,
    dueDate: p.dueDate,
    description: p.description ?? null,
    plan: acc.plan,
    pix: pix ? { image: `data:image/png;base64,${pix.encodedImage}`, payload: pix.payload, expiresAt: pix.expirationDate ?? null } : null,
    boleto: slip ? { line: slip.identificationField, pdfUrl: p.bankSlipUrl ?? null } : null,
    /** Página do Asaas (para pagar com cartão). */
    invoiceUrl: p.invoiceUrl,
  }
}

async function pendingPayment(subscriptionId: string) {
  const list = await asaas<{ data: AsaasPayment[] }>(`/subscriptions/${subscriptionId}/payments`)
  return list.data.find((p) => p.status === 'PENDING' || p.status === 'OVERDUE') ?? null
}

/** Pagamentos da pessoa (tela "Minha assinatura"). */
export async function listPayments(userId: string) {
  const acc = await getAccount(userId)
  if (!acc.asaasCustomerId || !env.ASAAS_API_KEY) return []
  const list = await asaas<{ data: AsaasPayment[] }>(`/payments?customer=${acc.asaasCustomerId}&limit=24`)
  return list.data.map((p) => ({
    id: p.id,
    value: p.value,
    status: p.status,
    dueDate: p.dueDate,
    paymentDate: p.paymentDate ?? null,
    billingType: p.billingType,
    invoiceUrl: p.invoiceUrl,
  }))
}

/** Cancela a renovação. O período já pago continua valendo até o fim. */
export async function cancelSubscription(userId: string) {
  const acc = await getAccount(userId)
  if (!acc.asaasSubscriptionId) throw new HTTPException(400, { message: 'Você não tem assinatura para cancelar.' })
  await asaas(`/subscriptions/${acc.asaasSubscriptionId}`, { method: 'DELETE' })
  await db
    .update(billingAccount)
    .set({ status: 'canceled', asaasSubscriptionId: null, updatedAt: new Date() })
    .where(eq(billingAccount.userId, userId))
}

// ---------------------------------------------------------------- avisos do Asaas (webhook)

export interface AsaasWebhook {
  id?: string
  event: string
  payment?: AsaasPayment
  subscription?: { id: string; externalReference?: string | null }
}

/** De quem é este aviso? (pela assinatura, pela referência ou pelo cliente) */
async function accountFor(body: AsaasWebhook) {
  const subId = body.payment?.subscription ?? body.subscription?.id
  if (subId) {
    const [a] = await db.select().from(billingAccount).where(eq(billingAccount.asaasSubscriptionId, subId))
    if (a) return a
  }
  const ref = body.payment?.externalReference ?? body.subscription?.externalReference
  if (ref) {
    const [a] = await db.select().from(billingAccount).where(eq(billingAccount.userId, ref))
    if (a) return a
  }
  if (body.payment?.customer) {
    const [a] = await db.select().from(billingAccount).where(eq(billingAccount.asaasCustomerId, body.payment.customer))
    if (a) return a
  }
  return null
}

/** Processa um aviso. Devolve o que foi feito (para o log e os testes). */
export async function handleWebhook(body: AsaasWebhook): Promise<string> {
  const eventId = body.id ?? `${body.event}:${body.payment?.id ?? body.subscription?.id ?? 'sem-id'}`
  const acc = await accountFor(body)
  // Mesmo aviso de novo: ignora (o Asaas reenvia se a resposta demorar).
  const fresh = await db
    .insert(schema.billingEvent)
    .values({ id: eventId, event: body.event, userId: acc?.userId ?? null })
    .onConflictDoNothing()
    .returning()
  if (!fresh.length) return 'repetido'
  if (!acc) return 'sem conta'

  const now = new Date()
  const plan = (acc.plan as PlanId | null) ?? 'monthly'
  // Aviso de uma assinatura que já foi trocada (troca de plano): não mexe na atual.
  const subId = body.payment?.subscription ?? body.subscription?.id
  const isOld =
    Boolean(subId && acc.asaasSubscriptionId && subId !== acc.asaasSubscriptionId) ||
    Boolean(subId && !acc.asaasSubscriptionId && body.event.startsWith('SUBSCRIPTION_'))
  switch (body.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      const p = body.payment!
      const end = periodEnd(p.dueDate, plan)
      // Nunca encurta um período maior já pago (ex.: aviso fora de ordem).
      const currentPeriodEnd = acc.currentPeriodEnd && acc.currentPeriodEnd > end ? acc.currentPeriodEnd : end
      await db
        .update(billingAccount)
        .set({ status: 'active', currentPeriodEnd, updatedAt: now })
        .where(eq(billingAccount.userId, acc.userId))
      // Confirmado e recebido chegam os dois para o mesmo pagamento: o recibo sai uma vez.
      void paymentConfirmedEmail(acc.userId, p, currentPeriodEnd).catch(() => {})
      // Indicado por um parceiro: comissão única sobre este 1º pagamento.
      await recordPartnerConversion(acc.userId, p, plan).catch((e) => console.error('Parceiros: comissão', e))
      return 'ativada'
    }
    case 'PAYMENT_OVERDUE':
      if (isOld) return 'ignorado (assinatura antiga)'
      await db.update(billingAccount).set({ status: 'past_due', updatedAt: now }).where(eq(billingAccount.userId, acc.userId))
      if (body.payment) void paymentOverdueEmail(acc.userId, body.payment).catch(() => {})
      return 'atrasada'
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
      // Reembolso (direito de arrependimento) ou contestação: o acesso pago acaba
      // e a comissão do parceiro (se ainda não foi paga) é cancelada.
      await cancelPartnerCommission(acc.userId, body.payment?.id).catch(() => {})
      await db
        .update(billingAccount)
        .set({ status: 'canceled', currentPeriodEnd: now, updatedAt: now })
        .where(eq(billingAccount.userId, acc.userId))
      return 'reembolsada'
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      if (isOld) return 'ignorado (assinatura antiga)'
      // Cancelou a renovação: vale até o fim do que já foi pago.
      await db
        .update(billingAccount)
        .set({ status: 'canceled', asaasSubscriptionId: null, updatedAt: now })
        .where(eq(billingAccount.userId, acc.userId))
      return 'cancelada'
    default:
      return 'ignorado'
  }
}
