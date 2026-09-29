import type { SetlistRole } from '@ensaio/shared'
import { and, eq } from 'drizzle-orm'
import { db, schema } from './db'

const { setlist, setlistMember } = schema

/** Papel da pessoa no repertório (dono, admin, marcar, sugerir, ver) ou null se ela não participa. */
export async function getRole(setlistId: string, userId: string): Promise<{ role: SetlistRole; ownerId: string } | null> {
  const [row] = await db
    .select({ ownerId: setlist.ownerId, permission: setlistMember.permission })
    .from(setlist)
    .leftJoin(setlistMember, and(eq(setlistMember.setlistId, setlist.id), eq(setlistMember.userId, userId)))
    .where(eq(setlist.id, setlistId))
  if (!row) return null
  if (row.ownerId === userId) return { role: 'owner', ownerId: row.ownerId }
  if (row.permission) return { role: row.permission, ownerId: row.ownerId }
  return null
}
