// Aplica o tema antes de pintar, para não piscar branco no palco.
// Fica em arquivo próprio (e não inline no HTML) para a política de segurança (CSP) bloquear scripts inline.
try {
  var t = localStorage.getItem('ef-theme')
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'
} catch (e) {
  document.documentElement.dataset.theme = 'dark'
}
