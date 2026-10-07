// Lê o texto de um arquivo do Word (.docx) no próprio aparelho, sem biblioteca: o .docx é um
// .zip; tiramos dele o word/document.xml com o descompactador do navegador (deflate-raw).
import { docxParagraphs, splitSongBook, type ImportedSong } from '@ensaio/shared'

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Um arquivo de dentro do .zip (null se não existir). */
async function zipEntry(buf: ArrayBuffer, name: string): Promise<Uint8Array | null> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // Fim do diretório central: procura de trás para frente (pode ter comentário no fim).
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Arquivo do Word inválido ou corrompido.')
  const count = view.getUint16(eocd + 10, true)
  let ptr = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break
    const method = view.getUint16(ptr + 10, true)
    const compressed = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const local = view.getUint32(ptr + 42, true)
    const entryName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen))
    if (entryName === name) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
      const data = bytes.subarray(start, start + compressed)
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      throw new Error('Este arquivo do Word usa uma compressão que não conseguimos ler.')
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/** Caderno de cifras do Word → músicas (para a prévia do importador). */
export async function readSongBook(file: File): Promise<ImportedSong[]> {
  if (!('DecompressionStream' in window)) throw new Error('Atualize o navegador para importar arquivos do Word.')
  const xml = await zipEntry(await file.arrayBuffer(), 'word/document.xml')
  if (!xml) throw new Error('Não achamos o texto deste arquivo do Word.')
  return splitSongBook(docxParagraphs(new TextDecoder().decode(xml)))
}
