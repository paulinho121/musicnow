// Entrar com o Google numa conta criada com e-mail e senha: junta as contas com segurança.
// Banco de desenvolvimento.
import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const { secureSocialLink } = await import('../src/auth')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

async function signUp(name: string) {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  return (await res.json()).user.id as string
}
const providers = async (userId: string) =>
  (await client<{ provider_id: string }[]>`select provider_id from account where user_id = ${userId}`).map((r) => r.provider_id).sort()
const verified = async (userId: string) =>
  (await client<{ email_verified: boolean }[]>`select email_verified from "user" where id = ${userId}`)[0].email_verified

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('vincular Google a uma conta existente', () => {
  it('e-mail nunca verificado: a senha antiga sai e o e-mail fica verificado', async () => {
    const id = await signUp('senha')
    expect(await providers(id)).toEqual(['credential'])
    expect(await verified(id)).toBe(false)
    await secureSocialLink({ userId: id, providerId: 'google' })
    expect(await providers(id)).toEqual([])
    expect(await verified(id)).toBe(true)
  })

  it('e-mail já verificado: a senha continua', async () => {
    const id = await signUp('verificada')
    await client`update "user" set email_verified = true where id = ${id}`
    await secureSocialLink({ userId: id, providerId: 'google' })
    expect(await providers(id)).toEqual(['credential'])
  })

  it('cadastro com senha não é afetado', async () => {
    const id = await signUp('nova')
    await secureSocialLink({ userId: id, providerId: 'credential' })
    expect(await providers(id)).toEqual(['credential'])
    expect(await verified(id)).toBe(false)
  })
})
