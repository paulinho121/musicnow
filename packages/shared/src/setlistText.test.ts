import { describe, expect, it } from 'vitest'
import { parseSetlistText } from './setlistText'

const PAPEL = `REPERTÓRIO
BLOCO 1 (Ballada 3 - 80)
• Programa de fim de semana - C
• Inevitável - C
• Dormi na praça - D

BLOCO 2 (Marília - 130)
• Largado às traças - A
• Fada - A
• Ar condicionado no 15 - E

BLOCO 3 (Sertanejo 1 - 130)
• Nova Iork - G
• Caso Marcado - G
• To falando sério - Em

BLOCO 5 (Xote - 88)
• Quero - G
• Morro de saudade  longe do seu beijo - G
`

describe('repertório em texto', () => {
  it('lê a folha de papel: blocos com estilo, BPM e músicas com tom', () => {
    const r = parseSetlistText(PAPEL)
    expect(r.loose).toEqual([])
    expect(r.blocks.map((b) => [b.name, b.style, b.bpm, b.songs.length])).toEqual([
      ['Bloco 1', 'Ballada 3', 80, 3],
      ['Bloco 2', 'Marília', 130, 3],
      ['Bloco 3', 'Sertanejo 1', 130, 3],
      ['Bloco 5', 'Xote', 88, 2],
    ])
    expect(r.blocks[1].songs[0]).toEqual({ title: 'Largado às traças', key: 'A' })
    expect(r.blocks[2].songs[2]).toEqual({ title: 'To falando sério', key: 'Em' })
    expect(r.blocks[3].songs[1].title).toBe('Morro de saudade  longe do seu beijo')
  })

  it('aceita outras formas de escrever', () => {
    const r = parseSetlistText(`1. Evidências (G)
2) Fio de Cabelo – D
Bloco Forró: 
- Xote das Meninas - E
- Asa Branca
Set Fire to the Rain - C
Medley 2 (Pop - 120)
Sozinho [Am]`)
    expect(r.loose).toEqual([
      { title: 'Evidências', key: 'G' },
      { title: 'Fio de Cabelo', key: 'D' },
    ])
    expect(r.blocks.map((b) => b.name)).toEqual(['Bloco Forró', 'Medley 2'])
    expect(r.blocks[0].songs).toEqual([
      { title: 'Xote das Meninas', key: 'E' },
      { title: 'Asa Branca', key: null },
      { title: 'Set Fire to the Rain', key: 'C' },
    ])
    expect(r.blocks[1]).toMatchObject({ style: 'Pop', bpm: 120, songs: [{ title: 'Sozinho', key: 'Am' }] })
  })
})
