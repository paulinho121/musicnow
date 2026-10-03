// Dados de demonstração. Rode com: npm run db:seed (é seguro rodar mais de uma vez).
//
// Contas de teste (a senha vem de SEED_PASSWORD no .env; nunca fica no código):
//   lider@demo.ensaiofacil.app    Marina Costa   — líder de louvor, dona das músicas
//   baixista@demo.ensaiofacil.app Rafael Lima    — baixista
//   cantora@demo.ensaiofacil.app  Júlia Andrade  — cantora
//
// Letras: "Amazing Grace" e "When the Saints Go Marching In" são de domínio público.
// As demais são composições originais escritas para este demo.
import { normalizeSearch } from '@ensaio/shared'
import { hashPassword } from 'better-auth/crypto'
import { and, eq } from 'drizzle-orm'
import { auth } from './auth'
import { client, db, schema } from './db'

const PASSWORD = process.env.SEED_PASSWORD ?? ''
if (PASSWORD.length < 12) {
  console.error('Defina SEED_PASSWORD (mínimo 12 caracteres) no .env para criar as contas de demonstração.')
  process.exit(1)
}

const people = [
  {
    email: 'lider@demo.ensaiofacil.app',
    name: 'Marina Costa',
    role: 'lider' as const,
    city: 'Fortaleza, CE',
    instruments: [{ instrument: 'violao' as const, primary: true }, { instrument: 'voz' as const, primary: false }],
  },
  {
    email: 'baixista@demo.ensaiofacil.app',
    name: 'Rafael Lima',
    role: 'musico' as const,
    city: 'Fortaleza, CE',
    instruments: [{ instrument: 'baixo' as const, primary: true }],
  },
  {
    email: 'cantora@demo.ensaiofacil.app',
    name: 'Júlia Andrade',
    role: 'artista' as const,
    city: 'Recife, PE',
    instruments: [{ instrument: 'voz' as const, primary: true }, { instrument: 'teclado' as const, primary: false }],
  },
]

type SongSeed = Omit<typeof schema.song.$inferInsert, 'ownerId' | 'searchText'>

