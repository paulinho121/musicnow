// Cupom de parceiro: guardado no aparelho ao abrir o link do parceiro (/p/luiz) ou digitar na
// tela de cadastro, e usado assim que a pessoa entra (também no login com Google, que sai do app).
import { useEffect, useState } from 'react'
import { api } from './api'

const KEY = 'ef-cupom'
/** O cupom guardado vale por 30 dias (a pessoa pode abrir o link hoje e criar a conta depois). */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

export interface CouponInfo {
  code: string
  name: string
  trialDays: number
}

export const normalizeCoupon = (code: string) =>
  code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

export function saveCoupon(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: normalizeCoupon(code), at: Date.now() }))
  } catch {
    // navegação privada: o cupom vai pelo endereço (?cupom=)
  }
}

export function pendingCoupon(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { code: string; at: number } | null
    if (!v || Date.now() - v.at > MAX_AGE) return null
    return v.code
  } catch {
    return null
  }
}

export function clearCoupon() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a limpar
  }
}

/** Confere um cupom (sem login). */
export const fetchCoupon = (code: string) => api<CouponInfo>(`/partners/coupon/${encodeURIComponent(normalizeCoupon(code))}`)

/** Usa o cupom guardado (depois de entrar). Erro de cupom inválido/usado: só descarta. */
export async function redeemPendingCoupon(): Promise<{ trialDays: number; code: string } | null> {
  const code = pendingCoupon()
  if (!code) return null
  try {
    const r = await api<{ applied: boolean; trialDays: number; code: string }>('/partners/redeem', { method: 'POST', json: { code } })
    clearCoupon()
    return r.applied ? r : null
  } catch (e) {
    // Sem conexão: tenta na próxima vez. Cupom recusado (4xx): descarta.
    if ((e as { status?: number }).status && (e as { status: number }).status < 500) clearCoupon()
    return null
  }
}

/** Cupom da tela de cadastro: do endereço (?cupom=) ou o guardado; confere com o servidor. */
export function useCouponFromUrl(param: string | null) {
  const [coupon, setCoupon] = useState<CouponInfo | null>(null)
  useEffect(() => {
    const code = param ? normalizeCoupon(param) : pendingCoupon()
    if (!code) return
    let alive = true
    fetchCoupon(code)
      .then((c) => {
        if (!alive) return
        saveCoupon(c.code)
        setCoupon(c)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [param])
  return [coupon, setCoupon] as const
}
