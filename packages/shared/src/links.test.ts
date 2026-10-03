import { describe, expect, it } from 'vitest'
import { chordLinks, mainArtist, slugify, youtubeSearchUrl } from './links'

describe('slugify', () => {
  it.each([
    ['Talking to the Moon', 'talking-to-the-moon'],
    ['Bruno Mars', 'bruno-mars'],
    ['Águas de Março', 'aguas-de-marco'],
    ["Don't Know Why", 'dont-know-why'],
    ['Djavan & Gal Costa', 'djavan-e-gal-costa'],
    ['  24K Magic!  ', '24k-magic'],
  ])('%s → %s', (input, out) => expect(slugify(input)).toBe(out))
})

describe('mainArtist', () => {
  it('fica só com o artista principal', () => {
    expect(mainArtist('Bruno Mars feat. Anderson .Paak')).toBe('Bruno Mars')
    expect(mainArtist('Nelson Gonçalves part. Luiz Gonzaga')).toBe('Nelson Gonçalves')
    expect(mainArtist('Lady Gaga & Bruno Mars')).toBe('Lady Gaga')
    expect(mainArtist('Tom Jobim')).toBe('Tom Jobim')
  })
})

describe('links', () => {
  it('monta o endereço da música no Cifra Club e as buscas', () => {
    const links = chordLinks({ title: 'Talking to the Moon', artist: 'Bruno Mars' })
    expect(links.map((l) => l.id)).toEqual(['cifraclub', 'ultimate-guitar', 'web'])
    expect(links[0].url).toBe('https://www.cifraclub.com.br/bruno-mars/talking-to-the-moon/')
    expect(links[1].url).toContain('value=Talking%20to%20the%20Moon%20Bruno%20Mars')
    expect(links[2].url).toContain('q=cifra%20Talking%20to%20the%20Moon%20Bruno%20Mars')
    expect(youtubeSearchUrl({ title: 'Talking to the Moon', artist: 'Bruno Mars' })).toBe(
      'https://www.youtube.com/results?search_query=Talking%20to%20the%20Moon%20Bruno%20Mars',
    )
  })
  it('sem artista, não chuta o endereço do Cifra Club', () => {
    expect(chordLinks({ title: 'Música Nova' }).map((l) => l.id)).toEqual(['ultimate-guitar', 'web'])
  })
})
