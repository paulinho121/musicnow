// Regrava o mock do painel com acentuação correta, em UTF-8 sem BOM.
import { writeFileSync } from 'node:fs'

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:390px; height:844px; overflow:hidden; }
  body {
    background:#0E0F13; color:#ECEEF3;
    font-family:'Inter Variable', ui-sans-serif, system-ui, sans-serif;
    padding:18px 16px;
  }
  @font-face{font-family:'Inter Variable';font-weight:100 900;src:url('file:///C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/assets/fonts/captured-inter-latin-wght-normal-Dx4kXJAl.woff2')format('woff2-variations');}
  @font-face{font-family:'JetBrains Mono Variable';font-weight:100 800;src:url('file:///C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-facil-parceiros/assets/fonts/captured-jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2')format('woff2-variations');}
  .muted{color:#9AA1B1}
  h1{font-size:21px;font-weight:800;letter-spacing:-0.01em}
  .sub{font-size:13px;color:#9AA1B1;margin-top:3px}
  .card{border:1px solid #2A2E38;border-radius:14px;background:#16181E}
  .sec{padding:15px;margin-top:14px}
  .row{display:flex;align-items:center;gap:11px}
  .gift{width:40px;height:40px;border-radius:11px;background:rgba(245,165,36,.15);color:#F5A524;display:grid;place-items:center;font-size:19px}
  .cupom-lbl{font-size:12.5px;color:#9AA1B1}
  .cupom{font-family:'JetBrains Mono Variable',monospace;font-size:22px;font-weight:800;letter-spacing:.06em}
  .copybtn{margin-left:auto;font-size:12.5px;border:1px solid #2A2E38;border-radius:9px;padding:7px 10px;color:#C9CDD6}
  .link{font-family:'JetBrains Mono Variable',monospace;font-size:12px;color:#C9CDD6;background:#0E0F13;border:1px solid #2A2E38;border-radius:9px;padding:9px 11px;margin-top:12px;display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .pix{margin-top:12px;font-size:12.5px;line-height:1.5;color:#C9CDD6}
  .pix b{color:#ECEEF3}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}
  .stat{padding:13px}
  .stat .k{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#9AA1B1}
  .stat .v{font-size:21px;font-weight:800;margin-top:5px}
  .stat.ok{border-color:rgba(52,211,153,.4)}
  .stat.ok .v{color:#34D399}
  .listhdr{font-size:14px;font-weight:600;padding:13px 15px;border-bottom:1px solid #2A2E38}
  .li{display:flex;align-items:center;gap:11px;font-size:13px;padding:11px 15px;border-bottom:1px solid #1E2129}
  .li:last-child{border-bottom:0}
  .n{font-family:'JetBrains Mono Variable',monospace;color:#9AA1B1;width:26px}
  .dt{color:#9AA1B1;width:52px}
  .st{flex:1;font-weight:600}
  .st.a{color:#F5A524} .st.g{color:#34D399} .st.m{color:#9AA1B1}
  .val{font-weight:700}
</style>
</head>
<body>
  <h1>Painel do parceiro</h1>
  <p class="sub">Olá, Paulo! Divulgue o seu cupom e acompanhe as suas comissões.</p>

  <section class="card sec">
    <div class="row">
      <span class="gift">&#127873;</span>
      <div>
        <p class="cupom-lbl">Seu cupom</p>
        <p class="cupom">PAULO</p>
      </div>
      <span class="copybtn">Copiar cupom</span>
    </div>
    <code class="link">ensaiofacil.app.br/p/paulo</code>
    <p class="pix">Quem se cadastra pelo seu link ou com o cupom ganha <b>30 dias grátis</b>. Você ganha <b>50% do primeiro pagamento</b> de cada assinante. A comissão é liberada 8 dias depois do pagamento.</p>
  </section>

  <div class="grid">
    <div class="card stat"><p class="k">&#128101; Cadastros</p><p class="v">12</p></div>
    <div class="card stat"><p class="k">&#10003; Assinantes</p><p class="v">4</p></div>
    <div class="card stat ok"><p class="k">&#128176; A receber</p><p class="v">R$ 149,00</p><p class="k" style="margin-top:4px">+ R$ 74,50 aguardando</p></div>
    <div class="card stat"><p class="k">&#128176; Já recebido</p><p class="v">R$ 74,50</p></div>
  </div>

  <section class="card" style="margin-top:14px;overflow:hidden">
    <h2 class="listhdr">Suas indicações</h2>
    <div class="li"><span class="n">#12</span><span class="dt">08 out</span><span class="st a">Assinou <span class="m">· anual</span></span><span class="val">R$ 74,50</span></div>
    <div class="li"><span class="n">#11</span><span class="dt">06 out</span><span class="st g">Pago</span><span class="val">R$ 74,50</span></div>
    <div class="li"><span class="n">#10</span><span class="dt">04 out</span><span class="st a">Assinou <span class="m">· mensal</span></span><span class="val">R$ 7,45</span></div>
    <div class="li"><span class="n">#9</span><span class="dt">02 out</span><span class="st m">Testando</span><span class="val">—</span></div>
    <div class="li"><span class="n">#8</span><span class="dt">29 set</span><span class="st g">Pago</span><span class="val">R$ 74,50</span></div>
  </section>
</body>
</html>
`
writeFileSync('C:/Users/Acer/Desktop/ensaio-facil/_reel-check/painel-mock.html', html, { encoding: 'utf8' })
console.log('painel-mock.html regravado em UTF-8 sem BOM')
