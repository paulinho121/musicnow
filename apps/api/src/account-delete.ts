// Excluir a conta (LGPD): o Better Auth confere a senha e apaga o usuário; o banco apaga em
// cascata músicas, repertórios, marcações, perfil etc. Antes disso, aqui:
//  1. músicas da pessoa que estão em repertórios de OUTRAS pessoas viram uma cópia de cada
//     dono de repertório (sem o nome de quem saiu), para não quebrar o show de ninguém;
//  2. a assinatura no Asaas é cancelada, para não cobrar mais nada.
// Os arquivos (partituras, imagens do início) são apagados pelas rotinas de limpeza.
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db, schema } from './db'
import { env } from './env'

const { setlist, setlistItem, song, songMark, billingAccount } = schema

export async function handOverSongsInOthersSetlists(userId: string) {
  return db.transaction(async (tx) => {
    const uses = await tx
      .selectDistinct({ songId: setlistItem.songId, owner: setlist.ownerId })
      .from(setlistItem)
      .innerJoin(setlist, eq(setlist.id, setlistItem.setlistId))
      .innerJoin(song, eq(song.id, setlistItem.songId))
      .where(and(eq(song.ownerId, userId), ne(setlist.ownerId, userId)))

    for (const { songId, owner } of uses) {
      const [orig] = await tx.select().from(song).where(eq(song.id, songId))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, updatedAt, shareCode, usageSetlists, usagePeople, ...content } = orig
      const [copy] = await tx
        .insert(song)
        .values({ ...content, ownerId: owner, visibility: 'private' })
        .returning({ id: song.id })
      const ownerSetlists = tx.select({ id: setlist.id }).from(setlist).where(eq(setlist.ownerId, owner))
      await tx
        .update(setlistItem)
        .set({ songId: copy.id })
        .where(and(eq(setlistItem.songId, songId), inArray(setlistItem.setlistId, ownerSetlists)))
      // Marcações da banda feitas nesses repertórios acompanham a cópia.
      await tx
        .update(songMark)
        .set({ songId: copy.id })
        .where(and(eq(songMark.songId, songId), inArray(songMark.setlistId, ownerSetlists)))
    }
    return uses.length
  })
}

export async function cancelBillingOnDelete(userId: string) {
  const [acc] = await db.select().from(billingAccount).where(eq(billingAccount.userId, userId))
  if (!acc?.asaasSubscriptionId || !env.ASAAS_API_KEY) return
  const { cancelSubscription } = await import('./billing')
  // Se o Asaas estiver fora do ar, não impede a exclusão: fica registrado para cancelar à mão.
  await cancelSubscription(userId).catch((e) =>
    console.error(`Excluir conta: cancelar no Asaas a assinatura ${acc.asaasSubscriptionId} à mão`, e),
  )
}

export async function beforeDeleteAccount(userId: string) {
  await cancelBillingOnDelete(userId)
  await handOverSongsInOthersSetlists(userId)
}
