// Corrige: (a) id="bg" em todos os frames; (b) layout da cena 2 (sem sobreposição);
// (c) cena 5 (kicker fora da zona do celular). Grava em UTF-8 sem BOM.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/compositions/frames'
const rd = (f) => readFileSync(path.join(dir, f), 'utf8')
const wr = (f, s) => writeFileSync(path.join(dir, f), s, { encoding: 'utf8' })

// (a) id no background de todos os frames
for (const f of ['s1-gancho.html', 's2-app.html', 's3-beneficio.html', 's4-seguidores.html', 's5-painel.html', 's6-cta.html']) {
  let s = rd(f)
  s = s.replace('<div class="clip bg" data-start=', '<div id="bg" class="clip bg" data-start=')
  wr(f, s)
  console.log(`${f}: id="bg" adicionado`)
}

// (b) Cena 2 — reestruturar: texto/features em cima; dois celulares lado a lado embaixo (zonas separadas)
let s2 = rd('s2-app.html')
s2 = s2.replace(
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 96px 300px 96px; }
    .kicker { margin-bottom: 40px; }
    .title { font-weight: 800; font-size: 92px; line-height: 1.04; letter-spacing: -0.04em; margin-bottom: 46px; }
    .ph { position: relative; width: 340px; border-radius: 40px; border: 6px solid #2A2E38; overflow: hidden; background: #16181E; }
    .ph img { display: block; width: 100%; height: auto; }
    .phones { position: absolute; right: 60px; top: 300px; display: flex; flex-direction: column; gap: 26px; align-items: flex-end; }
    .feat { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; font-weight: 700; font-size: 52px; letter-spacing: -0.02em; }
    .feat .ic { width: 74px; height: 74px; border-radius: 20px; background: rgba(245,165,36,.13); border: 2px solid rgba(245,165,36,.4); display: grid; place-items: center; color: #F5A524; font-family: 'JetBrains Mono Variable', monospace; font-weight: 800; font-size: 30px; flex: 0 0 74px; }`,
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; padding: 300px 96px 0 96px; }
    .kicker { margin-bottom: 30px; }
    .title { font-weight: 800; font-size: 88px; line-height: 1.04; letter-spacing: -0.04em; margin-bottom: 40px; }
    .ph { width: 330px; border-radius: 38px; border: 6px solid #2A2E38; overflow: hidden; background: #16181E; }
    .ph img { display: block; width: 100%; height: auto; }
    .phones { position: absolute; left: 96px; bottom: 260px; display: flex; gap: 26px; align-items: flex-end; }
    .feat { display: flex; align-items: center; gap: 20px; margin-bottom: 26px; font-weight: 700; font-size: 50px; letter-spacing: -0.02em; }
    .feat .ic { width: 70px; height: 70px; border-radius: 19px; background: rgba(245,165,36,.13); border: 2px solid rgba(245,165,36,.4); display: grid; place-items: center; color: #F5A524; font-family: 'JetBrains Mono Variable', monospace; font-weight: 800; font-size: 28px; flex: 0 0 70px; }`,
)
s2 = s2.replace(
  `    <div id="phones" class="clip phones" data-layout-allow-overflow data-start="0" data-duration="6" data-track-index="2">
      <div id="p1" class="ph"><img src="assets/03-cifra-G.png" alt=""></div>
      <div id="p2" class="ph"><img src="assets/07-modo-palco.png" alt=""></div>
    </div>`,
  `    <div id="phones" class="clip phones" data-layout-allow-overflow data-start="0" data-duration="6" data-track-index="2">
      <div id="p1" class="ph"><img src="assets/03-cifra-G.png" alt=""></div>
      <div id="p2" class="ph"><img src="assets/07-modo-palco.png" alt=""></div>
    </div>`,
)
wr('s2-app.html', s2)
console.log('s2-app.html: layout reestruturado (features em cima, celulares embaixo, sem sobreposição)')

// (c) Cena 5 — kicker dentro do fluxo, acima do celular (não posicionado por cima)
let s5 = rd('s5-painel.html')
s5 = s5.replace(
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; padding-bottom: 260px; }
    .kicker { position: absolute; left: 96px; top: 300px; }
    .phone { position: relative; width: 620px; border-radius: 52px; border: 8px solid #2A2E38; overflow: hidden; background: #16181E; margin-top: 40px; }`,
  `    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 360px 96px 0 96px; }
    .kicker { align-self: flex-start; margin-bottom: 34px; }
    .phone { position: relative; width: 600px; border-radius: 50px; border: 8px solid #2A2E38; overflow: hidden; background: #16181E; }`,
)
wr('s5-painel.html', s5)
console.log('s5-painel.html: kicker movido para o fluxo, acima do celular')
