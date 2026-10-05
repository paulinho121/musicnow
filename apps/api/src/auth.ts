import { TRIAL_DAYS } from '@ensaio/shared'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { db, schema } from './db'
import { env } from './env'
import { sendPasswordChangedEmail, sendPasswordResetEmail } from './mail'
import { createWelcomeSong } from './welcome-song'

// Login social só é ativado quando as credenciais existem no ambiente.
const socialProviders: Parameters<typeof betterAuth>[0]['socialProviders'] = {}
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
}
if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET }
}

export const enabledProviders = Object.keys(socialProviders)

export const auth = betterAuth({
  appName: 'Ensaio Fácil',
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL, ...env.EXTRA_TRUSTED_ORIGINS],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // Quem redefine a senha derruba as outras sessões (ex.: celular perdido).
    revokeSessionsOnPasswordReset: true,
    // Sem await: a resposta não pode demorar mais para e-mails existentes do que
    // para inexistentes, senão dá para descobrir quem tem conta.
    sendResetPassword: async ({ user, url }) => {
      sendPasswordResetEmail(user.email, user.name, url).catch((e) => console.error('Falha ao enviar e-mail de senha', e))
    },
    onPasswordReset: async ({ user }) => {
      sendPasswordChangedEmail(user.email, user.name).catch((e) => console.error('Falha ao enviar aviso de senha', e))
    },
  },
  rateLimit: {
    // Limite de tentativas por IP. Os mais apertados protegem contra adivinhação de senha.
    // (Desligado só nos testes automáticos, que criam várias contas em sequência.)
    enabled: process.env.NODE_ENV !== 'test',
    window: 60,
    max: 100,
    customRules: {
      // 10/min por IP: uma banda inteira pode entrar junta pelo mesmo Wi-Fi da igreja.
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60 * 60, max: 10 },
      '/request-password-reset': { window: 15 * 60, max: 3 },
      '/reset-password': { window: 15 * 60, max: 5 },
    },
  },
  socialProviders,
  user: {
    // Papel e bloqueio vêm do banco para a sessão; input: false = ninguém altera pela própria conta.
    additionalFields: {
      role: { type: 'string', input: false, defaultValue: 'user' },
      banned: { type: 'boolean', input: false, defaultValue: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Conta bloqueada não entra (nem por senha, nem por Google).
        before: async (session) => {
          const [u] = await db.select({ banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, session.userId))
          if (u?.banned) throw new APIError('FORBIDDEN', { message: 'Esta conta está bloqueada. Fale com o suporte do Ensaio Fácil.' })
        },
      },
    },
    user: {
      create: {
        // Conta nova começa com a música de exemplo (passo a passo). Se falhar, o cadastro segue.
        after: async (created) => {
          // Teste grátis de 14 dias começa no cadastro (só com a cobrança ligada; antes disso
          // ele começa no primeiro acesso depois do lançamento).
          if (env.BILLING_ENFORCED) {
            await db
              .insert(schema.billingAccount)
              .values({ userId: created.id, trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) })
              .onConflictDoNothing()
              .catch((e) => console.error('Falha ao iniciar o teste grátis', e))
          }
          await createWelcomeSong(created.id).catch((e) => console.error('Falha ao criar música de exemplo', e))
        },
      },
    },
  },
  session: {
    // Músicos usam o app no palco: sessão longa, renovada a cada dia de uso.
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: env.APP_URL.startsWith('https://'),
    // A API só recebe conexões do Caddy (127.0.0.1). O Caddy descarta o X-Forwarded-For
    // enviado pelo cliente e escreve o IP real, então este cabeçalho é confiável.
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
  },
})

export type Session = typeof auth.$Infer.Session
