import { describe, expect, it } from 'vitest'
import { SHARE_SIGNATURE, setlistShareText, setlistShortText, type ShareSetlist } from './share'

const show: ShareSetlist = {
  title: 'Show no Bar do Zé',
  details: 'sábado, 12 de outubro · Bar do Zé',
  groups: [
    { name: null, subtitle: null, songs: [{ title: 'Abertura', artist: null, key: 'C' }] },
    {
      name: 'Bloco 1',
      subtitle: 'Marília · 130 BPM',
      songs: [
        { title: 'Largado às Traças', artist: 'Zé Neto & Cristiano', key: 'A' },
        { title: 'Fada', artist: 'Henrique & Juliano', key: null },
      ],
    },
    { name: 'Bloco vazio', subtitle: null, songs: [] },
  ],
}

describe('setlistShareText', () => {
  it('lista blocos e músicas numeradas, sem tons por padrão', () => {
    expect(setlistShareText(show)).toBe(
      [
        '🎶 *Show no Bar do Zé*',
        'sábado, 12 de outubro · Bar do Zé',
        '',
        '1. Abertura',
        '',
        '*BLOCO 1* (Marília · 130 BPM)',
        '2. Largado às Traças — Zé Neto & Cristiano',
        '3. Fada — Henrique & Juliano',
        '',
        SHARE_SIGNATURE,
      ].join('\n'),
    )
  })

  it('mostra os tons quando pedido e pode ir sem negrito', () => {
    const t = setlistShareText(show, { withKeys: true, bold: false })
    expect(t).toContain('1. Abertura (C)')
    expect(t).toContain('2. Largado às Traças — Zé Neto & Cristiano (A)')
    expect(t).toContain('3. Fada — Henrique & Juliano\n')
    expect(t).not.toContain('*')
  })
})

describe('setlistShortText', () => {
  it('cabe inteiro quando é curto', () => {
    const t = setlistShortText(show)
    expect(t).toContain('3. Fada — Henrique & Juliano')
    expect(t).not.toContain('+ ')
  })

  it('corta a lista e diz quantas faltam', () => {
    const many: ShareSetlist = {
      title: 'Show longo',
      details: null,
      groups: [
        {
          name: null,
          subtitle: null,
          songs: Array.from({ length: 40 }, (_, i) => ({ title: `Música número ${i + 1}`, artist: 'Artista', key: null })),
        },
      ],
    }
    const t = setlistShortText(many)
    expect([...t].length).toBeLessThanOrEqual(270)
    expect(t).toMatch(/\+ \d+ músicas/)
    expect(t.endsWith(SHARE_SIGNATURE)).toBe(true)
  })
})
