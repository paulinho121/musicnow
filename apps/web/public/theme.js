// Aplica o tema antes de pintar, para não piscar branco no palco.
// Fica em arquivo próprio (e não inline no HTML) para a política de segurança (CSP) bloquear scripts inline.
try {
  var t = localStorage.getItem('ef-theme')
  // Sem escolha salva: escuro (palco); no endereço de teste, o claro (visual novo em avaliação).
  var def = location.hostname.indexOf('teste.') === 0 ? 'light' : 'dark'
  document.documentElement.dataset.theme = t === 'light' || t === 'dark' ? t : def
} catch (e) {
  document.documentElement.dataset.theme = 'dark'
}
// Conteúdo pré-gerado (para o Google): aparece só na página a que pertence, enquanto o app carrega.
document.documentElement.dataset.path = location.pathname
