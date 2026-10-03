// Música de boas-vindas: toda conta nova começa com UMA música, que é o próprio
// passo a passo de como cadastrar as músicas. Ela é privada e da pessoa: dá para
// editar, transpor e apagar como qualquer outra.
import { normalizeSearch } from '@ensaio/shared'
import { db, schema } from './db'

export const WELCOME_TITLE = 'Comece aqui: como adicionar suas músicas'

const CONTENT = `[Intro] C  G  Am  F

[Passo 1 - Criar a música]
C                    G
Toque em Músicas e depois em + Nova
Am                   F
Preencha o título, o artista e o tom

[Passo 2 - Escrever a cifra]
C                   G
Escreva os acordes na linha de cima
Am                  F
e a letra na linha de baixo, assim
C                 G
Cada acorde fica em cima da sílaba
Am                  F
onde ele entra, como nesta música

[Passo 3 - Separar as partes]
C                     G
Escreva o nome da parte entre colchetes,
Am                F
como Verso, Refrão, Ponte ou Final
C                   G
Elas viram atalhos no topo da tela

[Passo 4 - Já tem a cifra pronta?]
C                      G
Use Importar: cole o texto copiado
Am                    F
ou envie arquivos ChordPro e OnSong

[Passo 5 - Na hora de tocar]
C                       G
Use - e + lá embaixo para mudar o tom
Am                    F
e o botão Play para rolar sozinho
C                        G
Toque em qualquer acorde e veja
Am                 F
como montar no violão e no teclado

[Final] C  G  C
`

/** Cria a música de exemplo na biblioteca de quem acabou de criar a conta. */
export async function createWelcomeSong(userId: string) {
  const song = {
    title: WELCOME_TITLE,
    artist: 'Ensaio Fácil',
    originalKey: 'C',
    bpm: 90,
    timeSignature: '4/4',
    style: 'Tutorial',
    notes: 'Música de exemplo com o passo a passo. Quando não precisar mais, apague em Editar.',
    tags: ['exemplo'],
  }
  await db.insert(schema.song).values({
    ...song,
    ownerId: userId,
    content: CONTENT,
    visibility: 'private',
    license: 'own',
    lyricsAuthorized: true,
    searchText: normalizeSearch([song.title, song.artist, song.style, song.originalKey, ...song.tags].join(' ')),
  })
}
