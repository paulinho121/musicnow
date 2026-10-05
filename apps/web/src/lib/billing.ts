import type { PlanId } from '@ensaio/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { keys } from './queries'
import type { BillingPayment } from './types'

/** A API respondeu 402 (criar/editar sem assinatura): abre a janela "Assine para continuar". */
export const PAYWALL_EVENT = 'ef-paywall'
export const openPaywall = (message: string) => window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: message }))

export function usePayments(enabled: boolean) {
  return useQuery({ queryKey: ['billing', 'payments'], queryFn: () => api<BillingPayment[]>('/billing/payments'), enabled })
}

/** Começa a assinatura e leva para a página de pagamento do Asaas (Pix, cartão ou boleto). */
export function useCheckout() {
  return useMutation({
    mutationFn: (body: { plan: PlanId; name: string; cpfCnpj: string }) =>
      api<{ invoiceUrl: string }>('/billing/checkout', { method: 'POST', json: body }),
    onSuccess: ({ invoiceUrl }) => window.location.assign(invoiceUrl),
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/billing/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  })
}
