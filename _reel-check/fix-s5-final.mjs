import { readFileSync, writeFileSync } from 'node:fs'
const p = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/compositions/frames/s5-painel.html'
let s = readFileSync(p, 'utf8')
s = s.replace('padding: 190px 110px 0 110px;', 'padding: 150px 120px 0 120px;')
s = s.replace('.phone { position: relative; width: 470px;', '.phone { position: relative; width: 440px;')
s = s.replace('.tag { position: relative; margin-top: 30px;', '.tag { position: relative; margin-top: 26px;')
writeFileSync(p, s, { encoding: 'utf8' })
console.log('s5: celular 440px, topo 150px => chip em ~1180px (bem dentro da zona segura)')
