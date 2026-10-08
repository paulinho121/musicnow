// Ilustrações do app (desenho próprio, em SVG): uma cena dentro de um círculo suave, para os
// estados vazios e os cartões de "comece por aqui". Cores fixas, que funcionam nos dois temas.

export type IllustrationName = 'repertorio' | 'biblioteca' | 'banda' | 'agenda'

const SKIN = '#f2c7a5'
const SKIN_2 = '#9a6748'
const INK = '#262138'
const ORANGE = '#f29b25'
const PURPLE = '#7c6ad6'
const PINK = '#f37aa6'
const TEAL = '#3fb9a8'
const PAPER = '#ffffff'

function Repertorio() {
  return (
    <>
      {/* prancheta com a lista do repertório */}
      <rect x="44" y="34" width="72" height="92" rx="10" fill={PAPER} stroke={INK} strokeWidth="3" />
      <rect x="64" y="26" width="32" height="14" rx="5" fill={PURPLE} stroke={INK} strokeWidth="3" />
      {[56, 74, 92, 110].map((y, i) => (
        <g key={y}>
          <circle cx="58" cy={y} r="4" fill={i === 0 ? ORANGE : i === 1 ? PINK : i === 2 ? TEAL : PURPLE} />
          <rect x="68" y={y - 3} width={i % 2 ? 30 : 38} height="6" rx="3" fill="#d9d4e6" />
        </g>
      ))}
      {/* violão */}
      <g transform="rotate(-28 128 104)">
        <rect x="124" y="40" width="9" height="46" rx="3" fill={SKIN_2} stroke={INK} strokeWidth="3" />
        <rect x="121" y="32" width="15" height="12" rx="3" fill={INK} />
        <ellipse cx="128.5" cy="100" rx="20" ry="16" fill={ORANGE} stroke={INK} strokeWidth="3" />
        <ellipse cx="128.5" cy="120" rx="25" ry="19" fill={ORANGE} stroke={INK} strokeWidth="3" />
        <circle cx="128.5" cy="106" r="6" fill={INK} />
      </g>
      {/* notas */}
      <path d="M140 30 v18 a6 6 0 1 1 -4 -5.6 V26 l14 -4 v6 z" fill={PURPLE} />
      <circle cx="30" cy="62" r="5" fill={PINK} />
    </>
  )
}

function Biblioteca() {
  return (
    <>
      {/* pilha de cifras */}
      <rect x="52" y="44" width="68" height="84" rx="8" fill="#e6e1f3" stroke={INK} strokeWidth="3" transform="rotate(-10 86 86)" />
      <rect x="50" y="40" width="68" height="84" rx="8" fill={PAPER} stroke={INK} strokeWidth="3" />
      <text x="60" y="62" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="800" fill={ORANGE}>
        G D Em
      </text>
      {[72, 86, 100, 112].map((y, i) => (
        <rect key={y} x="60" y={y} width={i === 3 ? 28 : 46} height="5" rx="2.5" fill="#d9d4e6" />
      ))}
      {/* lupa */}
      <circle cx="122" cy="98" r="18" fill="#ffffff" fillOpacity="0.7" stroke={INK} strokeWidth="4" />
      <path d="M135 111 l14 14" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M114 92 a10 10 0 0 1 10 -6" stroke={PURPLE} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="104" r="5" fill={TEAL} />
      <path d="M36 44 v14 a5 5 0 1 1 -3.5 -4.7 V40 l11 -3 v5 z" fill={PINK} />
    </>
  )
}

function Banda() {
  return (
    <>
      {/* duas pessoas: uma canta, outra toca */}
      <circle cx="66" cy="62" r="15" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M51 58 a15 15 0 0 1 30 -2 c-6 -6 -18 -8 -30 2z" fill={INK} />
      <path d="M40 128 c0 -26 12 -42 26 -42 s26 16 26 42z" fill={PURPLE} stroke={INK} strokeWidth="3" />
      <rect x="78" y="70" width="7" height="22" rx="3" fill={INK} transform="rotate(25 81 80)" />
      <circle cx="86" cy="66" r="7" fill="#c9c3dc" stroke={INK} strokeWidth="3" />

      <circle cx="116" cy="66" r="14" fill={SKIN_2} stroke={INK} strokeWidth="3" />
      <path d="M102 62 c2 -14 26 -14 28 0 c-6 -4 -20 -5 -28 0z" fill={INK} />
      <path d="M92 128 c0 -24 11 -40 24 -40 s24 16 24 40z" fill={TEAL} stroke={INK} strokeWidth="3" />
      <g transform="rotate(-35 116 112)">
        <ellipse cx="116" cy="114" rx="17" ry="13" fill={ORANGE} stroke={INK} strokeWidth="3" />
        <rect x="113" y="76" width="7" height="28" rx="3" fill={SKIN_2} stroke={INK} strokeWidth="2.5" />
      </g>
      <path d="M140 34 v16 a5.5 5.5 0 1 1 -3.8 -5.2 V30 l12 -3.4 v5.4 z" fill={PINK} />
      <path d="M30 40 v12 a4.5 4.5 0 1 1 -3 -4.2 V37 l9 -2.6 v4.2 z" fill={ORANGE} />
    </>
  )
}

function Agenda() {
  return (
    <>
      <rect x="40" y="42" width="84" height="80" rx="12" fill={PAPER} stroke={INK} strokeWidth="3" />
      <path d="M40 54 a12 12 0 0 1 12 -12 h60 a12 12 0 0 1 12 12 v10 h-84z" fill={PINK} stroke={INK} strokeWidth="3" />
      <rect x="58" y="32" width="7" height="18" rx="3.5" fill={INK} />
      <rect x="99" y="32" width="7" height="18" rx="3.5" fill={INK} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={50 + c * 18}
            y={74 + r * 14}
            width="12"
            height="9"
            rx="3"
            fill={r === 1 && c === 2 ? ORANGE : '#e6e1f3'}
          />
        )),
      )}
      {/* moedas: o cachê */}
      <ellipse cx="134" cy="118" rx="16" ry="6" fill="#f7c948" stroke={INK} strokeWidth="3" />
      <path d="M118 108 v10 a16 6 0 0 0 32 0 v-10" fill="#f7c948" stroke={INK} strokeWidth="3" />
      <ellipse cx="134" cy="108" rx="16" ry="6" fill="#ffe08a" stroke={INK} strokeWidth="3" />
      <circle cx="30" cy="96" r="5" fill={TEAL} />
    </>
  )
}

const SCENES: Record<IllustrationName, () => React.ReactElement> = { repertorio: Repertorio, biblioteca: Biblioteca, banda: Banda, agenda: Agenda }
const BG: Record<IllustrationName, string> = { repertorio: '#fde7c8', biblioteca: '#e4e0fb', banda: '#d7f1ec', agenda: '#fde0ea' }

/** Cena ilustrada num círculo (como nas boas telas de "comece por aqui"). */
export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const Scene = SCENES[name]
  return (
    <svg viewBox="0 0 170 160" className={className} aria-hidden="true">
      <circle cx="85" cy="82" r="74" fill={BG[name]} />
      <Scene />
    </svg>
  )
}
