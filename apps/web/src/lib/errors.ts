// Avisa os erros das telas ao servidor (painel do administrador > Erros).
// Manda só a mensagem, a pilha, a tela e a versão: nunca o que a pessoa digitou.

const sent = new Map<string, number>()

/** Erros que não são do app (extensões do navegador, avisos inofensivos). */
function ignored(message: string, stack: string) {
  return (
    /ResizeObserver loop|Script error\.?$|AbortError|The user aborted|Load failed$/i.test(message) ||
    /(chrome|moz|safari)-extension:\/\//.test(stack)
  )
}

/** Versão nova publicada e a tela pediu um pedaço do app antigo que não existe mais. */
export const isChunkLoadError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    String((e as Error)?.message ?? e),
  )

export function reportError(error: unknown, context?: string) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))
  const message = `${context ? `${context}: ` : ''}${err.message || err.name || 'Erro desconhecido'}`
  const stack = err.stack ?? ''
  if (ignored(message, stack)) return
  // O mesmo erro no máximo 3 vezes por visita (um erro em loop não vira enxurrada).
  const n = (sent.get(message) ?? 0) + 1
  sent.set(message, n)
  if (n > 3) return
  const body = JSON.stringify({
    message: message.slice(0, 2000),
    stack: stack.slice(0, 10000) || null,
    url: location.pathname,
    release: __RELEASE__,
  })
  try {
    // sendBeacon chega mesmo se a página estiver fechando/recarregando.
    if (!navigator.sendBeacon?.('/api/errors', new Blob([body], { type: 'application/json' }))) throw new Error()
  } catch {
    fetch('/api/errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
  }
}

/** Erros que escapam de tudo (fora das telas, promessas sem tratamento). */
export function setupErrorReporting() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'Promessa sem tratamento'))
}
