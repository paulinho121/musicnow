import { SAMPLE_RATE, type AudioAnalysis } from '@ensaio/shared'

/** Limite do protótipo: músicas de até 10 minutos. */
export const MAX_SECONDS = 10 * 60

/**
 * Decodifica qualquer áudio que o navegador entenda (mp3, m4a, wav, ogg, webm...)
 * e converte para mono em SAMPLE_RATE. A conversão de taxa é feita pelo próprio
 * navegador (com filtro anti-aliasing), sem enviar nada para fora do aparelho.
 */
export async function decodeToMono(data: ArrayBuffer): Promise<{ samples: Float32Array; duration: number }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(data)
  } catch {
    throw new Error('Não foi possível ler este arquivo de áudio. Tente MP3, M4A ou WAV.')
  } finally {
    void ctx.close()
  }
  const duration = Math.min(decoded.duration, MAX_SECONDS)
  const offline = new OfflineAudioContext(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination) // estéreo → mono: o navegador soma os canais
  src.start(0, 0, duration)
  const rendered = await offline.startRendering()
  return { samples: rendered.getChannelData(0), duration: decoded.duration }
}

/** Roda a análise num Web Worker, com progresso de 0 a 1. */
export function analyzeInWorker(samples: Float32Array, onProgress: (p: number) => void): Promise<AudioAnalysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const msg = e.data as { type: string; p?: number; result?: AudioAnalysis; message?: string }
      if (msg.type === 'progress') onProgress(msg.p ?? 0)
      else {
        worker.terminate()
        if (msg.type === 'done') resolve(msg.result!)
        else reject(new Error(msg.message ?? 'Falha na análise.'))
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Falha na análise.'))
    }
    // Transfere o buffer (sem copiar): áudio de alguns minutos tem dezenas de MB.
    worker.postMessage(samples, [samples.buffer])
  })
}

/** Gravação pelo microfone, sem os filtros de voz do navegador (que estragam música). */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não permite gravar pelo microfone.')
  const stream = await navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .catch(() => {
      throw new Error('Sem acesso ao microfone. Libere a permissão do microfone para este site.')
    })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.start(1000)
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}
