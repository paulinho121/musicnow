import { describe, expect, it } from 'vitest'
import { formatBRL, isValidCpfCnpj, parseBRL, PLANS } from './billing'

describe('cobrança', () => {
  it('CPF e CNPJ: aceita válidos (com ou sem máscara) e recusa inválidos', () => {
    // Números de exemplo gerados só para teste (dígitos verificadores corretos).
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true)
    expect(isValidCpfCnpj('52998224725')).toBe(true)
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCpfCnpj('529.982.247-24')).toBe(false)
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false)
    expect(isValidCpfCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCpfCnpj('123')).toBe(false)
  })

  it('preços', () => {
    expect(formatBRL(PLANS.monthly.price).replace(/\s/g, ' ')).toBe('R$ 14,90')
    expect(formatBRL(PLANS.yearly.price).replace(/\s/g, ' ')).toBe('R$ 149,00')
    // Anual sai por menos de 10 mensalidades (2 meses grátis).
    expect(PLANS.yearly.price).toBeLessThan(PLANS.monthly.price * 10.1)
  })
})

describe('valor digitado em reais', () => {
  it('entende os jeitos comuns de escrever', () => {
    expect(parseBRL('800')).toBe(80000)
    expect(parseBRL('800,00')).toBe(80000)
    expect(parseBRL('R$ 1.200,50')).toBe(120050)
    expect(parseBRL('1.500')).toBe(150000)
    expect(parseBRL('99,9')).toBe(9990)
    expect(parseBRL('0,5')).toBe(50)
  })
  it('vazio ou sem número vira null', () => {
    expect(parseBRL('')).toBeNull()
    expect(parseBRL('abc')).toBeNull()
  })
})
