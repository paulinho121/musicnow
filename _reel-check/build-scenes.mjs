// Gera as 6 cenas do reel ensaio-facil-parceiros em UTF-8 sem BOM.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/compositions/frames'

const FONTS = `
    @font-face { font-family: 'Inter Variable'; font-weight: 100 900; src: url('assets/fonts/captured-inter-latin-wght-normal-Dx4kXJAl.woff2') format('woff2-variations'); }
    @font-face { font-family: 'JetBrains Mono Variable'; font-weight: 100 800; src: url('assets/fonts/captured-jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2') format('woff2-variations'); }
    #root { position: absolute; inset: 0; overflow: hidden; font-family: 'Inter Variable', sans-serif; color: #ECEEF3; }
    .bg { position: absolute; inset: 0; background: #0E0F13; }
    .kicker { font-family: 'JetBrains Mono Variable', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; font-size: 32px; color: #F5A524; }
    .or { color: #F5A524; }`

const gsap = `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>`

// ---------------------------------------------------------------- S1 — Gancho
const s1 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 96px 300px 96px; }
    .kicker { margin-bottom: 60px; }
    .line { font-weight: 800; font-size: 120px; line-height: 1.04; letter-spacing: -0.04em; margin-bottom: 22px; }
    .dim { color: #6B7280; }
  </style>
  <div id="root" data-composition-id="s1-gancho" data-width="1080" data-height="1920" data-duration="3">
    <div class="clip bg" data-start="0" data-duration="3" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="3" data-track-index="1">
      <div id="kicker" class="kicker">/ você já indica?</div>
      <div id="l1" class="line">você já</div>
      <div id="l2" class="line">indica o app</div>
      <div id="l3" class="line">pra seus amigos</div>
      <div id="l4" class="line dim">músicos?</div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s1-gancho"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#kicker'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#l1'), { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.out' }, 0.35);
      tl.fromTo(q('#l2'), { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.out' }, 0.85);
      tl.fromTo(q('#l3'), { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.out' }, 1.35);
      tl.fromTo(q('#l4'), { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1, duration: 0.34, ease: 'power4.out' }, 1.9);
      window.__timelines['s1-gancho'] = tl;
    })();
  </script>
</template>`

// ---------------------------------------------------------------- S2 — O app
const s2 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 96px 300px 96px; }
    .kicker { margin-bottom: 40px; }
    .title { font-weight: 800; font-size: 92px; line-height: 1.04; letter-spacing: -0.04em; margin-bottom: 46px; }
    .ph { position: relative; width: 340px; border-radius: 40px; border: 6px solid #2A2E38; overflow: hidden; background: #16181E; }
    .ph img { display: block; width: 100%; height: auto; }
    .phones { position: absolute; right: 60px; top: 300px; display: flex; flex-direction: column; gap: 26px; align-items: flex-end; }
    .feat { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; font-weight: 700; font-size: 52px; letter-spacing: -0.02em; }
    .feat .ic { width: 74px; height: 74px; border-radius: 20px; background: rgba(245,165,36,.13); border: 2px solid rgba(245,165,36,.4); display: grid; place-items: center; color: #F5A524; font-family: 'JetBrains Mono Variable', monospace; font-weight: 800; font-size: 30px; flex: 0 0 74px; }
  </style>
  <div id="root" data-composition-id="s2-app" data-width="1080" data-height="1920" data-duration="6">
    <div class="clip bg" data-start="0" data-duration="6" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="6" data-track-index="1">
      <div id="kicker" class="kicker">/ o app</div>
      <div id="title" class="title">o Ensaio <span class="or">Fácil</span></div>
      <div id="f1" class="feat"><span class="ic">&#9835;</span><span>cifra em qualquer tom</span></div>
      <div id="f2" class="feat"><span class="ic">&#9998;</span><span>repertório colando a lista</span></div>
      <div id="f3" class="feat"><span class="ic">&#9654;</span><span>modo palco, ao vivo</span></div>
    </div>
    <div id="phones" class="clip phones" data-layout-allow-overflow data-start="0" data-duration="6" data-track-index="2">
      <div id="p1" class="ph"><img src="assets/03-cifra-G.png" alt=""></div>
      <div id="p2" class="ph"><img src="assets/07-modo-palco.png" alt=""></div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s2-app"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#kicker'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#title'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.4);
      ['#f1', '#f2', '#f3'].forEach(function (s, i) {
        tl.fromTo(q(s), { opacity: 0, x: -46 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 1.0 + i * 0.55);
      });
      tl.fromTo(q('#p1'), { opacity: 0, y: 70, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }, 0.5);
      tl.fromTo(q('#p2'), { opacity: 0, y: 70, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }, 2.6);
      window.__timelines['s2-app'] = tl;
    })();
  </script>
</template>`

// ---------------------------------------------------------------- S3 — O benefício
const s3 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 96px 300px 96px; }
    .kicker { margin-bottom: 40px; }
    .pct { font-weight: 800; font-size: 330px; line-height: 0.86; letter-spacing: -0.06em; color: #F5A524; }
    .pctlabel { font-weight: 700; font-size: 60px; letter-spacing: -0.02em; margin-top: 6px; }
    .ex { margin-top: 58px; border-top: 2px solid #2A2E38; padding-top: 30px; }
    .exline { font-size: 46px; color: #C9CDD6; line-height: 1.5; }
    .exline b { color: #ECEEF3; font-weight: 700; }
    .gain { font-weight: 800; font-size: 82px; letter-spacing: -0.03em; color: #F5A524; margin-top: 10px; }
    .note { margin-top: 46px; font-family: 'JetBrains Mono Variable', monospace; font-weight: 500; letter-spacing: 0.08em; font-size: 30px; color: #9AA1B1; }
  </style>
  <div id="root" data-composition-id="s3-beneficio" data-width="1080" data-height="1920" data-duration="8">
    <div class="clip bg" data-start="0" data-duration="8" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="8" data-track-index="1">
      <div id="kicker" class="kicker">/ o que você ganha</div>
      <div id="pct" class="pct">50%</div>
      <div id="pctlabel" class="pctlabel">do primeiro pagamento</div>
      <div id="ex" class="ex">
        <div id="ex1" class="exline">plano anual <b>R$ 149</b></div>
        <div id="ex2" class="gain">você ganha R$ 74,50</div>
      </div>
      <div id="note" class="note">por assinatura nova · não é recorrente</div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s3-beneficio"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#kicker'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#pct'), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }, 0.4);
      tl.fromTo(q('#pctlabel'), { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 1.1);
      tl.fromTo(q('#ex'), { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power3.out' }, 2.2);
      tl.fromTo(q('#ex1'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 2.5);
      tl.fromTo(q('#ex2'), { opacity: 0, scale: 1.15 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power4.out' }, 3.3);
      tl.fromTo(q('#note'), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power3.out' }, 4.3);
      window.__timelines['s3-beneficio'] = tl;
    })();
  </script>
</template>`

// ---------------------------------------------------------------- S4 — Seguidores
const s4 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 96px 300px 96px; }
    .kicker { margin-bottom: 46px; }
    .big { font-weight: 800; font-size: 132px; line-height: 0.98; letter-spacing: -0.05em; }
    .sub { margin-top: 40px; font-weight: 700; font-size: 56px; letter-spacing: -0.02em; color: #C9CDD6; }
    .cupom { margin-top: 54px; display: inline-flex; align-items: center; gap: 18px; padding: 26px 44px; border-radius: 999px; border: 3px solid rgba(245,165,36,.55); background: rgba(245,165,36,.1); font-family: 'JetBrains Mono Variable', monospace; font-weight: 800; font-size: 58px; letter-spacing: 0.06em; color: #F5A524; }
  </style>
  <div id="root" data-composition-id="s4-seguidores" data-width="1080" data-height="1920" data-duration="4">
    <div class="clip bg" data-start="0" data-duration="4" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="4" data-track-index="1">
      <div id="kicker" class="kicker">/ pra quem te segue</div>
      <div id="big" class="big"><span class="or">30 dias</span> grátis</div>
      <div id="sub" class="sub">com o seu cupom</div>
      <div id="cupom" class="cupom">SEUCUPOM &#8594; 30 dias</div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s4-seguidores"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#kicker'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#big'), { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.36, ease: 'power4.out' }, 0.4);
      tl.fromTo(q('#sub'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 1.0);
      tl.fromTo(q('#cupom'), { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out' }, 1.6);
      window.__timelines['s4-seguidores'] = tl;
    })();
  </script>
</template>`

// ---------------------------------------------------------------- S5 — Painel
const s5 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; padding-bottom: 260px; }
    .kicker { position: absolute; left: 96px; top: 300px; }
    .phone { position: relative; width: 620px; border-radius: 52px; border: 8px solid #2A2E38; overflow: hidden; background: #16181E; margin-top: 40px; }
    .phone img { display: block; width: 100%; height: auto; }
    .tag { position: absolute; left: 50%; transform: translateX(-50%); bottom: 250px; padding: 22px 40px; border-radius: 999px; background: #F5A524; color: #0E0F13; font-weight: 800; font-size: 40px; letter-spacing: -0.01em; }
  </style>
  <div id="root" data-composition-id="s5-painel" data-width="1080" data-height="1920" data-duration="4">
    <div class="clip bg" data-start="0" data-duration="4" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="4" data-track-index="1">
      <div id="kicker" class="kicker">/ seu painel</div>
      <div id="phone" class="phone"><img src="assets/00-painel.png" alt="Painel do parceiro"></div>
      <div id="tag" class="tag">cliques · cadastros · assinaturas · a receber</div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s5-painel"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#kicker'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#phone'), { opacity: 0, y: 80, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out' }, 0.3);
      tl.fromTo(q('#tag'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 1.3);
      window.__timelines['s5-painel'] = tl;
    })();
  </script>
</template>`

// ---------------------------------------------------------------- S6 — CTA
const s6 = `<template>
  <style>${FONTS}
    .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding-bottom: 300px; }
    .glow { position: absolute; left: 240px; top: 330px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(245,165,36,.26) 0%, rgba(245,165,36,.06) 45%, rgba(245,165,36,0) 70%); }
    .mark { position: relative; display: block; width: 230px; height: auto; }
    .word { position: relative; margin-top: 30px; font-weight: 800; font-size: 108px; letter-spacing: -0.045em; line-height: 1; }
    .cta { position: relative; margin-top: 60px; font-weight: 800; font-size: 116px; letter-spacing: -0.05em; line-height: 0.96; }
    .direct { position: relative; margin-top: 34px; font-weight: 700; font-size: 62px; letter-spacing: -0.02em; color: #F5A524; }
    .url { position: relative; margin-top: 46px; display: flex; align-items: center; height: 104px; padding: 0 44px; border-radius: 999px; border: 3px solid rgba(245,165,36,.55); background: rgba(245,165,36,.1); font-family: 'JetBrains Mono Variable', monospace; font-weight: 800; font-size: 50px; color: #F5A524; }
  </style>
  <div id="root" data-composition-id="s6-cta" data-width="1080" data-height="1920" data-duration="5">
    <div class="clip bg" data-start="0" data-duration="5" data-track-index="0"></div>
    <div id="stage" class="clip stage" data-layout-allow-overflow data-start="0" data-duration="5" data-track-index="1">
      <div id="glow" class="glow"></div>
      <img id="mark" class="mark" src="assets/logo-1716908b.svg" alt="">
      <div id="word" class="word">Ensaio <span class="or">Fácil</span></div>
      <div id="cta" class="cta">quer ser <span class="or">parceiro?</span></div>
      <div id="direct" class="direct">chama no direct</div>
      <div id="url" class="url">ensaiofacil.app.br</div>
    </div>
  </div>
  ${gsap}
  <script>
    (function () {
      const root = document.querySelector('[data-composition-id="s6-cta"]');
      const q = (s) => root.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(q('#mark'), { opacity: 0, scale: 0.5, rotation: -14 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0);
      tl.fromTo(q('#glow'), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }, 0.05);
      tl.fromTo(q('#word'), { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.4);
      tl.fromTo(q('#cta'), { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.34, ease: 'power4.out' }, 0.9);
      tl.fromTo(q('#direct'), { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 1.5);
      tl.fromTo(q('#url'), { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out' }, 2.0);
      // Segura parado os últimos ~2s para leitura.
      window.__timelines['s6-cta'] = tl;
    })();
  </script>
</template>`

const scenes = { 's1-gancho.html': s1, 's2-app.html': s2, 's3-beneficio.html': s3, 's4-seguidores.html': s4, 's5-painel.html': s5, 's6-cta.html': s6 }
for (const [f, c] of Object.entries(scenes)) {
  writeFileSync(path.join(dir, f), c, { encoding: 'utf8' })
  console.log(`${f}: ${c.length} bytes`)
}
console.log('6 cenas escritas em UTF-8 sem BOM')
