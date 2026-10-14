/** Celular/tablet (tela de toque): aí o arquivo vai pelo menu de compartilhar do aparelho. */
function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
}

function saveBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Baixa um texto como arquivo (ex.: .cho do ChordPro). No celular abre o menu de compartilhar
 * (Salvar em Arquivos, OnSong, WhatsApp...): o Safari do iPhone, com um download comum, abre o
 * texto cru na tela em vez de salvar. Sem esse menu, baixa como arquivo binário, que o
 * navegador salva em vez de mostrar.
 */
export function downloadText(fileName: string, content: string, mime = 'text/plain;charset=utf-8') {
  const file = new File([content], fileName, { type: mime })
  if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: fileName }).catch((e: Error) => {
      // Fechou o menu: tudo certo. Outro erro (ex.: o toque "expirou" depois de carregar): baixa.
      if (e.name !== 'AbortError') saveBlob(fileName, new Blob([content], { type: 'application/octet-stream' }))
    })
    return
  }
  saveBlob(fileName, new Blob([content], { type: isTouchDevice() ? 'application/octet-stream' : mime }))
}
