// E-mails automáticos: cada um sai uma vez só, na hora certa, e respeita a opção do perfil.
// Rodam contra o banco de desenvolvimento (sem mandar e-mail de verdade nos testes).
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const { sendOnce, showTomorrowEmails } = await import('../src/lifecycle')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }

async function call(u: User, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { cookie, id: (await res.json()).user.id }
}

const logs = async (userId: string, kind: string) =>
  (await client`select ref from email_log where user_id = ${userId} and kind = ${kind}`).map((r) => r.ref as string)

// "Agora" = hoje às 10h de Brasília; o show é amanhã às 20h.
const now = new Date()
now.setUTCHours(13, 0, 0, 0)
const showAt = new Date(now.getTime() + 34 * 60 * 60 * 1000)

let ana: User, beto: User

beforeAll(async () => {
  ;[ana, beto] = await Promise.all(['ana', 'beto'].map(signUp))
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('e-mails automáticos', () => {
  it('boas-vindas sai no cadastro, uma vez só', async () => {
    await new Promise((r) => setTimeout(r, 300))
    expect(await logs(ana.id, 'welcome')).toEqual([''])
  })

  it('sendOnce não repete o mesmo e-mail e libera se o envio falhar', async () => {
    let n = 0
    expect(await sendOnce(ana.id, 'teste', 'x', async () => void n++)).toBe(true)
    expect(await sendOnce(ana.id, 'teste', 'x', async () => void n++)).toBe(false)
    expect(n).toBe(1)
    expect(
      await sendOnce(ana.id, 'teste', 'falha', async () => {
        throw new Error('SMTP fora do ar')
      }),
    ).toBe(false)
    expect(await logs(ana.id, 'teste')).toEqual(['x'])
  })

  it('show amanhã: avisa quem tem o repertório; não repete; respeita quem desligou', async () => {
    const mk = async (u: User, name: string) => {
      const id = (await call(u, 'POST', '/setlists', { name: `${name} ${run}`, eventDate: showAt.toISOString() })).data.id
      const song = (await call(u, 'POST', '/songs', { title: `Música ${run}`, content: '[Intro] C' })).data.id
      await call(u, 'POST', `/setlists/${id}/items`, { songId: song })
      return id as string
    }
    const s1 = await mk(ana, 'Show da Ana')
    await mk(beto, 'Show do Beto')
    // Beto desliga os lembretes.
    const me = (await call(beto, 'GET', '/me')).data
    await call(beto, 'PUT', '/me', { name: me.name, emailReminders: false })

    await showTomorrowEmails(now)
    const refs = await logs(ana.id, 'show_tomorrow')
    expect(refs).toHaveLength(1)
    expect(refs[0]).toContain(s1)
    expect(await logs(beto.id, 'show_tomorrow')).toEqual([])

    // Rodar de novo (de hora em hora) não manda outra vez.
    await showTomorrowEmails(new Date(now.getTime() + 60 * 60 * 1000))
    expect(await logs(ana.id, 'show_tomorrow')).toHaveLength(1)
  })

  it('antes das 9h não manda o lembrete do show', async () => {
    const early = new Date(now)
    early.setUTCHours(10, 0, 0, 0) // 7h em Brasília
    const before = (await logs(beto.id, 'show_tomorrow')).length
    await call(beto, 'PUT', '/me', { name: 'beto', emailReminders: true })
    await showTomorrowEmails(early)
    expect(await logs(beto.id, 'show_tomorrow')).toHaveLength(before)
  })
})
