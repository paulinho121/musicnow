import { useEffect, useRef, useState } from 'react'

// Abertura do app: a logo acendendo (vídeo de ~4,5 s, sem som, ~80–140 KB).
// Cor exata do fundo do vídeo, para não aparecer "caixa" em volta dele.
const VIDEO_BG = '#0c121e'
const SESSION_KEY = 'ef-intro'
/** Tempo para o vídeo começar (rede lenta); depois disso o app abre sem a animação. */
const START_MS = 3000
/** Duração máxima depois de começar (o vídeo tem ~4,5 s). */
const PLAY_MS = 5500

/**
 * Telas em que a abertura atrapalharia: palco (link aberto na hora do show), impressão e as
 * páginas públicas (quem chega pelo Google ou por um link precisa ver o conteúdo na hora).
 */
const SKIP_ROUTES = /\/(tocar|imprimir|folha)(\/|$)|^\/(entrar|criar-conta|termos|privacidade|esqueci-senha|redefinir-senha)?$/

function shouldShow() {
  if (SKIP_ROUTES.test(window.location.pathname)) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  // Aberto numa aba em segundo plano: o navegador não toca o vídeo; abre direto.
  if (document.visibilityState === 'hidden') return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // navegação privada: mostra mesmo assim
  }
  return true
}

// Decidido uma vez ao carregar a página (fora do React: o modo de desenvolvimento
// executa os inicializadores duas vezes e a segunda leitura já veria a marca da sessão).
const SHOW_ON_LOAD = shouldShow()

/** Uma vez por sessão; toque em qualquer lugar para pular. Nunca segura o músico. */
export function IntroSplash() {
  const [visible, setVisible] = useState(SHOW_ON_LOAD)
  const [leaving, setLeaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  const close = () => setLeaving(true)

  useEffect(() => {
    if (!visible) return
    // O navegador recusou tocar sozinho (modo economia de bateria etc.): abre o app na hora.
    video.current?.play().catch((e: unknown) => (e instanceof DOMException && e.name === 'NotAllowedError' ? close() : undefined))
    // Rede lenta: não segura o músico esperando a animação carregar.
    const t = setTimeout(() => (!video.current || video.current.paused ? close() : undefined), START_MS)
    return () => clearTimeout(t)
  }, [visible])

  useEffect(() => {
    if (!playing) return
    // Garantia: some mesmo se o vídeo travar no meio.
    const t = setTimeout(close, PLAY_MS)
    return () => clearTimeout(t)
  }, [playing])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setVisible(false), 450)
    return () => clearTimeout(t)
  }, [leaving])

  if (!visible) return null
  return (
    <div
      role="presentation"
      aria-hidden
      onClick={close}
      className={`fixed inset-0 z-[100] grid cursor-pointer place-items-center transition-opacity duration-[450ms] ${leaving ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: VIDEO_BG }}
    >
      <video
        ref={video}
        className="w-full max-w-4xl"
        // Bordas esfumaçadas: o vídeo some no fundo, sem "caixa" em volta.
        style={{ maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 72%, transparent 100%)' }}
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/intro/intro-poster.jpg"
        onPlaying={() => setPlaying(true)}
        onEnded={close}
        onError={close}
      >
        <source src="/intro/intro.webm" type="video/webm" />
        <source src="/intro/intro.mp4" type="video/mp4" onError={close} />
      </video>
      <span className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-xs font-medium text-white/40">Toque para pular</span>
    </div>
  )
}
