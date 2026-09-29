import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db'

/** Pasta das migrações: ao lado do código em dev (src/..) e do bundle em produção (dist/..). */
export const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle')

export async function runMigrations() {
  await migrate(db, { migrationsFolder })
}
