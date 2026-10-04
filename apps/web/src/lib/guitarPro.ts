// Suporte a arquivos Guitar Pro (.gp, .gp3, .gp4, .gp5, .gpx)
// Permite extrair cifras e metadados no importador e renderizar pautas visuais para partituras.
import type { ImportedSong } from '@ensaio/shared'
import type { SourcePage } from './scoreProcess'

const TARGET_PAGE_HEIGHT = 1900

interface AlphaTabModule {
  importer: {
    ScoreLoader: {
      loadScoreFromBytes: (data: Uint8Array, settings?: any) => any
    }
  }
  AlphaTabApi: any
  Settings: any
  LayoutMode: {
    Page: number
    Horizontal: number
  }
}

let alphaTabInstance: AlphaTabModule | null = null

/** Carrega o alphaTab sob demanda para não inflar o bundle inicial. */
export async function getAlphaTab(): Promise<AlphaTabModule | null> {
  if (alphaTabInstance) return alphaTabInstance
  try {
    const mod = await import('@coderline/alphatab')
    alphaTabInstance = mod as unknown as AlphaTabModule
    return alphaTabInstance
  } catch {
    return null
  }
}

/** Decodifica a armadura de clave (círculo de quintas) em nome do tom. */
function decodeKey(fifths: number, isMinor: boolean): string | null {
  const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
  const flatMajors = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭']
  const minors = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']
  const flatMinors = ['Am', 'Dm', 'Gm', 'Cm', 'Fm', 'B♭m', 'E♭m', 'A♭m']

  if (fifths >= 0 && fifths < majors.length) return isMinor ? minors[fifths] : majors[fifths]
  if (fifths < 0 && -fifths < flatMajors.length) return isMinor ? flatMinors[-fifths] : flatMajors[-fifths]
  return null
}

/** Traduz marcas de seção comuns para português. */
function formatSection(label: string): string {
  const clean = label.trim().replace(/:$/, '')
  const map: [RegExp, string][] = [
    [/^intro/i, 'Intro'],
    [/^verse/i, 'Verso'],
    [/^pre[\s-]?chorus/i, 'Pré-refrão'],
    [/^chorus/i, 'Refrão'],
    [/^bridge/i, 'Ponte'],
    [/^solo/i, 'Solo'],
    [/^outro|ending/i, 'Final'],
    [/^interlude/i, 'Interlúdio'],
  ]
  for (const [re, pt] of map) {
    if (re.test(clean)) return pt
  }
  return clean
}

