// Áudio guia da Sala de ensaio: envio, quem vê, Range e exclusão. Banco de desenvolvimento.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }
async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  return {
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
    id: (await res.json()).user.id,
  }
}
async function call(u: User, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res
}
const json = async (r: Response) => ({ status: r.status, data: await r.json().catch(() => null) })

// "MP3": cabeçalho ID3 + bytes; o conteúdo não importa para o servidor.
const mp3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, ...Array.from({ length: 990 }, (_, i) => i % 256)])
const upload = (u: User, songId: string, bytes: Uint8Array, name = 'guia.mp3') => {
  const f = new FormData()
  f.set('songId', songId)
  f.set('file', new File([bytes], name))
  return call(u, 'POST', '/audio', f)
}

let dono: User, outro: User
let songId: string

beforeAll(async () => {
  ;[dono, outro] = await Promise.all(['dono', 'outro'].map(signUp))
  songId = (await json(await call(dono, 'POST', '/songs', { title: `Guia ${run}` }))).data.id
})

afterAll(async () => {
  await client`delete from song where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('áudio guia', () => {
  let audioId: string
  it('o dono envia; formato estranho é recusado; outra pessoa não envia', async () => {
    const bad = await json(await upload(dono, songId, new Uint8Array(500).fill(7), 'virus.mp3'))
    expect(bad.status).toBe(400)
    expect((await upload(outro, songId, mp3)).status).toBe(403)
    const ok = await json(await upload(dono, songId, mp3))
    expect(ok.status).toBe(201)
    expect(ok.data).toMatchObject({ mimeType: 'audio/mpeg', sizeBytes: mp3.length })
    audioId = ok.data.id
  })

  it('serve o arquivo inteiro e por partes (Range); quem não vê a música recebe 404', async () => {
    const full = await call(dono, 'GET', `/audio/${audioId}/arquivo`)
    expect(full.status).toBe(200)
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(mp3)
    const part = await call(dono, 'GET', `/audio/${audioId}/arquivo`, undefined, { range: 'bytes=10-19' })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe(`bytes 10-19/${mp3.length}`)
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(mp3.slice(10, 20))
    expect((await call(outro, 'GET', `/audio/${audioId}/arquivo`)).status).toBe(404)
    expect((await call(outro, 'GET', `/audio/song/${songId}`)).status).toBe(404)
  })

  it('enviar de novo substitui; só o dono apaga', async () => {
    const again = await json(await upload(dono, songId, mp3, 'nova.mp3'))
    const info = await json(await call(dono, 'GET', `/audio/song/${songId}`))
    expect(info.data).toMatchObject({ canEdit: true, audio: { id: again.data.id, fileName: 'nova.mp3' } })
    expect((await call(dono, 'GET', `/audio/${audioId}/arquivo`)).status).toBe(404)
    expect((await call(outro, 'DELETE', `/audio/${again.data.id}`)).status).toBe(404)
    expect((await call(dono, 'DELETE', `/audio/${again.data.id}`)).status).toBe(204)
    expect((await json(await call(dono, 'GET', `/audio/song/${songId}`))).data.audio).toBeNull()
  })
})
