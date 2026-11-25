// Zerar os dados ("configuração de fábrica"): apaga o conteúdo da pessoa e deixa a conta como
// nova, com a música de exemplo. Ficam: login, perfil, assinatura, parceria, página da banda e
// a participação em repertórios de outras pessoas (o que é dos outros não muda).
import { and, eq, isNull } from 'drizzle-orm'
import { handOverSongsInOthersSetlists } from './account-delete'
import { db, schema } from './db'
import { createWelcomeSong } from './welcome-song'

const { setlist, song, gig, favorite, songUserState, songMark, unavailability, profile } = schema

export async function resetAccountData(userId: string) {
  // Músicas suas no repertório de outra pessoa viram cópia dela (o show dos outros não quebra).
  await handOverSongsInOthersSetlists(userId)
  await db.transaction(async (tx) => {
    // Repertórios levam junto (em cascata) músicas da lista, convidados, escala, ensaios e marcações da banda.
    await tx.delete(setlist).where(eq(setlist.ownerId, userId))
    await tx.delete(gig).where(eq(gig.userId, userId))
    await tx.delete(song).where(eq(song.ownerId, userId))
    await tx.delete(favorite).where(eq(favorite.userId, userId))
    await tx.delete(songUserState).where(eq(songUserState.userId, userId))
    // Só as marcações pessoais: as feitas no repertório de outra banda são da banda.
    await tx.delete(songMark).where(and(eq(songMark.authorId, userId), isNull(songMark.setlistId)))
    await tx.delete(unavailability).where(eq(unavailability.userId, userId))
    await tx.update(profile).set({ viewerPrefs: {} }).where(eq(profile.userId, userId))
  })
  // Os arquivos (partituras, áudios) sem música ficam para as rotinas de limpeza.
  await createWelcomeSong(userId).catch((e) => console.error('Zerar dados: falha ao recriar a música de exemplo', e))
}