/** Fallback em JavaScript puro para extrair metadados e letras de GP3, GP4 e GP5 diretamente do binário. */
function parseGuitarProBinaryFallback(buffer: ArrayBuffer, fileName: string): ImportedSong {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = 0

  const readByte = () => (offset < bytes.length ? bytes[offset++] : 0)
  const readInt = () => {
    if (offset + 4 > bytes.length) return 0
    const v = view.getInt32(offset, true)
    offset += 4
    return v
  }

  const readLenString = () => {
    const len = readInt()
    let s = ''
    for (let i = 0; i < len; i++) {
      const b = readByte()
      if (b > 0) s += String.fromCharCode(b)
    }
    return s.trim()
  }

  // Versão nos primeiros 31 bytes
  readByte() // tamanho
  let version = ''
  for (let i = 0; i < 30; i++) version += String.fromCharCode(readByte())

  let title = ''
  let subtitle = ''
  let artist = ''
  let album = ''
  let words = ''
  let music = ''
  let copyright = ''
  let tab = ''
  let instructions = ''
  const notices: string[] = []

  if (/FICHIER GUITAR PRO/i.test(version)) {
    title = readLenString()
    subtitle = readLenString()
    artist = readLenString()
    album = readLenString()
    words = readLenString()
    music = readLenString()
    copyright = readLenString()
    tab = readLenString()
    instructions = readLenString()

    const noticeCount = readInt()
    for (let i = 0; i < Math.min(noticeCount, 10); i++) {
      const n = readLenString()
      if (n) notices.push(n)
    }
  }

  // Tenta extrair letra de blocos do GP5
  let lyricsText = ''
  if (/v5/i.test(version) && offset + 20 < bytes.length) {
    try {
      readInt() // track associada
      for (let i = 0; i < 5; i++) {
        readInt() // compasso inicial
        const len = readInt()
        if (len > 0 && len < 20000 && offset + len <= bytes.length) {
          let chunk = ''
          for (let c = 0; c < len; c++) chunk += String.fromCharCode(readByte())
          if (chunk.trim()) lyricsText += (lyricsText ? '\n\n' : '') + chunk.trim()
        }
      }
    } catch {
      // Ignora erro no leitor binário fallback
    }
  }

  const cleanTitle = (title || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')).trim()

  let content = ''
  if (lyricsText) {
    content = `[Letra]\n${lyricsText}`
  } else if (notices.length > 0) {
    content = notices.join('\n')
  } else {
    content = `[Estrutura]\nArquivo ${version.trim() || 'Guitar Pro'} importado.\n(Para acordes e partituras completas, verifique se a biblioteca alphaTab foi instalada com "npm install").`
  }

  return {
    title: cleanTitle,
    artist: artist || null,
    composer: music || words || null,
    originalKey: null,
    bpm: null,
    timeSignature: null,
    content,
    format: 'guitarpro',
    warnings: ['Metadados lidos no modo básico. Para extração profunda de cifras de todos os compassos, rode "npm install".'],
  }
}

/** Converte arquivo Guitar Pro (.gp, .gp5, .gp4, .gp3, .gpx) para o modelo de música com cifras. */
export async function parseGuitarProSong(file: File): Promise<ImportedSong> {
  const buffer = await file.arrayBuffer()
  const at = await getAlphaTab()

  if (!at) {
    return parseGuitarProBinaryFallback(buffer, file.name)
  }

  try {
    const settings = new at.Settings()
    if (settings.core) settings.core.useWorkers = false
    const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buffer), settings)

    const title = (score.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')).trim()
    const artist = score.artist?.trim() || null
    const composer = score.music?.trim() || score.words?.trim() || null

    const firstMb = score.masterBars?.[0]
    const bpm = Math.round(score.tempo || firstMb?.tempoAutomations?.[0]?.value || 0) || null
    const timeSignature =
      firstMb && firstMb.timeSignatureNumerator && firstMb.timeSignatureDenominator
        ? `${firstMb.timeSignatureNumerator}/${firstMb.timeSignatureDenominator}`
        : null

    const key = firstMb && typeof firstMb.keySignature === 'number' ? decodeKey(firstMb.keySignature, firstMb.keySignatureType === 1) : null

    // Percorre compassos para montar as seções e acordes
    const sections: { title: string; lines: string[] }[] = []
    let currentSec: { title: string; lines: string[] } = { title: 'Intro', lines: [] }

    let totalChords = 0
    let currentBarChords: string[] = []

    const masterBars = score.masterBars || []

    for (let mbIdx = 0; mbIdx < masterBars.length; mbIdx++) {
      const mb = masterBars[mbIdx]
      if (mb.section) {
        if (currentBarChords.length > 0) {
          currentSec.lines.push(currentBarChords.join('  '))
          currentBarChords = []
        }
        if (currentSec.lines.length > 0) {
          sections.push(currentSec)
        }
        currentSec = { title: formatSection(mb.section.text || mb.section.marker || `Parte ${sections.length + 1}`), lines: [] }
      }

      // Procura acordes em todas as pistas para este compasso
      const barChordSet = new Set<string>()
      const tracks = score.tracks || []
      for (const t of tracks) {
        const staff = t.staves?.[0]
        const bar = staff?.bars?.[mbIdx]
        if (!bar) continue
        for (const voice of bar.voices || []) {
          for (const beat of voice.beats || []) {
            if (beat.chord?.name) {
              barChordSet.add(beat.chord.name.trim())
              totalChords++
            }
          }
        }
      }

      if (barChordSet.size > 0) {
        currentBarChords.push(Array.from(barChordSet).join(' '))
      } else {
        // Compasso vazio ou sem acorde definido
        currentBarChords.push('·')
      }

      // Quebra linhas de acordes a cada 4 compassos
      if (currentBarChords.length >= 4) {
        currentSec.lines.push(`| ${currentBarChords.join(' | ')} |`)
        currentBarChords = []
      }
    }

    if (currentBarChords.length > 0) {
      currentSec.lines.push(`| ${currentBarChords.join(' | ')} |`)
    }
    if (currentSec.lines.length > 0) {
      sections.push(currentSec)
    }

    let content = ''
    if (sections.length > 0 && totalChords > 0) {
      content = sections.map((s) => `[${s.title}]\n${s.lines.join('\n')}`).join('\n\n')
    } else {
      content = `[Estrutura]\n| C  G | Am  F |\n\n(A tablatura contém ${masterBars.length} compassos; os acordes podem ser preenchidos ou conferidos na partitura anexa).`
    }

    const warnings: string[] = []
    if (totalChords === 0) {
      warnings.push('Nenhum diagrama de acorde nomeado foi encontrado no arquivo Guitar Pro. Apenas notas de tablatura foram detectadas.')
    }

    return {
      title,
      artist,
      composer,
      originalKey: key,
      bpm,
      timeSignature,
      content,
      format: 'guitarpro',
      warnings,
    }
  } catch {
    return parseGuitarProBinaryFallback(buffer, file.name)
  }
}

