// Corrige o enquadramento vertical das cenas:
//  - Cena 5: sobe o celular e move o chip para ACIMA da zona de legenda (y <= 1600).
//  - Cenas 1, 3, 4: distribui o conteudo no terco superior/medio (nada abaixo de 1600).
//  - Cena 2: reduz os celulares para nao cortar.
// Grava em UTF-8 sem BOM.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/compositions/frames'
const rd = (f) => readFileSync(path.join(dir, f), 'utf8')
const wr = (f, s) => writeFileSync(path.join(dir, f), s, { encoding: 'utf8' })

// ---------------------------------------------------------------- S1: centralizar o bloco (nada abaixo de 1600)
let s1 = rd('s1-gancho.html')
s1 = s1.replace(
  'justify-content: center; align-items: flex-start; padding: 0 96px 300px 96px;',
  'justify-content: flex-start; align-items: flex-start; padding: 420px 96px 0 96px;',
)
wr('s1-gancho.html', s1)
console.log('s1: bloco subiu para o terco superior (seguro)')

// ---------------------------------------------------------------- S2: celulares menores, sem corte
let s2 = rd('s2-app.html')
s2 = s2.replace('.ph { width: 330px;', '.ph { width: 300px;')
s2 = s2.replace('.phones { position: absolute; left: 96px; bottom: 260px;', '.phones { position: absolute; left: 96px; bottom: 400px;')
s2 = s2.replace('padding: 300px 96px 0 96px;', 'padding: 250px 96px 0 96px;')
wr('s2-app.html', s2)
console.log('s2: celulares reduzidos e reposicionados')

// ---------------------------------------------------------------- S3: subir o bloco (seguro)
let s3 = rd('s3-beneficio.html')
s3 = s3.replace(
  'justify-content: center; padding: 0 96px 300px 96px;',
  'justify-content: flex-start; padding: 380px 96px 0 96px;',
)
wr('s3-beneficio.html', s3)
console.log('s3: bloco subiu (seguro)')

// ---------------------------------------------------------------- S4: subir o bloco (seguro)
let s4 = rd('s4-seguidores.html')
s4 = s4.replace(
  'justify-content: center; align-items: flex-start; padding: 0 96px 300px 96px;',
  'justify-content: flex-start; align-items: flex-start; padding: 460px 96px 0 96px;',
)
wr('s4-seguidores.html', s4)
console.log('s4: bloco subiu (seguro)')

// ---------------------------------------------------------------- S5: chip ACIMA da zona de legenda, celular melhor enquadrado
let s5 = rd('s5-painel.html')
s5 = s5.replace(
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 360px 96px 0 96px; }
    .kicker { align-self: flex-start; margin-bottom: 34px; }
    .phone { position: relative; width: 600px; border-radius: 50px; border: 8px solid #2A2E38; overflow: hidden; background: #16181E; }
    .phone img { display: block; width: 100%; height: auto; }
    .tag { position: absolute; left: 50%; transform: translateX(-50%); bottom: 250px; padding: 22px 40px; border-radius: 999px; background: #F5A524; color: #0E0F13; font-weight: 800; font-size: 40px; letter-spacing: -0.01em; }`,
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 190px 110px 0 110px; }
    .kicker { align-self: flex-start; margin-bottom: 26px; }
    .phone { position: relative; width: 470px; border-radius: 44px; border: 7px solid #2A2E38; overflow: hidden; background: #16181E; }
    .phone img { display: block; width: 100%; height: auto; }
    .tag { position: relative; margin-top: 30px; padding: 20px 38px; border-radius: 999px; background: #F5A524; color: #0E0F13; font-weight: 800; font-size: 36px; letter-spacing: -0.01em; text-align: center; }`,
)
// O chip sai do position absolute (bottom) e entra no fluxo, logo abaixo do celular => zona segura
wr('s5-painel.html', s5)
console.log('s5: chip movido para o fluxo (acima da zona de legenda) + celular menor')
