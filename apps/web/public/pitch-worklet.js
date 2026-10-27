// Muda o tom do áudio em tempo real, sem mudar a velocidade (Sala de ensaio).
// Vocoder de fase: a cada 512 amostras analisa uma janela de 2048 (FFT), desloca as
// frequências pelo fator de tom e sintetiza de volta (sobreposição de 4 janelas).
// Cada nota ocupa várias faixas em volta de um pico: a faixa inteira anda junto com o pico
// e mantém a fase relativa a ele (phase locking). Sem isso, as faixas da mesma nota saem
// fora de fase e se cancelam (o volume cai em alguns tons).
// A velocidade fica com o próprio <audio> (playbackRate com preservesPitch).

const N = 2048
const HOP = N / 4
const OSAMP = N / HOP
const HALF = N / 2
const EXPECT = (2 * Math.PI * HOP) / N
const TWO_PI = 2 * Math.PI

const WINDOW = new Float32Array(N)
for (let i = 0; i < N; i++) WINDOW[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / N)

// FFT complexa radix-2, no lugar. sign = -1 (direta) ou 1 (inversa, sem dividir por N).
const BITS = Math.log2(N)
const REV = new Uint32Array(N)
for (let i = 0; i < N; i++) {
  let r = 0
  for (let b = 0; b < BITS; b++) r |= ((i >> b) & 1) << (BITS - 1 - b)
  REV[i] = r
}
function fft(re, im, sign) {
  for (let i = 0; i < N; i++) {
    const j = REV[i]
    if (j > i) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1
    const step = (sign * TWO_PI) / size
    for (let start = 0; start < N; start += size) {
      for (let k = 0; k < half; k++) {
        const a = step * k
        const wr = Math.cos(a)
        const wi = Math.sin(a)
        const i = start + k
        const j = i + half
        const tr = re[j] * wr - im[j] * wi
        const ti = re[j] * wi + im[j] * wr
        re[j] = re[i] - tr
        im[j] = im[i] - ti
        re[i] += tr
        im[i] += ti
      }
    }
  }
}

function channelState() {
  return {
    inFifo: new Float32Array(N),
    outFifo: new Float32Array(N),
    accum: new Float32Array(2 * N),
    lastPhase: new Float32Array(HALF + 1),
    sumPhase: new Float32Array(HALF + 1),
    anaMag: new Float32Array(HALF + 1),
    anaPhase: new Float32Array(HALF + 1),
    anaFreq: new Float32Array(HALF + 1),
    synMag: new Float32Array(HALF + 1),
    synPhase: new Float32Array(HALF + 1),
    peaks: new Int32Array(HALF + 1),
    re: new Float32Array(N),
    im: new Float32Array(N),
    rover: N - HOP,
  }
}

/** Uma janela: análise, deslocamento das frequências e síntese (soma em accum). */
function processFrame(s, ratio) {
  const { re, im } = s
  for (let k = 0; k < N; k++) {
    re[k] = s.inFifo[k] * WINDOW[k]
    im[k] = 0
  }
  fft(re, im, -1)
  for (let k = 0; k <= HALF; k++) {
    const mag = 2 * Math.hypot(re[k], im[k])
    const phase = Math.atan2(im[k], re[k])
    let d = phase - s.lastPhase[k]
    s.lastPhase[k] = phase
    d -= k * EXPECT
    // Volta a diferença para [-π, π].
    d -= TWO_PI * Math.round(d / TWO_PI)
    s.anaMag[k] = mag
    s.anaPhase[k] = phase
    s.anaFreq[k] = k + (OSAMP * d) / TWO_PI
  }
  s.synMag.fill(0)
  s.synPhase.fill(0)
  // Picos (máximos locais) do espectro: cada um é o centro de uma nota ou harmônico.
  const mag = s.anaMag
  let np = 0
  for (let k = 1; k < HALF; k++) {
    if (mag[k] > 1e-6 && mag[k] > mag[k - 1] && mag[k] >= mag[k + 1]) s.peaks[np++] = k
  }
  const TWO_PI_H_N = (TWO_PI * HOP) / N
  for (let i = 0; i < np; i++) {
    const p = s.peaks[i]
    // Região do pico: até o ponto mais baixo entre ele e os picos vizinhos.
    let lo = 0
    if (i > 0) {
      lo = s.peaks[i - 1]
      for (let k = s.peaks[i - 1]; k <= p; k++) if (mag[k] < mag[lo]) lo = k
      lo += 1
    }
    let hi = HALF
    if (i < np - 1) {
      hi = p
      for (let k = p; k <= s.peaks[i + 1]; k++) if (mag[k] < mag[hi]) hi = k
    }
    const pOut = Math.round(p * ratio)
    if (pOut < 1 || pOut > HALF) continue
    // O pico avança a fase na frequência nova; a região mantém a fase relativa a ele.
    s.sumPhase[pOut] += TWO_PI_H_N * s.anaFreq[p] * ratio
    const base = s.sumPhase[pOut]
    const shift = pOut - p
    for (let k = lo; k <= hi; k++) {
      const out = k + shift
      if (out < 0 || out > HALF) continue
      s.synMag[out] += mag[k]
      s.synPhase[out] = base + (s.anaPhase[k] - s.anaPhase[p])
    }
  }
  for (let k = 0; k <= HALF; k++) {
    re[k] = s.synMag[k] * Math.cos(s.synPhase[k])
    im[k] = s.synMag[k] * Math.sin(s.synPhase[k])
  }
  for (let k = HALF + 1; k < N; k++) {
    re[k] = 0
    im[k] = 0
  }
  fft(re, im, 1)
  // Com as faixas em fase, a nota soma ~√2 mais forte: compensa para manter o volume original.
  const scale = (2 / (HALF * OSAMP)) * Math.SQRT1_2
  for (let k = 0; k < N; k++) s.accum[k] += scale * WINDOW[k] * re[k]
  for (let k = 0; k < HOP; k++) s.outFifo[k] = s.accum[k]
  s.accum.copyWithin(0, HOP)
  s.accum.fill(0, 2 * N - HOP)
  s.inFifo.copyWithin(0, HOP)
}

class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }]
  }

  constructor() {
    super()
    this.channels = []
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    const ratio = parameters.ratio[0]
    for (let c = 0; c < output.length; c++) {
      const src = input[c] ?? input[0]
      const dst = output[c]
      if (!src) {
        dst.fill(0)
        continue
      }
      // Sem mudança de tom: passa direto (sem atraso nem efeito).
      if (Math.abs(ratio - 1) < 1e-4) {
        dst.set(src)
        continue
      }
      const s = (this.channels[c] ??= channelState())
      for (let i = 0; i < src.length; i++) {
        s.inFifo[s.rover] = src[i]
        dst[i] = s.outFifo[s.rover - (N - HOP)]
        s.rover++
        if (s.rover >= N) {
          s.rover = N - HOP
          processFrame(s, ratio)
        }
      }
    }
    return true
  }
}

registerProcessor('pitch-shifter', PitchShifter)
