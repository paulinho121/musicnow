import { PLANS } from '@ensaio/shared'
import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db, schema } from '../db'
import { env } from '../env'
import { notFound, requireAdmin, validate, type AppEnv } from '../http'
import { isPayable, isValidCode, normalizeCode, partnerStats } from '../partners'
import { getGlobalOnlineUsers } from '../realtime'

const { user, profile, song, setlist, songScore, songReport, pageVisit, session } = schema

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: 'Desconhecido', browser: 'Outro' }
  const lower = ua.toLowerCase()

  let device = 'Desktop'
  if (/mobile|android|iphone|ipod/i.test(lower)) device = 'Celular'
  else if (/tablet|ipad/i.test(lower)) device = 'Tablet'

  let browser = 'Outro'
  if (lower.includes('chrome') && !lower.includes('edg') && !lower.includes('opr')) browser = 'Chrome'
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari'
  else if (lower.includes('firefox')) browser = 'Firefox'
  else if (lower.includes('edg')) browser = 'Edge'
  else if (lower.includes('opera') || lower.includes('opr')) browser = 'Opera'

  return { device, browser }
}

const partnerInput = z.object({
  code: z.string().min(3).max(40),
  name: z.string().trim().min(1).max(120),
  /** E-mail da conta do parceiro no app (acesso grátis e painel). Vazio = sem conta ligada. */
  email: z.string().trim().max(200).nullish(),
  pixKey: z.string().trim().max(200).nullish(),
  commissionPercent: z.number().int().min(0).max(100).default(50),
  trialDays: z.number().int().min(1).max(90).default(30),
  active: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullish(),
})

