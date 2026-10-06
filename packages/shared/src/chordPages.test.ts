import { describe, expect, it } from 'vitest'
import { allChordPages, chordFromSlug, chordSlug } from './chordPages'

describe('páginas de acorde', () => {
  it('gera endereços legíveis em português', () => {
    expect(chordSlug('C')).toBe('c-maior')
    expect(chordSlug('C#m')).toBe('c-sustenido-menor')
    expect(chordSlug('Bb7M')).toBe('b-bemol-7-maior')
    expect(chordSlug('Ebm7(b5)')).toBe('e-bemol-meio-diminuto')
    expect(chordSlug('F#°')).toBe('f-sustenido-diminuto')
    expect(chordSlug('A7(9)')).toBe('a-7-9')
  })

  it('acordes fora da lista não têm página', () => {
    expect(chordSlug('C/E')).toBeNull()
    expect(chordSlug('A7(13)')).toBeNull()
    expect(chordSlug('Db')).toBeNull()
  })

  it('volta do endereço para o acorde', () => {
    expect(chordFromSlug('c-sustenido-menor')).toBe('C#m')
    expect(chordFromSlug('c-maior')).toBe('C')
    expect(chordFromSlug('b-bemol-7-maior')).toBe('Bb7M')
    expect(chordFromSlug('x-maior')).toBeNull()
    expect(chordFromSlug('c-inventado')).toBeNull()
  })

  it('todas as páginas têm endereço único e voltam para o mesmo acorde', () => {
    const pages = allChordPages()
    expect(pages.length).toBeGreaterThan(180)
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length)
    for (const p of pages) expect(chordFromSlug(p.slug)).toBe(p.symbol)
  })
})
