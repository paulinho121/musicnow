import { describe, expect, it } from 'vitest'
import { isShortMusicLink, listenLink, musicSearchUrl, parseMusicLink } from './music'

describe('links das plataformas de música', () => {
  it('YouTube', () => {
    const l = parseMusicLink('https://youtu.be/dQw4w9WgXcQ?si=x')
    expect(l?.service).toBe('youtube')
    expect(l?.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('Spotify: música, playlist e endereço com idioma', () => {
    const t = parseMusicLink('https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')
    expect(t).toMatchObject({ service: 'spotify', kind: 'track', id: '4uLU6hMCjMI75M1A2tKUQC' })
    expect(t?.embedUrl).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC')
    expect(parseMusicLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')?.kind).toBe('playlist')
    expect(parseMusicLink('https://open.spotify.com/artist/4uLU6hMCjMI75M1A2tKUQC')).toBeNull()
  })

  it('Deezer', () => {
    const t = parseMusicLink('https://www.deezer.com/br/track/3135556')
    expect(t).toMatchObject({ service: 'deezer', kind: 'track', id: '3135556', openUrl: 'https://www.deezer.com/track/3135556' })
    expect(t?.embedUrl).toBe('https://widget.deezer.com/widget/auto/track/3135556')
    expect(parseMusicLink('https://deezer.com/playlist/908622995')?.kind).toBe('playlist')
  })

  it('Apple Music: música dentro do álbum', () => {
    const t = parseMusicLink('https://music.apple.com/br/album/aquarela/1440830543?i=1440830916')
    expect(t).toMatchObject({ service: 'apple', kind: 'track', id: '1440830916' })
    expect(t?.embedUrl).toBe('https://embed.music.apple.com/br/album/aquarela/1440830543?i=1440830916')
    expect(parseMusicLink('https://music.apple.com/br/album/aquarela/1440830543')?.kind).toBe('album')
  })

  it('recusa outros sites e reconhece links curtos', () => {
    expect(parseMusicLink('https://example.com/track/1')).toBeNull()
    expect(parseMusicLink('javascript:alert(1)')).toBeNull()
    expect(isShortMusicLink('https://link.deezer.com/s/30xYz')).toBe(true)
    expect(isShortMusicLink('https://www.deezer.com/track/1')).toBe(false)
  })

  it('ouvir no serviço da pessoa: a referência dele ou a busca', () => {
    const song = { title: 'Aquarela', artist: 'Toquinho', referenceUrl: 'https://www.deezer.com/track/3135556' }
    expect(listenLink('deezer', song)).toEqual({ url: 'https://www.deezer.com/track/3135556', isReference: true })
    expect(listenLink('spotify', song)).toEqual({ url: 'https://open.spotify.com/search/Aquarela%20Toquinho', isReference: false })
    expect(musicSearchUrl('apple', song)).toBe('https://music.apple.com/br/search?term=Aquarela%20Toquinho')
  })
})
