// E-mails automáticos do ciclo da conta: boas-vindas, fim do teste, pagamento e "show amanhã".
// Cada e-mail sai uma vez só (tabela email_log). Os lembretes respeitam a opção do perfil;
// os de pagamento sempre vão. Uma rotina de hora em hora procura quem precisa receber.
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { env } from './env'
import {
  sendPaymentConfirmedEmail,
  sendPaymentOverdueEmail,
  sendShowTomorrowEmail,
  sendTrialEndedEmail,
  sendTrialEndingEmail,
  sendWelcomeEmail,
} from './mail'

const { emailLog, user, profile, billingAccount, setlist, setlistMember, setlistItem } = schema
const DAY = 24 * 60 * 60 * 1000

/** Envia uma vez só. Se o envio falhar, libera para tentar de novo na próxima rodada. */
export async function sendOnce(userId: string, kind: string, ref: string, send: () => Promise<void>) {
  const claimed = await db.insert(emailLog).values({ userId, kind, ref }).onConflictDoNothing().returning()
  if (!claimed.length) return false
  try {
    await send()
    return true
  } catch (e) {
    await db.delete(emailLog).where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.ref, ref)))
    console.error(`E-mail "${kind}" para ${userId} falhou`, e)
    return false
  }
}

async function contact(userId: string) {
  const [u] = await db
    .select({ email: user.email, name: user.name, banned: user.banned, reminders: profile.emailReminders })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId))
  return u && !u.banned ? { ...u, reminders: u.reminders ?? true } : null
}

export async function welcomeEmail(userId: string) {
  const u = await contact(userId)
  if (u) await sendOnce(userId, 'welcome', '', () => sendWelcomeEmail(u.email, u.name))
}

export async function paymentConfirmedEmail(
  userId: string,
  payment: { id: string; value: number; invoiceUrl?: string | null },
  until: Date,
) {
  const u = await contact(userId)
  if (u)
    await sendOnce(userId, 'payment_ok', payment.id, () =>
      sendPaymentConfirmedEmail(u.email, u.name, payment.value, until, payment.invoiceUrl ?? null),
    )
}

export async function paymentOverdueEmail(userId: string, payment: { id: string; value: number; invoiceUrl?: string | null }) {
  const u = await contact(userId)
  if (u)
    await sendOnce(userId, 'payment_overdue', payment.id, () =>
      sendPaymentOverdueEmail(u.email, u.name, payment.value, payment.invoiceUrl ?? null),
    )
}

/** Fim do teste: aviso 3 dias antes e no dia em que acaba (só com a cobrança ligada e sem pagamento). */
export async function trialEmails(now = new Date()) {
  if (!env.BILLING_ENFORCED) return 0
  const unpaid = or(isNull(billingAccount.currentPeriodEnd), lte(billingAccount.currentPeriodEnd, now))
  let sent = 0
  const ending = await db
    .select({ userId: billingAccount.userId, trialEndsAt: billingAccount.trialEndsAt })
    .from(billingAccount)
    .where(and(unpaid, gt(billingAccount.trialEndsAt, now), lte(billingAccount.trialEndsAt, new Date(now.getTime() + 3 * DAY))))
  for (const a of ending) {
    const u = await contact(a.userId)
    if (!u?.reminders) continue
    const days = Math.max(1, Math.ceil((a.trialEndsAt.getTime() - now.getTime()) / DAY))
    const ref = a.trialEndsAt.toISOString().slice(0, 10)
    if (await sendOnce(a.userId, 'trial_ending', ref, () => sendTrialEndingEmail(u.email, u.name, a.trialEndsAt, days))) sent++
  }
  const ended = await db
    .select({ userId: billingAccount.userId, trialEndsAt: billingAccount.trialEndsAt })
    .from(billingAccount)
    .where(and(unpaid, lte(billingAccount.trialEndsAt, now), gt(billingAccount.trialEndsAt, new Date(now.getTime() - 2 * DAY))))
  for (const a of ended) {
    const u = await contact(a.userId)
    if (!u?.reminders) continue
    const ref = a.trialEndsAt.toISOString().slice(0, 10)
    if (await sendOnce(a.userId, 'trial_ended', ref, () => sendTrialEndedEmail(u.email, u.name))) sent++
  }
  return sent
}

/** Dia no fuso de Brasília ("2026-10-06"). */
const dayBR = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/** "Seu show é amanhã": para quem criou e para a banda, a partir das 9h do dia anterior. */
export async function showTomorrowEmails(now = new Date()) {
  const hourBR = Number(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  if (hourBR < 9) return 0
  const tomorrow = dayBR(new Date(now.getTime() + DAY))
  const shows = await db
    .select({ id: setlist.id, name: setlist.name, eventDate: setlist.eventDate, location: setlist.location, ownerId: setlist.ownerId })
    .from(setlist)
    .where(
      and(
        eq(setlist.archived, false),
        gt(setlist.eventDate, new Date(now.getTime())),
        lte(setlist.eventDate, new Date(now.getTime() + 2 * DAY)),
      ),
    )
  let sent = 0
  for (const s of shows) {
    if (!s.eventDate || dayBR(s.eventDate) !== tomorrow) continue
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(setlistItem)
      .where(eq(setlistItem.setlistId, s.id))
    if (!n) continue
    const members = await db.select({ userId: setlistMember.userId }).from(setlistMember).where(eq(setlistMember.setlistId, s.id))
    const people = new Set([s.ownerId, ...members.map((m) => m.userId)])
    for (const userId of people) {
      const u = await contact(userId)
      if (!u?.reminders) continue
      const show = { name: s.name, eventDate: s.eventDate, location: s.location, songCount: n, url: `${env.APP_URL}/repertorios/${s.id}` }
      if (await sendOnce(userId, 'show_tomorrow', `${s.id}:${tomorrow}`, () => sendShowTomorrowEmail(u.email, u.name, show))) sent++
    }
  }
  return sent
}

/** Rotina de hora em hora (e uma vez 2 min depois de ligar). */
export function startLifecycleEmails() {
  const run = async () => {
    await trialEmails().catch((e) => console.error('E-mails do teste: falha', e))
    await showTomorrowEmails().catch((e) => console.error('E-mails de show: falha', e))
  }
  setTimeout(run, 2 * 60_000).unref()
  setInterval(run, 60 * 60_000).unref()
}
