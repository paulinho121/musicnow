// Remove BOM (EF BB BF) do início dos frames, preservando o conteúdo UTF-8.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const dir = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-parceiros/compositions/frames'
const files = [...readdirSync(dir).filter((f) => f.endsWith('.html')),
  '..', '../../index.html']

for (const file of files) {
  const p = file.startsWith('..') ? path.resolve(dir, file) : path.join(dir, file)
  let buf = readFileSync(p)
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.subarray(3)
    writeFileSync(p, buf)
    console.log(`BOM removido: ${path.basename(p)}`)
  } else {
    console.log(`já sem BOM: ${path.basename(p)}`)
  }
}