const songs: SongSeed[] = [
  {
    title: 'Amazing Grace',
    artist: 'Hino tradicional',
    composer: 'John Newton (1779)',
    originalKey: 'G',
    bpm: 76,
    timeSignature: '3/4',
    style: 'Hino',
    tags: ['hino', 'domínio público', 'ceia'],
    lyricsAuthorized: true,
    visibility: 'private',
    notes: 'Domínio público. Começar só com violão; banda entra na segunda estrofe.',
    content: `[Intro] G  C/G  G  D

[Verso 1]
G              G7        C        G
Amazing grace, how sweet the sound
G                   Em       A7     D
That saved a wretch like me
G            G7         C          G
I once was lost, but now am found
G         Em      D       G
Was blind, but now I see

[Verso 2]
G                 G7          C         G
'Twas grace that taught my heart to fear
G                  Em      A7      D
And grace my fears relieved
G              G7         C        G
How precious did that grace appear
G        Em      D        G
The hour I first believed

[Final] G  C/G  G`,
  },
  {
    title: 'Luz da Manhã',
    artist: 'Ministério Ensaio Fácil (demo)',
    composer: 'Composição original para demonstração',
    originalKey: 'D',
    bpm: 72,
    timeSignature: '4/4',
    style: 'Louvor',
    tags: ['adoração', 'abertura', 'lenta'],
    lyricsAuthorized: true,
    visibility: 'private',
    notes: 'Primeiro verso só teclado e voz. Subir a dinâmica na ponte.',
    content: `[Intro] D  A/C#  Bm  G  (x2)

[Verso 1]
D                A/C#
Quando a luz da manhã
        Bm            G
Toca o chão da minha casa
D                 A/C#
Eu me lembro de cantar
        Bm          G
Que a esperança não passa

[Pré-refrão]
Em7            G
Tudo o que eu sou
Em7          A4   A
Volta pra Te louvar

[Refrão]
D            A
Luz da manhã, acende em mim
Bm           G
Canção que não tem fim
D            A
Luz da manhã, eu sigo em paz
Bm          G         A    D
Teu amor me leva mais

[Ponte]
G       A       Bm
Mais alto, mais perto
G       A       D
Meu coração aberto
G       A       Bm    A/C#
Mais alto, mais perto
G       A
(banda toda)

[Final] D  A/C#  Bm  G  D`,
  },
  {
    title: 'Tudo Tem Seu Tempo',
    artist: 'Júlia Andrade (demo)',
    composer: 'Composição original para demonstração',
    originalKey: 'C',
    bpm: 68,
    timeSignature: '4/4',
    style: 'Balada',
    tags: ['voz e violão', 'lenta'],
    lyricsAuthorized: true,
    visibility: 'private',
    content: `[Intro] C  G/B  Am7  F7M

[Verso]
C              G/B
Tem hora de plantar
Am7              F7M
Tem hora de esperar
C              G/B
O rio sabe o caminho
Am7            F7M     G4  G
Sem pressa de chegar

[Refrão]
F7M       G        Em7     Am7
Tudo tem seu tempo, tudo tem lugar
F7M       G         C   C/E
Deixa o vento soprar
F7M       G        Em7     Am7
Tudo tem seu tempo, eu vou te esperar
Dm7        G4     G    C
Até o dia clarear

[Final] F7M  G  C`,
  },
  {
    title: 'Estrada de Terra',
    artist: 'Trio Sertão (demo)',
    composer: 'Composição original para demonstração',
    originalKey: 'E',
    bpm: 118,
    timeSignature: '2/4',
    style: 'Forró',
    tags: ['bar', 'animada', 'xote'],
    lyricsAuthorized: true,
    visibility: 'private',
    notes: 'Sanfona puxa a intro. Parada seca antes do último refrão.',
    content: `[Intro] E  B7  E  B7  E

[Verso]
E                    B7
Peguei a estrada de terra
                     E
Levando a viola no peito
                     B7
A lua subiu na serra
                      E
E o céu ficou do meu jeito

[Refrão]
A              E
Ai, ai, poeira no chão
B7                 E
Saudade no coração
A              E
Ai, ai, forró no salão
B7                 E
Eu vou com você, meu bem

[Solo] E  B7  E  B7  A  E  B7  E`,
  },
  {
    title: 'Noite na Cidade',
    artist: 'Banda Avenida (demo)',
    composer: 'Composição original para demonstração',
    originalKey: 'Am',
    bpm: 104,
    timeSignature: '4/4',
    style: 'Pop rock',
    tags: ['bar', 'rock'],
    lyricsAuthorized: true,
    visibility: 'private',
    content: `[Intro] Am  F  C  G

[Verso]
Am                 F
As luzes da avenida
C                  G
Pintam a madrugada
Am                   F
Ninguém tem hora certa
C              G
Ninguém tem mais nada

[Refrão]
F        G         Am
É noite na cidade
F        G          C
E a gente é de verdade
F        G         Am   Am/G
É noite na cidade
F               G
Ninguém quer ir embora

[Solo] Am  F  C  G  (x2)

[Final] F  G  Am`,
  },
  {
    title: 'When the Saints Go Marching In',
    artist: 'Tradicional',
    composer: 'Spiritual tradicional (domínio público)',
    originalKey: 'F',
    bpm: 120,
    timeSignature: '4/4',
    style: 'Gospel',
    tags: ['domínio público', 'animada', 'metais'],
    lyricsAuthorized: true,
    visibility: 'private',
    content: `[Intro] F  C7  F

[Verso]
F
Oh when the saints go marching in
                           C7
Oh when the saints go marching in
        F           F7         Bb
Oh Lord I want to be in that number
        F         C7        F
When the saints go marching in`,
  },
  {
    title: 'Blues em Lá (12 compassos)',
    artist: 'Base instrumental',
    composer: 'Progressão tradicional',
    originalKey: 'A',
    bpm: 90,
    timeSignature: '12/8',
    style: 'Blues',
    tags: ['instrumental', 'jam', 'bar'],
    visibility: 'private',
    notes: 'Shuffle. Cada acorde = 1 compasso. Solos em rodízio: guitarra, teclado, baixo.',
    content: `[Intro] E7

[Verso]
| A7   | D7   | A7   | A7   |
| D7   | D7   | A7   | A7   |
| E7   | D7   | A7   | E7   |

[Final]
| E7   | D7   | A7  D7  | A7(13) |`,
  },
  {
    title: 'Bossa em Ré menor',
    artist: 'Base instrumental',
    composer: 'Estudo de ii–V–i',
    originalKey: 'Dm',
    bpm: 132,
    timeSignature: '4/4',
    style: 'Bossa nova',
    tags: ['instrumental', 'estudo', 'jazz'],
    visibility: 'private',
    content: `[Parte A]
| Dm7(9)   | Dm7(9)   | Em7(b5)  A7(b13) | Dm7(9) |
| Gm7      | C7(9)    | F7M              | Bb7M   |
| Em7(b5)  | A7(b9)   | Dm7(9)           | A7(b13) |

[Final]
| Dm6(9)   |`,
  },
  {
    title: 'Rascunho: música nova da Marina',
    artist: 'Marina Costa',
    originalKey: 'G',
    bpm: 80,
    timeSignature: '4/4',
    style: 'Louvor',
    tags: ['rascunho'],
    visibility: 'private',
    notes: 'Só eu vejo esta música até terminar a letra.',
    content: `[Intro] G  D/F#  Em  C

[Verso]
G          D/F#
(letra em construção)
Em         C`,
  },
]

