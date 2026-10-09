// Corrige a acentuação dos frames do reel de parceiros e grava em UTF-8 SEM BOM.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = 'C:/Users/Acer/Desktop/ensaio-facil-videos/videos/ensaio-parceiros/compositions/frames'

// Cada par: [trecho atual (sem acento), trecho correto (com acento)]
const fixes = {
  '01-gancho.html': [
    ['/ musica &amp; renda', '/ música &amp; renda'],
    ['>voce toca.<', '>você toca.<'],
    ['>voce ensina.<', '>você ensina.<'],
    ['>voce <span class="or">indica.</span>', '>você <span class="or">indica.</span>'],
  ],
  '02-aceleracao.html': [
    ['startup acelerada por', 'startup acelerada por'],
  ],
  '03-comissao.html': [
    ['/ o que voce ganha', '/ o que você ganha'],
    ['ganhe <span class="or">por indicacao.</span>', 'ganhe <span class="or">por indicação.</span>'],
    ['<div class="big">comissao</div>', '<div class="big">comissão</div>'],
    ['a cada musico que assinar pelo seu link', 'a cada músico que assinar pelo seu link'],
    ['sem boleto, sem espera', 'sem boleto, sem espera'],
    ['comece com 1 indicacao', 'comece com 1 indicação'],
  ],
  '04-passos.html': [
    ['/ como funciona', '/ como funciona'],
    ['<span class="txt">pegue seu <span style="color:#F5A524">link</span>', '<span class="txt">pegue seu <span style="color:#F5A524">link</span>'],
    ['compartilhe com a banda', 'compartilhe com a banda'],
    ['receba no', 'receba no'],
  ],
  '05-painel.html': [
    ['/ seu painel', '/ seu painel'],
    ['acompanhe cada real.', 'acompanhe cada real.'],
    ['<span class="lbl">comissao</span>', '<span class="lbl">comissão</span>'],
    ['<span class="val">R$ --</span>', '<span class="val">R$ --</span>'],
    ['dados em tempo real, no seu aparelho', 'dados em tempo real, no seu aparelho'],
  ],
  '06-publico.html': [
    ['/ feito para', '/ feito para'],
    ['<div id="p1" class="pill">lider de louvor</div>', '<div id="p1" class="pill">líder de louvor</div>'],
    ['<div id="p2" class="pill">professor de musica</div>', '<div id="p2" class="pill">professor de música</div>'],
    ['<div id="p4" class="pill">criadores de conteudo</div>', '<div id="p4" class="pill">criadores de conteúdo</div>'],
  ],
  '07-convite.html': [
    ['indique o app que a sua banda ja usa e ganhe por isso.', 'indique o app que a sua banda já usa e ganhe por isso.'],
  ],
  '08-cta.html': [
    ['<div id="cta" class="cta">quero ser parceiro.</div>', '<div id="cta" class="cta">quero ser parceiro.</div>'],
  ],
}

for (const [file, pairs] of Object.entries(fixes)) {
  const p = path.join(dir, file)
  let src = readFileSync(p, 'utf8')
  let changed = 0
  for (const [from, to] of pairs) {
    if (from === to) continue
    if (src.includes(from)) { src = src.split(from).join(to); changed++ }
    else console.log(`  [aviso] não encontrado em ${file}: ${from}`)
  }
  writeFileSync(p, src, { encoding: 'utf8' }) // Node grava sem BOM por padrão
  console.log(`${file}: ${changed} substituição(ões)`)
}
console.log('OK - todos gravados em UTF-8 sem BOM')
