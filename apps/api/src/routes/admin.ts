import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db'
import { notFound, requireAdmin, validate, type AppEnv } from '../http'

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

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)

  // 1. Visão Geral / KPIs
  .get('/overview', async (c) => {
    const [
      userStats,
      songStats,
      setlistStats,
      scoreStats,
      reportStats,
      visitStats,
      activeToday,
    ] = await Promise.all([
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

    return c.json({
      users: userStats[0],
      songs: songStats[0],
      setlists: setlistStats[0],
      scores: scoreStats[0],
      reports: reportStats[0],
      visits: visitStats[0],
      activeUsers: activeToday[0],
    })
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
        where.push(
          or(
            ilike(user.name, `%${q}%`),
            ilike(user.email, `%${q}%`),
            ilike(profile.city, `%${q}%`),
          ),
        )
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

      return c.json({
        users: rows,
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
      const [u] = await db.update(user).set({ role }).where(eq(user.id, id)).returning()
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
      const [u] = await db.update(user).set({ banned }).where(eq(user.id, id)).returning()
      if (!u) notFound('Usuário')
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

      const [r] = await db
        .update(songReport)
        .set({ status, resolvedAt: new Date() })
        .where(eq(songReport.id, id))
        .returning()

      if (!r) notFound('Denúncia')

      if (hideSong) {
        await db.update(song).set({ visibility: 'private' }).where(eq(song.id, r.songId))
      }

      return c.json({ ok: true, report: r })
    },
  )
