// Blocos do repertório (barzinho/baile) e a lista colada em texto.
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

let lider: User, musico: User, estranho: User
let setlistId: string

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

type Detail = {
  blocks: { id: string; name: string; style: string | null; bpm: number | null }[]
  items: { id: string; blockId: string | null; position: number; key: string | null; song: { title: string; originalKey: string | null } }[]
}
const detail = async () => (await call(lider, 'GET', `/setlists/${setlistId}`)).data as Detail
const titles = (d: Detail) => d.items.map((i) => i.song.title)

beforeAll(async () => {
  ;[lider, musico, estranho] = await Promise.all(['lider', 'musico', 'estranho'].map(signUp))
  // "Fada" já está na biblioteca do líder, em Sol: o repertório vai pedir em Lá.
  await call(lider, 'POST', '/songs', { title: 'Fada', originalKey: 'G', content: '[Intro] G D' })
  setlistId = (await call(lider, 'POST', '/setlists', { name: `Baile ${run}`, status: 'ensaio' })).data.id
  const inv = await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

describe('lista colada em texto', () => {
  it('cria os blocos, acha a música da biblioteca e cria as que faltam', async () => {
    const r = await call(lider, 'POST', `/setlists/${setlistId}/import-text`, {
      text: 'REPERTÓRIO\nBLOCO 1 (Ballada 3 - 80)\n• Programa de fim de semana - C\n• Inevitável - C\n\nBLOCO 2 (Marília - 130)\n• Largado às traças - A\n• fada - A\n',
    })
    expect(r.status).toBe(201)
    expect(r.data).toMatchObject({ songs: 4, blocks: 2, found: 1 })
    expect(r.data.created).toEqual(['Programa de fim de semana', 'Inevitável', 'Largado às traças'])

    const d = await detail()
    expect(d.blocks.map((b) => [b.name, b.style, b.bpm])).toEqual([
      ['Bloco 1', 'Ballada 3', 80],
      ['Bloco 2', 'Marília', 130],
    ])
    expect(titles(d)).toEqual(['Programa de fim de semana', 'Inevitável', 'Largado às traças', 'Fada'])
    expect(d.items.map((i) => i.position)).toEqual([0, 1, 2, 3])
    // Fada é a do líder (em G); o repertório toca em A.
    const fada = d.items[3]
    expect(fada.song.originalKey).toBe('G')
    expect(fada.key).toBe('A')
    expect(fada.blockId).toBe(d.blocks[1].id)
    // A criada já nasce no tom da lista (sem precisar transpor).
    expect(d.items[0]).toMatchObject({ key: null, song: { originalKey: 'C' } })
  })
})

describe('organizar blocos', () => {
  it('música nova entra no fim do bloco escolhido', async () => {
    const d = await detail()
    const song = (await call(lider, 'POST', '/songs', { title: `Extra ${run}` })).data.id
    const r = await call(lider, 'POST', `/setlists/${setlistId}/items`, { songId: song, blockId: d.blocks[0].id })
    expect(r.status).toBe(201)
    expect(titles(await detail())).toEqual(['Programa de fim de semana', 'Inevitável', `Extra ${run}`, 'Largado às traças', 'Fada'])
  })

  it('troca a ordem dos blocos e move música de um bloco para outro', async () => {
    const d = await detail()
    const [b1, b2] = d.blocks
    const ids = (t: string) => d.items.find((i) => i.song.title === t)!.id
    const r = await call(lider, 'PUT', `/setlists/${setlistId}/order`, {
      layout: [
        { blockId: b2.id, itemIds: [ids('Fada'), ids('Largado às traças'), ids(`Extra ${run}`)] },
        { blockId: b1.id, itemIds: [ids('Programa de fim de semana'), ids('Inevitável')] },
      ],
    })
    expect(r.status).toBe(200)
    const after = await detail()
    expect(after.blocks.map((b) => b.name)).toEqual(['Bloco 2', 'Bloco 1'])
    expect(titles(after)).toEqual(['Fada', 'Largado às traças', `Extra ${run}`, 'Programa de fim de semana', 'Inevitável'])
    expect(after.items[2].blockId).toBe(b2.id)
  })

  it('apagar o bloco mantém as músicas no repertório, sem bloco', async () => {
    const d = await detail()
    const b1 = d.blocks.find((b) => b.name === 'Bloco 1')!
    expect((await call(lider, 'DELETE', `/setlists/${setlistId}/blocks/${b1.id}`)).status).toBe(204)
    const after = await detail()
    expect(after.blocks.map((b) => b.name)).toEqual(['Bloco 2'])
    expect(after.items).toHaveLength(5)
    // Sem bloco vem primeiro.
    expect(titles(after).slice(0, 2)).toEqual(['Programa de fim de semana', 'Inevitável'])
    expect(after.items[0].blockId).toBeNull()
  })

  it('editar o bloco', async () => {
    const b = (await detail()).blocks[0]
    expect((await call(lider, 'PUT', `/setlists/${setlistId}/blocks/${b.id}`, { name: 'Marília', style: 'Sertanejo', bpm: 128 })).status).toBe(200)
    expect((await detail()).blocks[0]).toMatchObject({ name: 'Marília', style: 'Sertanejo', bpm: 128 })
  })
})

describe('permissões', () => {
  it('quem só vê não mexe nos blocos; quem não participa nem sabe que existe', async () => {
    expect((await call(musico, 'POST', `/setlists/${setlistId}/blocks`, { name: 'X' })).status).toBe(403)
    expect((await call(musico, 'POST', `/setlists/${setlistId}/import-text`, { text: 'Fada - A' })).status).toBe(403)
    expect((await call(estranho, 'POST', `/setlists/${setlistId}/blocks`, { name: 'X' })).status).toBe(404)
    const view = await call(musico, 'GET', `/setlists/${setlistId}`)
    expect(view.data.blocks).toHaveLength(1)
  })
})
