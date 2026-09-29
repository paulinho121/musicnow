// Gera um único arquivo dist/index.js com todas as dependências.
// Assim a VM só precisa do Node: nada de `npm install` lá (a Micro tem 1 GB de RAM).
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  minify: false,
  legalComments: 'none',
  // Pacotes CommonJS dentro de um bundle ESM precisam de `require`.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
})

console.log('API empacotada em dist/index.js')
