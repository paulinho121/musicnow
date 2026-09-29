import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
if (!/_dev\b/.test(process.env.DATABASE_URL ?? '')) {
  // Proteção: os testes criam e apagam contas; nunca podem rodar contra a produção.
  throw new Error('Os testes da API só rodam contra o banco de desenvolvimento (ensaio_facil_dev).')
}
