// Planos e regras de cobrança (mesmos valores no app e no servidor).

export const TRIAL_DAYS = 14
/** Dias de tolerância depois do vencimento antes de bloquear (Pix/boleto podem compensar no dia seguinte). */
export const GRACE_DAYS = 3

export const PLANS = {
  monthly: { label: 'Mensal', price: 9.99, cycle: 'MONTHLY', months: 1 },
  yearly: { label: 'Anual', price: 99.9, cycle: 'YEARLY', months: 12 },
} as const
export type PlanId = keyof typeof PLANS

/** "R$ 9,99" */
export const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Só os dígitos de um CPF/CNPJ digitado com pontos, traços e barra. */
export const onlyDigits = (s: string) => s.replace(/\D/g, '')

/** CPF ou CNPJ válido (confere os dígitos verificadores; recusa "111.111.111-11"). */
export function isValidCpfCnpj(input: string): boolean {
  const d = onlyDigits(input)
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false
    const check = (len: number) => {
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
      const r = (sum * 10) % 11
      return (r === 10 ? 0 : r) === Number(d[len])
    }
    return check(9) && check(10)
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false
    const check = (len: number) => {
      const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0)
      const r = sum % 11
      return (r < 2 ? 0 : 11 - r) === Number(d[len])
    }
    return check(12) && check(13)
  }
  return false
}
