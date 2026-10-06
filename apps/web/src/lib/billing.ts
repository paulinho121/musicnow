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

/** Começa a assinatura. A tela leva para a página de pagamento do app (Pix, boleto ou cartão). */
export function useCheckout() {
  return useMutation({
    mutationFn: (body: { plan: PlanId; name: string; cpfCnpj: string }) =>
      api<{ invoiceUrl: string; paymentId: string }>('/billing/checkout', { method: 'POST', json: body }),
  })
}

export interface CheckoutPayment {
  id: string
  status: string
  paid: boolean
  value: number
  dueDate: string
  description: string | null
  plan: PlanId | null
  pix: { image: string; payload: string; expiresAt: string | null } | null
  boleto: { line: string; pdfUrl: string | null } | null
  invoiceUrl: string
}

/** Cobrança para a página de pagamento; confere a cada 5 s até o pagamento cair. */
export function useCheckoutPayment(id: string) {
  return useQuery({
    queryKey: ['billing', 'pay', id],
    queryFn: () => api<CheckoutPayment>(`/billing/pay/${id}`),
    refetchInterval: (q) => (q.state.data?.paid ? false : 5000),
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/billing/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  })
}