const PUBLIC_DOMAIN = new Set(['Amazing Grace', 'When the Saints Go Marching In', 'Blues em Lá (12 compassos)'])

async function ensureUser(p: (typeof people)[number]) {
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, p.email))
  const id = existing
    ? existing.id
    : (await auth.api.signUpEmail({ body: { name: p.name, email: p.email, password: PASSWORD } })).user.id
  // Conta já existente: garante que a senha é a do SEED_PASSWORD atual.
  if (existing) {
    await db
      .update(schema.account)
      .set({ password: await hashPassword(PASSWORD) })
      .where(and(eq(schema.account.userId, id), eq(schema.account.providerId, 'credential')))
  }
  await db
    .insert(schema.profile)
    .values({ userId: id, role: p.role, city: p.city })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { role: p.role, city: p.city } })
  await db.delete(schema.userInstrument).where(eq(schema.userInstrument.userId, id))
  await db.insert(schema.userInstrument).values(p.instruments.map((i) => ({ ...i, userId: id })))
  return id
}

async function main() {
  const [leaderId, bassId, singerId] = await Promise.all(people.map(ensureUser))

  const ids: Record<string, string> = {}
  for (const s0 of songs) {
    const s = {
      ...s0,
      license: PUBLIC_DOMAIN.has(s0.title) ? ('public_domain' as const) : s0.visibility === 'public' ? ('own' as const) : ('unknown' as const),
    }
    const searchText = normalizeSearch(
      [s.title, s.artist, s.composer, s.style, s.originalKey, ...(s.tags ?? [])].filter(Boolean).join(' '),
    )
    const [existing] = await db
      .select({ id: schema.song.id })
      .from(schema.song)
      .where(and(eq(schema.song.ownerId, leaderId), eq(schema.song.title, s.title)))
    if (existing) {
      await db.update(schema.song).set({ ...s, searchText }).where(eq(schema.song.id, existing.id))
      ids[s.title] = existing.id
    } else {
      const [row] = await db
        .insert(schema.song)
        .values({ ...s, ownerId: leaderId, searchText })
        .returning({ id: schema.song.id })
      ids[s.title] = row.id
    }
  }

  // Favoritos, tom pessoal e histórico para a tela inicial não ficar vazia.
  const fav = (userId: string, title: string) =>
    db.insert(schema.favorite).values({ userId, songId: ids[title] }).onConflictDoNothing()
  await fav(leaderId, 'Luz da Manhã')
  await fav(leaderId, 'Amazing Grace')
  await fav(bassId, 'Blues em Lá (12 compassos)')
  await fav(singerId, 'Tudo Tem Seu Tempo')

  const view = (userId: string, title: string, minutesAgo: number, personalKey?: string) =>
    db
      .insert(schema.songUserState)
      .values({
        userId,
        songId: ids[title],
        lastViewedAt: new Date(Date.now() - minutesAgo * 60_000),
        viewCount: 1,
        personalKey,
      })
      .onConflictDoNothing()
  await view(leaderId, 'Luz da Manhã', 30)
  await view(leaderId, 'Estrada de Terra', 60 * 5)
  await view(leaderId, 'Noite na Cidade', 60 * 26)
  // A cantora canta "Luz da Manhã" um tom abaixo, sem alterar a música original.
  await view(singerId, 'Luz da Manhã', 45, 'C')

  // Marcações de exemplo (linhas contadas a partir de 0).
  const luz = ids['Luz da Manhã']
  const hasMarks = await db.select({ id: schema.songMark.id }).from(schema.songMark).where(eq(schema.songMark.songId, luz)).limit(1)
  if (!hasMarks.length) {
    await db.insert(schema.songMark).values([
      { songId: luz, authorId: leaderId, lineIndex: 2, type: 'entrada', text: 'Só teclado e voz no primeiro verso', shared: true },
      { songId: luz, authorId: leaderId, lineIndex: 18, type: 'dinamica', text: 'Entrar com todos no refrão', shared: true },
      { songId: luz, authorId: leaderId, lineIndex: 28, type: 'dinamica', text: 'Subir a dinâmica na ponte', shared: true },
      { songId: luz, authorId: bassId, lineIndex: 18, type: 'nota', text: 'Baixo: tônica em semínimas', instrument: 'baixo', shared: false },
    ])
  }

  // Repertório de demonstração: a Marina lidera; Rafael marca; Júlia sugere.
  const SETLIST = 'Culto de domingo (demo)'
  let [demoSetlist] = await db
    .select({ id: schema.setlist.id })
    .from(schema.setlist)
    .where(and(eq(schema.setlist.ownerId, leaderId), eq(schema.setlist.name, SETLIST)))
  if (!demoSetlist) {
    const nextSunday = new Date()
    nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7))
    nextSunday.setHours(19, 0, 0, 0)
    ;[demoSetlist] = await db
      .insert(schema.setlist)
      .values({
        ownerId: leaderId,
        name: SETLIST,
        eventDate: nextSunday,
        location: 'Igreja Central, Fortaleza',
        groupName: 'Ministério de Louvor',
        notes: 'Chegar 18h para passagem de som. Ceia após a terceira música.',
        status: 'ensaio',
      })
      .returning({ id: schema.setlist.id })
    const order: [string, string | null, string | null][] = [
      ['Luz da Manhã', 'C', 'Abertura: começar só teclado e voz'],
      ['Tudo Tem Seu Tempo', null, null],
      ['Amazing Grace', 'A', 'Momento da ceia, bem suave'],
      ['When the Saints Go Marching In', null, 'Encerramento com metais'],
    ]
    const items = await db
      .insert(schema.setlistItem)
      .values(order.map(([title, key, notes], position) => ({ setlistId: demoSetlist.id, songId: ids[title], position, key, notes })))
      .returning({ id: schema.setlistItem.id, songId: schema.setlistItem.songId })
    await db.insert(schema.setlistMember).values([
      { setlistId: demoSetlist.id, userId: bassId, permission: 'mark', instrument: 'baixo' },
      { setlistId: demoSetlist.id, userId: singerId, permission: 'suggest', instrument: 'voz' },
    ])
    await db.insert(schema.songMark).values({
      songId: ids['Luz da Manhã'],
      setlistId: demoSetlist.id,
      authorId: bassId,
      lineIndex: 28,
      type: 'parada',
      text: 'Parada da banda no fim da ponte (só neste culto)',
      shared: true,
    })
    const tudo = items.find((i) => i.songId === ids['Tudo Tem Seu Tempo'])!
    await db.insert(schema.setlistSuggestion).values({
      setlistId: demoSetlist.id,
      itemId: tudo.id,
      authorId: singerId,
      proposedKey: 'Bb',
      message: 'Em C fica alto para mim no refrão. Pode ser Bb?',
    })
    await db.insert(schema.changeLog).values({ entityType: 'setlist', entityId: demoSetlist.id, userId: leaderId, action: 'create' })
  }

  console.log(`Seed concluído: ${people.length} usuários, ${songs.length} músicas, 1 repertório.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => client.end())
