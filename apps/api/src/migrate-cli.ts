// `npm run db:migrate`: aplica as migrações e sai.
// (Fica separado de migrate.ts: no bundle de produção tudo vira um arquivo só.)
import { client } from './db'
import { runMigrations } from './migrate'

runMigrations()
  .then(() => console.log('Migrações aplicadas.'))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => client.end())
