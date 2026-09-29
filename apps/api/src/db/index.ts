import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

// A VM tem 1 GB de RAM e o Postgres aceita 30 conexões: um pool pequeno basta.
export const client = postgres(env.DATABASE_URL, { max: 5, onnotice: () => {} })
export const db = drizzle(client, { schema, casing: 'snake_case' })
export { schema }
