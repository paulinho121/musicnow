import { readFileSync, writeFileSync } from 'node:fs'
const p = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/compositions/frames/s5-painel.html'
let s = readFileSync(p, 'utf8')
// Celular maior (ocupa melhor o quadro) e chip proporcional.
s = s.replace('padding: 150px 120px 0 120px;', 'padding: 140px 100px 0 100px;')
s = s.replace('.phone { position: relative; width: 440px;', '.phone { position: relative; width: 560px;')
s = s.replace('.tag { position: relative; margin-top: 26px; padding: 20px 38px; border-radius: 999px; background: #F5A524; color: #0E0F13; font-weight: 800; font-size: 36px;', '.tag { position: relative; margin-top: 30px; padding: 22px 40px; border-radius: 999px; background: #F5A524; color: #0E0F13; font-weight: 800; font-size: 38px;')
writeFileSync(p, s, { encoding: 'utf8' })
console.log('s5: celular 560px, chip 38px, topo 140px')
