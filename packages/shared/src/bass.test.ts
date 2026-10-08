import { describe, expect, it } from 'vitest'
import { bassFretboard, chordBassLine } from './index'

describe('modo baixista', () => {
  it('mostra a nota do baixo de cada acorde, nas mesmas colunas', () => {
    expect(chordBassLine(' Am7/G       F7M   C/E  (G7)')).toBe(' G           F     E    (G)')
    expect(chordBassLine('Bb  Ebm7')).toBe('Bb  Eb')
  })

  it('posições no braço do baixo: a nota do baixo em destaque', () => {
    const dots = bassFretboard('C/E', 4, 5)
    // Mi solto (corda 0, casa 0) é a nota do baixo; Dó na 3ª casa da corda Lá.
    expect(dots.find((d) => d.string === 0 && d.fret === 0)).toMatchObject({ note: 'E', degree: '3', main: true })
    expect(dots.find((d) => d.string === 1 && d.fret === 3)).toMatchObject({ note: 'C', degree: '1', main: false })
    // Am: a terça é menor.
    expect(bassFretboard('Am', 4, 5).find((d) => d.note === 'C')?.degree).toBe('b3')
    // 5 cordas tem a corda Si.
    expect(bassFretboard('B', 5, 0).filter((d) => d.main).map((d) => d.string)).toEqual([0])
    // Nota do baixo fora do acorde (Am/G) também aparece.
    expect(bassFretboard('Am/G', 4, 5).find((d) => d.main)?.degree).toBe('baixo')
  })
})
