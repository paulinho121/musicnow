// Testes de permissões dos repertórios: o dono, músicos com cada nível e um estranho.
// Rodam contra o banco de desenvolvimento e apagam tudo o que criam no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { name: string; cookie: string; id: string }

async function call(u: User | null, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(u ? { cookie: u.cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(name: string): Promise<User> {
  const email = `${name}-${run}@${DOMAIN}`
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: `senha-${run}-${name}` }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const { user } = await res.json()
  return { name, cookie, id: user.id }
}

let dono: User, musico: User, estranho: User, outro: User
let songId: string, setlistId: string, itemId: string

beforeAll(async () => {
  ;[dono, musico, estranho, outro] = await Promise.all(['dono', 'musico', 'estranho', 'outro'].map(signUp))
  // Música PRIVADA do dono, com letra sem autorização de exibição.
  const s = await call(dono, 'POST', '/songs', {
    title: `Teste ${run}`,
    content: '[Refrão]\nC     G\nLetra secreta\nAm    F\nOutra linha',
    lyricsAuthorized: false,
    visibility: 'private',
  })
  songId = s.data.id
  const sl = await call(dono, 'POST', '/setlists', { name: `Culto ${run}`, status: 'ensaio' })
  setlistId = sl.data.id
  itemId = (await call(dono, 'POST', `/setlists/${setlistId}/items`, { songId, key: 'D' })).data.id
})

afterAll(async () => {
  // Apaga as contas de teste; o banco remove em cascata músicas, repertórios e convites.
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('quem não participa', () => {
  it('não vê o repertório nem a música privada (404, sem revelar que existem)', async () => {
    expect((await call(estranho, 'GET', `/setlists/${setlistId}`)).status).toBe(404)
    expect((await call(estranho, 'GET', `/songs/${songId}`)).status).toBe(404)
    expect((await call(null, 'GET', `/setlists/${setlistId}`)).status).toBe(401)
  })
  it('não aparece na lista dele', async () => {
    const list = await call(estranho, 'GET', '/setlists')
    expect(list.data.map((s: { id: string }) => s.id)).not.toContain(setlistId)
  })
})

describe('convite e permissão de visualizar', () => {
  let code: string
  it('o dono gera convite e o músico entra', async () => {
    const inv = await call(dono, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
    expect(inv.status).toBe(201)
    code = inv.data.code
    expect(code).toMatch(/^[A-Z2-9]{8}$/)
    const preview = await call(musico, 'GET', `/invites/${code}`)
    expect(preview.data).toMatchObject({ name: `Culto ${run}`, permission: 'view', songCount: 1, alreadyMember: false })
    expect((await call(musico, 'POST', `/invites/${code}/accept`)).status).toBe(201)
    // Aceitar de novo não duplica nem gasta outro uso.
    expect((await call(musico, 'POST', `/invites/${code}/accept`)).data.alreadyMember).toBe(true)
  })

  it('o músico vê o repertório e a música, mas sem a letra não autorizada', async () => {
    const sl = await call(musico, 'GET', `/setlists/${setlistId}`)
    expect(sl.status).toBe(200)
    expect(sl.data.role).toBe('view')
    expect(sl.data.items[0]).toMatchObject({ key: 'D', song: { id: songId } })
    expect(sl.data.invites).toEqual([]) // convites só para quem administra
    const song = await call(musico, 'GET', `/songs/${songId}?setlistId=${setlistId}`)
    expect(song.status).toBe(200)
    expect(song.data.lyricsHidden).toBe(true)
    expect(song.data.content).not.toContain('Letra secreta')
    expect(song.data.content).toContain('C     G')
    expect(song.data.canShareMarks).toBe(false)
  })

  it('não edita, não duplica, não convida e não sugere', async () => {
    expect((await call(musico, 'POST', `/setlists/${setlistId}/items`, { songId })).status).toBe(403)
    expect((await call(musico, 'PUT', `/setlists/${setlistId}/items/${itemId}`, { key: 'E' })).status).toBe(403)
    expect((await call(musico, 'POST', `/setlists/${setlistId}/duplicate`, {})).status).toBe(403)
    expect((await call(musico, 'POST', `/setlists/${setlistId}/invites`, {})).status).toBe(403)
    expect((await call(musico, 'POST', `/setlists/${setlistId}/suggestions`, { message: 'oi' })).status).toBe(403)
    expect((await call(musico, 'DELETE', `/setlists/${setlistId}`)).status).toBe(403)
  })

  it('marcação pessoal sim; compartilhada não', async () => {
    const base = { lineIndex: 1, type: 'nota', text: 'minha nota', setlistId }
    expect((await call(musico, 'POST', `/songs/${songId}/marks`, { ...base, shared: true })).status).toBe(403)
    expect((await call(musico, 'POST', `/songs/${songId}/marks`, { ...base, shared: false })).status).toBe(201)
    // A marcação pessoal do músico não aparece para o dono.
    const donoVe = await call(dono, 'GET', `/songs/${songId}?setlistId=${setlistId}`)
    expect(donoVe.data.marks.map((m: { text: string }) => m.text)).not.toContain('minha nota')
  })

  it('convite revogado ou de uso único não serve para outra pessoa', async () => {
    const unico = await call(dono, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view', maxUses: 1 })
    expect((await call(estranho, 'POST', `/invites/${unico.data.code}/accept`)).status).toBe(201)
    expect((await call(outro, 'POST', `/invites/${unico.data.code}/accept`)).status).toBe(404)
    const rev = await call(dono, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
    await call(dono, 'DELETE', `/setlists/${setlistId}/invites/${rev.data.id}`)
    expect((await call(outro, 'GET', `/invites/${rev.data.code}`)).status).toBe(404)
    // estranho entrou pelo convite de uso único: sai do repertório por conta própria.
    expect((await call(estranho, 'DELETE', `/setlists/${setlistId}/members/${estranho.id}`)).status).toBe(204)
    expect((await call(estranho, 'GET', `/setlists/${setlistId}`)).status).toBe(404)
  })
})

describe('níveis acima', () => {
  it('com "marcar", cria marcação que a banda vê só dentro do repertório', async () => {
    expect((await call(dono, 'PUT', `/setlists/${setlistId}/members/${musico.id}`, { permission: 'mark' })).status).toBe(200)
    const m = await call(musico, 'POST', `/songs/${songId}/marks`, {
      lineIndex: 1,
      type: 'dinamica',
      text: 'banda toda aqui',
      shared: true,
      setlistId,
    })
    expect(m.status).toBe(201)
    const noRepertorio = await call(dono, 'GET', `/songs/${songId}?setlistId=${setlistId}`)
    expect(noRepertorio.data.marks.map((x: { text: string }) => x.text)).toContain('banda toda aqui')
    const foraDele = await call(dono, 'GET', `/songs/${songId}`)
    expect(foraDele.data.marks.map((x: { text: string }) => x.text)).not.toContain('banda toda aqui')
  })

  it('"sugerir" propõe um tom e, ao aceitar, o tom é aplicado', async () => {
    const s = await call(musico, 'POST', `/setlists/${setlistId}/suggestions`, { itemId, proposedKey: 'C', message: 'Mais confortável' })
    expect(s.status).toBe(201)
    const ver = await call(dono, 'GET', `/setlists/${setlistId}`)
    expect(ver.data.suggestions.map((x: { id: string }) => x.id)).toContain(s.data.id)
    const revAntes = ver.data.revision
    expect((await call(dono, 'PUT', `/setlists/${setlistId}/suggestions/${s.data.id}`, { status: 'accepted' })).status).toBe(200)
    const depois = await call(musico, 'GET', `/setlists/${setlistId}`)
    expect(depois.data.items[0].key).toBe('C')
    expect(depois.data.revision).toBeGreaterThan(revAntes)
    // Não dá para responder duas vezes.
    expect((await call(dono, 'PUT', `/setlists/${setlistId}/suggestions/${s.data.id}`, { status: 'rejected' })).status).toBe(409)
  })

  it('só o dono dá "administrar"; admin não remove o dono', async () => {
    const inv = await call(dono, 'POST', `/setlists/${setlistId}/invites`, { permission: 'admin' })
    await call(outro, 'POST', `/invites/${inv.data.code}/accept`)
    const outroVe = await call(outro, 'GET', `/setlists/${setlistId}`)
    expect(outroVe.data.role).toBe('admin')
    // admin edita o repertório...
    expect((await call(outro, 'PUT', `/setlists/${setlistId}/items/${itemId}`, { key: 'Bb' })).status).toBe(200)
    // ...mas não promove ninguém a admin, não convida admin e não remove o dono.
    expect((await call(outro, 'PUT', `/setlists/${setlistId}/members/${musico.id}`, { permission: 'admin' })).status).toBe(403)
    expect((await call(outro, 'POST', `/setlists/${setlistId}/invites`, { permission: 'admin' })).status).toBe(403)
    expect((await call(outro, 'DELETE', `/setlists/${setlistId}/members/${dono.id}`)).status).toBe(403)
    expect((await call(outro, 'DELETE', `/setlists/${setlistId}`)).status).toBe(403)
  })

  it('reordenar com lista desatualizada é recusado', async () => {
    expect((await call(dono, 'PUT', `/setlists/${setlistId}/order`, { itemIds: [] })).status).toBe(409)
    expect((await call(dono, 'PUT', `/setlists/${setlistId}/order`, { itemIds: [itemId] })).status).toBe(200)
  })

  it('duplicar como versão mantém as músicas e aponta para o original', async () => {
    const d = await call(dono, 'POST', `/setlists/${setlistId}/duplicate`, { asVersion: true })
    expect(d.status).toBe(201)
    const v = await call(dono, 'GET', `/setlists/${d.data.id}`)
    expect(v.data.parent).toMatchObject({ id: setlistId })
    expect(v.data.items).toHaveLength(1)
    // A cópia é só do dono: os músicos do original não entram nela.
    expect((await call(musico, 'GET', `/setlists/${d.data.id}`)).status).toBe(404)
  })

  it('o histórico registra as alterações', async () => {
    const h = await call(musico, 'GET', `/setlists/${setlistId}/history`)
    const actions = h.data.map((x: { action: string }) => x.action)
    expect(actions).toEqual(expect.arrayContaining(['create', 'add_song', 'join', 'accept_suggestion', 'reorder']))
  })
})

describe('marcações fora de repertório', () => {
  it('em música pública de outra pessoa, só marcação pessoal', async () => {
    const pub = await call(dono, 'POST', `/songs`, {
      title: `Pública ${run}`,
      content: 'G D\nletra',
      visibility: 'public',
      license: 'own',
      lyricsAuthorized: true,
    })
    const alvo = pub.data.id
    expect((await call(estranho, 'POST', `/songs/${alvo}/marks`, { lineIndex: 0, type: 'nota', text: 'spam', shared: true })).status).toBe(403)
    expect((await call(estranho, 'POST', `/songs/${alvo}/marks`, { lineIndex: 0, type: 'nota', text: 'só minha', shared: false })).status).toBe(201)
    const donoVe = await call(dono, 'GET', `/songs/${alvo}`)
    expect(donoVe.data.marks.map((m: { text: string }) => m.text)).not.toContain('só minha')
  })
})