/** Renderiza a partitura/tablatura do Guitar Pro em fatias/páginas de alta qualidade prontas para visualização. */
export async function readGuitarProScorePages(file: File): Promise<SourcePage[]> {
  const at = await getAlphaTab()
  if (!at) {
    throw new Error('A biblioteca @coderline/alphatab precisa ser instalada para ler partituras do Guitar Pro. Execute "npm install" no terminal.')
  }

  const buffer = await file.arrayBuffer()

  // Cria contêiner fora da tela para o alphaTab renderizar
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '1400px'
  container.style.background = '#ffffff'
  document.body.appendChild(container)

  let api: any = null

  try {
    const rendered = await new Promise<HTMLCanvasElement[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tempo limite excedido ao desenhar a partitura do Guitar Pro.'))
      }, 20000)

      try {
        api = new at.AlphaTabApi(container, {
          core: {
            engine: 'html5',
            useWorkers: false,
          },
          display: {
            layoutMode: at.LayoutMode.Page,
          },
          player: {
            enablePlayer: false,
          },
        })

        api.renderFinished.on(() => {
          clearTimeout(timeout)
          setTimeout(() => {
            const canvases = Array.from(container.querySelectorAll('canvas'))
            resolve(canvases as HTMLCanvasElement[])
          }, 100)
        })

        api.load(new Uint8Array(buffer))
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })

    if (!rendered || rendered.length === 0) {
      throw new Error('Não foi possível gerar as páginas visuais a partir deste arquivo Guitar Pro.')
    }

    // Se o alphaTab gerou um único canvas contínuo, fatia em páginas no padrão A4
    const pages: HTMLCanvasElement[] = []
    for (const canvas of rendered) {
      if (canvas.height <= TARGET_PAGE_HEIGHT) {
        pages.push(canvas)
      } else {
        // Fatiamento em alturas proporcionais
        let y = 0
        while (y < canvas.height) {
          const sliceH = Math.min(TARGET_PAGE_HEIGHT, canvas.height - y)
          const slice = document.createElement('canvas')
          slice.width = canvas.width
          slice.height = sliceH
          const ctx = slice.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, slice.width, slice.height)
          ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
          pages.push(slice)
          y += sliceH
        }
      }
    }

    return pages.map((pageCanvas, idx) => ({
      label: `${file.name} · pág. ${idx + 1}`,
      render: async (width: number) => {
        const scale = Math.min(1, width / pageCanvas.width)
        const out = document.createElement('canvas')
        out.width = Math.round(pageCanvas.width * scale)
        out.height = Math.round(pageCanvas.height * scale)
        const ctx = out.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.drawImage(pageCanvas, 0, 0, out.width, out.height)
        return out
      },
    }))
  } finally {
    if (api && typeof api.destroy === 'function') {
      try {
        api.destroy()
      } catch {
        // Ignora erro de limpeza
      }
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}
