// Registro de erros próprio: agrupa erros iguais e só o administrador vê.
// Roda contra o banco de desenvolvimento e apaga o que cria no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const { fingerprintOf } = await import('../src/errors')

const ORIGIN = process.env.APP_URL!
const run = randomBytes(4).toString('hex')

const report = (body: unknown) =>
  app.request('/api/errors', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': `10.9.${run.length}.1` },
    body: JSON.stringify(body),
  })

afterAll(async () => {
  await client`delete from app_error where message like ${'%' + run + '%'}`
  await client.end()
})

describe('registro de erros', () => {
  it('agrupa o mesmo erro mesmo com ids e números diferentes', () => {
    const a = fingerprintOf({
      source: 'web',
      message: 'Música 12 não achou 3f51d04b-a56b-42c7-9cbf-c18eebef68c3',
      stack: 'Error\n    at x (index-AbC12345.js:10:5)',
    })
    const b = fingerprintOf({
      source: 'web',
      message: 'Música 99 não achou 66a1da3c-aad8-4818-8e56-dcfca2bfc821',
      stack: 'Error\n    at x (index-ZyX98765.js:11:9)',
    })
    expect(a).toBe(b)
    expect(fingerprintOf({ source: 'api', message: 'Música 12 não achou', stack: '' })).not.toBe(a)
  })

  it('a tela avisa o erro e ele soma no contador', async () => {
    const body = {
      message: `Falhou ao abrir ${run}`,
      stack: 'TypeError\n    at abrir (SongView.js:1:1)',
      url: '/musicas/1',
      release: 'teste',
    }
    expect((await report(body)).status).toBe(200)
    expect((await report(body)).status).toBe(200)
    const rows = await client`select count, source, url from app_error where message = ${body.message}`
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
    expect(rows[0].source).toBe('web')
  })

  it('recusa aviso inválido e só o administrador lista', async () => {
    expect((await report({ message: '' })).status).toBe(400)
    const res = await app.request('/api/admin/errors', { headers: { origin: ORIGIN } })
    expect(res.status).toBe(401)
  })
})