/** Dados do parceiro para gravar: cupom normalizado e a conta achada pelo e-mail. */
async function partnerValues(input: Partial<z.infer<typeof partnerInput>>) {
  const { email, ...rest } = input
  const values: Record<string, unknown> = { ...rest }
  if (input.code !== undefined) {
    const code = normalizeCode(input.code)
    if (!isValidCode(code)) throw new HTTPException(400, { message: 'O cupom precisa ter de 3 a 20 letras ou números.' })
    values.code = code
  }
  if (email !== undefined) {
    if (!email) values.userId = null
    else {
      const [u] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(sql`lower(${user.email})`, email.toLowerCase()))
      if (!u)
        throw new HTTPException(400, { message: `Não achamos uma conta com o e-mail ${email}. Peça para o parceiro criar a conta antes.` })
      values.userId = u.id
    }
  }
  return values as typeof schema.partner.$inferInsert
}

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)

  // 1. Visão Geral / KPIs com Usuários Online em Tempo Real
  .get('/overview', async (c) => {
    const onlineUsers = getGlobalOnlineUsers()

    const [userStats, songStats, setlistStats, scoreStats, reportStats, visitsStats, activeToday] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          newToday: sql<number>`count(*) filter (where ${user.createdAt} >= date_trunc('day', now()))::int`,
          new7d: sql<number>`count(*) filter (where ${user.createdAt} >= now() - interval '7 days')::int`,
          new30d: sql<number>`count(*) filter (where ${user.createdAt} >= now() - interval '30 days')::int`,
          admins: sql<number>`count(*) filter (where ${user.role} = 'admin')::int`,
        })
        .from(user),

      db
        .select({
          total: sql<number>`count(*)::int`,
          public: sql<number>`count(*) filter (where ${song.visibility} = 'public')::int`,
          private: sql<number>`count(*) filter (where ${song.visibility} = 'private')::int`,
          shared: sql<number>`count(*) filter (where ${song.visibility} = 'shared')::int`,
        })
        .from(song),

      db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${setlist.archived} = false)::int`,
        })
        .from(setlist),

      db
        .select({
          totalParts: sql<number>`count(*)::int`,
          totalBytes: sql<number>`coalesce(sum(${songScore.totalBytes}), 0)::bigint`,
        })
        .from(songScore),

      db
        .select({
          open: sql<number>`count(*) filter (where ${songReport.status} = 'open')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(songReport),

      db
        .select({
          today: sql<number>`count(*) filter (where ${pageVisit.createdAt} >= date_trunc('day', now()))::int`,
          last7d: sql<number>`count(*) filter (where ${pageVisit.createdAt} >= now() - interval '7 days')::int`,
          last30d: sql<number>`count(*) filter (where ${pageVisit.createdAt} >= now() - interval '30 days')::int`,
        })
        .from(pageVisit),

      db
        .select({
          dau: sql<number>`count(distinct ${pageVisit.userId}) filter (where ${pageVisit.createdAt} >= date_trunc('day', now()) and ${pageVisit.userId} is not null)::int`,
          mau: sql<number>`count(distinct ${pageVisit.userId}) filter (where ${pageVisit.createdAt} >= now() - interval '30 days' and ${pageVisit.userId} is not null)::int`,
        })
        .from(pageVisit),
    ])

    // Assinaturas: pagantes (com tolerância de 3 dias), testes em andamento e receita mensal recorrente.
    const [billing] = await db
      .select({
        monthly: sql<number>`count(*) filter (where ${schema.billingAccount.status} in ('active','past_due') and ${schema.billingAccount.currentPeriodEnd} > now() - interval '3 days' and ${schema.billingAccount.plan} = 'monthly')::int`,
        yearly: sql<number>`count(*) filter (where ${schema.billingAccount.status} in ('active','past_due') and ${schema.billingAccount.currentPeriodEnd} > now() - interval '3 days' and ${schema.billingAccount.plan} = 'yearly')::int`,
        pastDue: sql<number>`count(*) filter (where ${schema.billingAccount.status} = 'past_due')::int`,
        trialing: sql<number>`count(*) filter (where ${schema.billingAccount.trialEndsAt} > now() and (${schema.billingAccount.currentPeriodEnd} is null or ${schema.billingAccount.currentPeriodEnd} < now()))::int`,
        canceling: sql<number>`count(*) filter (where ${schema.billingAccount.status} = 'canceled' and ${schema.billingAccount.currentPeriodEnd} > now())::int`,
        expired: sql<number>`count(*) filter (where ${schema.billingAccount.trialEndsAt} <= now() and (${schema.billingAccount.currentPeriodEnd} is null or ${schema.billingAccount.currentPeriodEnd} < now() - interval '3 days'))::int`,
      })
      .from(schema.billingAccount)
    const [errors] = await db
      .select({
        open: sql<number>`count(*)::int`,
        last24h: sql<number>`count(*) filter (where ${schema.appError.lastSeenAt} > now() - interval '24 hours')::int`,
      })
      .from(schema.appError)
    const mrr = Math.round((billing.monthly * PLANS.monthly.price + (billing.yearly * PLANS.yearly.price) / 12) * 100) / 100

    return c.json({
      billing: { ...billing, paying: billing.monthly + billing.yearly, mrr, enforced: env.BILLING_ENFORCED },
      users: userStats[0],
      songs: songStats[0],
      setlists: setlistStats[0],
      scores: scoreStats[0],
      reports: reportStats[0],
      errors,
      visits: visitsStats[0],
      activeUsers: activeToday[0],
      online: {
        count: onlineUsers.length,
        users: onlineUsers,
      },
    })
  })

  // Lista de Usuários Online em Tempo Real
  .get('/online', (c) => {
    return c.json({ online: getGlobalOnlineUsers() })
  })

  // 2. Tráfego e Fluxo de Visitas
  .get(
    '/traffic',
    validate(
      'query',
      z.object({
        days: z.coerce.number().int().min(7).max(90).default(14),
      }),
    ),
    async (c) => {
      const { days } = c.req.valid('query')

      const [dailyVisits, topPages, rawUa] = await Promise.all([
        db
          .select({
            date: sql<string>`to_char(date_trunc('day', ${pageVisit.createdAt}), 'YYYY-MM-DD')`,
            visits: sql<number>`count(*)::int`,
            uniqueIps: sql<number>`count(distinct ${pageVisit.ip})::int`,
            registeredUsers: sql<number>`count(distinct ${pageVisit.userId}) filter (where ${pageVisit.userId} is not null)::int`,
          })
          .from(pageVisit)
          .where(gte(pageVisit.createdAt, sql`now() - (${days} || ' days')::interval`))
          .groupBy(sql`date_trunc('day', ${pageVisit.createdAt})`)
          .orderBy(sql`date_trunc('day', ${pageVisit.createdAt})`),

        db
          .select({
            path: pageVisit.path,
            count: sql<number>`count(*)::int`,
          })
          .from(pageVisit)
          .where(gte(pageVisit.createdAt, sql`now() - (${days} || ' days')::interval`))
          .groupBy(pageVisit.path)
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        db
          .select({
            userAgent: pageVisit.userAgent,
          })
          .from(pageVisit)
          .where(gte(pageVisit.createdAt, sql`now() - (${days} || ' days')::interval`))
          .limit(1000),
      ])

      const deviceCounts: Record<string, number> = {}
      const browserCounts: Record<string, number> = {}

      for (const row of rawUa) {
        const { device, browser } = parseUserAgent(row.userAgent)
        deviceCounts[device] = (deviceCounts[device] || 0) + 1
        browserCounts[browser] = (browserCounts[browser] || 0) + 1
      }

      return c.json({
        daily: dailyVisits,
        topPages,
        devices: Object.entries(deviceCounts).map(([name, count]) => ({ name, count })),
        browsers: Object.entries(browserCounts).map(([name, count]) => ({ name, count })),
      })
    },
  )

  // 3. Gestão de Usuários
  .get(
    '/users',
    validate(
      'query',
      z.object({
        q: z.string().optional(),
        role: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(5).max(100).default(20),
      }),
    ),
    async (c) => {
      const { q, role, page, limit } = c.req.valid('query')
      const offset = (page - 1) * limit

      const where = []
      if (q) {
        where.push(or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`), ilike(profile.city, `%${q}%`)))
      }
      if (role) {
        where.push(eq(user.role, role))
      }

      const whereExpr = where.length ? and(...where) : undefined

      const [totalCount, rows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(user)
          .leftJoin(profile, eq(profile.userId, user.id))
          .where(whereExpr),

        db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            role: user.role,
            banned: user.banned,
            createdAt: user.createdAt,
            city: profile.city,
            musicianRole: profile.role,
            songCount: sql<number>`(select count(*)::int from ${song} where ${song.ownerId} = ${user.id})`,
            setlistCount: sql<number>`(select count(*)::int from ${setlist} where ${setlist.ownerId} = ${user.id})`,
            lastSession: sql<string>`(select max(${session.createdAt}) from ${session} where ${session.userId} = ${user.id})`,
          })
          .from(user)
          .leftJoin(profile, eq(profile.userId, user.id))
          .where(whereExpr)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset),
      ])

      const onlineMap = new Map(getGlobalOnlineUsers().map((u) => [u.userId, u]))

      const enrichedUsers = rows.map((u) => {
        const active = onlineMap.get(u.id)
        return {
          ...u,
          isOnline: Boolean(active),
          currentPath: active?.path ?? null,
        }
      })

      return c.json({
        users: enrichedUsers,
        total: totalCount[0]?.count ?? 0,
        page,
        totalPages: Math.ceil((totalCount[0]?.count ?? 0) / limit),
      })
    },
  )

  // 4. Alterar papel de administrador
  .patch(
    '/users/:id/role',
    validate('param', z.object({ id: z.string() })),
    validate('json', z.object({ role: z.enum(['admin', 'user']) })),
    async (c) => {
      const { id } = c.req.valid('param')
      const { role } = c.req.valid('json')
      // Não deixa o admin se rebaixar sem querer (ficaria trancado fora do painel).
      if (id === c.var.user.id && role !== 'admin')
        throw new HTTPException(400, { message: 'Você não pode tirar o seu próprio acesso de admin.' })
      const [u] = await db
        .update(user)
        .set({ role })
        .where(eq(user.id, id))
        .returning({ id: user.id, role: user.role, banned: user.banned })
      if (!u) notFound('Usuário')
      return c.json({ ok: true, user: u })
    },
  )

  // 5. Bloquear ou ativar usuário
  .patch(
    '/users/:id/status',
    validate('param', z.object({ id: z.string() })),
    validate('json', z.object({ banned: z.boolean() })),
    async (c) => {
      const { id } = c.req.valid('param')
      const { banned } = c.req.valid('json')
      if (id === c.var.user.id && banned) throw new HTTPException(400, { message: 'Você não pode bloquear a sua própria conta.' })
      const [u] = await db
        .update(user)
        .set({ banned })
        .where(eq(user.id, id))
        .returning({ id: user.id, role: user.role, banned: user.banned })
      if (!u) notFound('Usuário')
      // Bloqueou: encerra todas as sessões (a pessoa sai de todos os aparelhos).
      if (banned) await db.delete(schema.session).where(eq(schema.session.userId, id))
      return c.json({ ok: true, user: u })
    },
  )

  // 6. Denúncias de moderação
  .get('/reports', async (c) => {
    const rows = await db
      .select({
        id: songReport.id,
        reason: songReport.reason,
        details: songReport.details,
        status: songReport.status,
        createdAt: songReport.createdAt,
        songId: song.id,
        songTitle: song.title,
        songArtist: song.artist,
        songVisibility: song.visibility,
        reporterId: user.id,
        reporterName: user.name,
        reporterEmail: user.email,
      })
      .from(songReport)
      .innerJoin(song, eq(song.id, songReport.songId))
      .innerJoin(user, eq(user.id, songReport.reporterId))
      .orderBy(desc(songReport.createdAt))
      .limit(50)

    return c.json({ reports: rows })
  })

  .patch(
    '/reports/:id',
    validate('param', z.object({ id: z.string().uuid() })),
    validate(
      'json',
      z.object({
        status: z.enum(schema.reportStatus.enumValues),
        hideSong: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param')
      const { status, hideSong } = c.req.valid('json')

      const [r] = await db.update(songReport).set({ status, resolvedAt: new Date() }).where(eq(songReport.id, id)).returning()

      if (!r) notFound('Denúncia')

      if (hideSong) {
        await db.update(song).set({ visibility: 'private' }).where(eq(song.id, r.songId))
      }

      return c.json({ ok: true, report: r })
    },
  )

  // 7. Erros do app (telas e API), os mais recentes primeiro
  .get('/errors', async (c) => {
    const rows = await db
      .select({
        id: schema.appError.id,
        source: schema.appError.source,
        message: schema.appError.message,
        stack: schema.appError.stack,
        url: schema.appError.url,
        userAgent: schema.appError.userAgent,
        release: schema.appError.release,
        count: schema.appError.count,
        firstSeenAt: schema.appError.firstSeenAt,
        lastSeenAt: schema.appError.lastSeenAt,
        lastUserName: user.name,
      })
      .from(schema.appError)
      .leftJoin(user, eq(user.id, schema.appError.lastUserId))
      .orderBy(desc(schema.appError.lastSeenAt))
      .limit(100)
    return c.json({ errors: rows })
  })

  // Resolvido: some da lista (se acontecer de novo, volta como novo).
  .delete('/errors/:id', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    await db.delete(schema.appError).where(eq(schema.appError.id, c.req.valid('param').id))
    return c.json({ ok: true })
  })
  .delete('/errors', async (c) => {
    await db.delete(schema.appError)
    return c.json({ ok: true })
  })

  // 8. Parceiros (cupons e comissões)
  .get('/partners', async (c) => {
    const rows = await db
      .select({
        id: schema.partner.id,
        code: schema.partner.code,
        name: schema.partner.name,
        pixKey: schema.partner.pixKey,
        commissionPercent: schema.partner.commissionPercent,
        trialDays: schema.partner.trialDays,
        active: schema.partner.active,
        notes: schema.partner.notes,
        createdAt: schema.partner.createdAt,
        userEmail: user.email,
      })
      .from(schema.partner)
      .leftJoin(user, eq(user.id, schema.partner.userId))
      .orderBy(desc(schema.partner.createdAt))
    const partners = await Promise.all(rows.map(async (p) => ({ ...p, ...(await partnerStats(p.id)).totals })))
    // Ranking: quem mais trouxe assinantes primeiro.
    partners.sort((a, b) => b.customers - a.customers || b.signups - a.signups)
    return c.json({ partners })
  })

  .post('/partners', validate('json', partnerInput), async (c) => {
    const input = c.req.valid('json')
    const values = await partnerValues(input)
    const [p] = await db.insert(schema.partner).values(values).onConflictDoNothing().returning()
    if (!p) throw new HTTPException(400, { message: `Já existe um parceiro com o cupom ${values.code}.` })
    return c.json({ partner: p }, 201)
  })

  .patch('/partners/:id', validate('param', z.object({ id: z.string().uuid() })), validate('json', partnerInput.partial()), async (c) => {
    const input = c.req.valid('json')
    const values = await partnerValues(input)
    const [p] = await db
      .update(schema.partner)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.partner.id, c.req.valid('param').id))
      .returning()
    if (!p) notFound('Parceiro')
    return c.json({ partner: p })
  })

  // Indicações de um parceiro (com o nome de quem assinou: só o administrador vê).
  .get('/partners/:id/referrals', validate('param', z.object({ id: z.string().uuid() })), async (c) => {
    const { rows } = await partnerStats(c.req.valid('param').id)
    const names = rows.length
      ? await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(
            inArray(
              user.id,
              rows.map((r) => r.userId),
            ),
          )
      : []
    return c.json({
      referrals: rows.map((r) => {
        const u = names.find((n) => n.id === r.userId)
        return { ...r, status: isPayable(r) ? 'payable' : r.status, name: u?.name ?? null, email: u?.email ?? null }
      }),
    })
  })

  // Comissão paga ao parceiro (Pix feito fora do app).
  .post('/referrals/:userId/paid', validate('param', z.object({ userId: z.string().min(1) })), async (c) => {
    const [r] = await db
      .select()
      .from(schema.partnerReferral)
      .where(eq(schema.partnerReferral.userId, c.req.valid('param').userId))
    if (!r) notFound('Indicação')
    if (!isPayable(r)) throw new HTTPException(400, { message: 'Esta comissão ainda não está liberada para pagamento.' })
    await db
      .update(schema.partnerReferral)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.partnerReferral.userId, r.userId))
    return c.json({ ok: true })
  })
