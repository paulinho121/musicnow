// Análise de áudio fora da tela principal: a página continua respondendo
// enquanto uma música inteira é processada.
import { analyzeAudio } from '@ensaio/shared'

self.onmessage = (e: MessageEvent<Float32Array>) => {
  try {
    const result = analyzeAudio(e.data, (p) => self.postMessage({ type: 'progress', p }))
    self.postMessage({ type: 'done', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message })
  }
}
