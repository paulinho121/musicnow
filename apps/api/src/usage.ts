// Prova social das cifras: "usada por 9 músicos em 23 repertórios".
// Conta cada entrada de uma música num repertório (uma vez por repertório, mesmo que ela saia
// e volte) e só quando o repertório é de OUTRA pessoa — a dona não infla a própria música.
import { eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from './db'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
const { song, songUsage, setlist } = schema

/** Registra que estas músicas entraram no repertório e atualiza os contadores delas. */
export async function recordSongUsage(tx: Tx | typeof db, setlistId: string, songIds: string[]) {
  const unique = [...new Set(songIds)]
  if (!unique.length) return
  // Quem conta é o dono do repertório (quem adiciona pode ser alguém que ajuda a administrar).
  const [s] = await tx.select({ ownerId: setlist.ownerId }).from(setlist).where(eq(setlist.id, setlistId))
  if (!s) return
  const setlistOwnerId = s.ownerId
  const inserted = await tx
    .insert(songUsage)
    .values(unique.map((songId) => ({ songId, setlistId, setlistOwnerId })))
    .onConflictDoNothing()
    .returning({ songId: songUsage.songId })
  if (!inserted.length) return
  await tx
    .update(song)
    .set({
      usageSetlists: sql`(select count(*)::int from ${songUsage} u where u.song_id = ${song.id} and u.setlist_owner_id <> ${song.ownerId})`,
      usagePeople: sql`(select count(distinct u.setlist_owner_id)::int from ${songUsage} u where u.song_id = ${song.id} and u.setlist_owner_id <> ${song.ownerId})`,
    })
    .where(
      inArray(
        song.id,
        inserted.map((r) => r.songId),
      ),
    )
}
