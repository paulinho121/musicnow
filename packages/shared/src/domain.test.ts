import { describe, expect, it } from 'vitest'
import { atLeast, youtubeId } from './domain'

describe('permissões em escada', () => {
  it('cada nível inclui os anteriores', () => {
    expect(atLeast('owner', 'admin')).toBe(true)
    expect(atLeast('admin', 'mark')).toBe(true)
    expect(atLeast('mark', 'suggest')).toBe(true)
    expect(atLeast('suggest', 'view')).toBe(true)
  })
  it('não sobe de nível', () => {
    expect(atLeast('view', 'suggest')).toBe(false)
    expect(atLeast('mark', 'admin')).toBe(false)
    expect(atLeast('admin', 'owner')).toBe(false)
  })
  it('sem acesso nunca passa', () => {
    expect(atLeast(null, 'view')).toBe(false)
    expect(atLeast(undefined, 'view')).toBe(false)
  })
})


describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reconhece %s', (url, id) => expect(youtubeId(url)).toBe(id))
  it.each(['https://evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com/watch?v=curto', 'nada'])(
    'recusa %s',
    (url) => expect(youtubeId(url)).toBeNull(),
  )
})
