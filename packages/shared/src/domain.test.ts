import { describe, expect, it } from 'vitest'
import { atLeast } from './domain'

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
