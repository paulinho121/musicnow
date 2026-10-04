import { serve } from '@hono/node-server'
import { app } from './app'
import { startCoverWorker } from './covers'
import { startScoreSweeper } from './routes/scores'
import { client } from './db'
import { env } from './env'
import { runMigrations } from './migrate'

await runMigrations()
// Preenche as capas das músicas aos poucos, em segundo plano.
startCoverWorker()
// Remove do disco partituras de músicas/contas apagadas.
startScoreSweeper()

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '127.0.0.1' }, (info) => {
  console.log(`API do Ensaio Fácil em http://127.0.0.1:${info.port}`)
})

// Encerramento limpo (systemd envia SIGTERM ao reiniciar o serviço).
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close()
    client.end({ timeout: 5 }).finally(() => process.exit(0))
  })
}
