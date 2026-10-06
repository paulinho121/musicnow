import { Navigate, useParams } from 'react-router'
import { normalizeCoupon, saveCoupon } from '../lib/coupon'

/** Link do parceiro (/p/luiz): guarda o cupom no aparelho e leva ao cadastro já com ele. */
export function PartnerLink() {
  const c = normalizeCoupon(useParams().code ?? '')
  // Guarda já na renderização (antes do redirecionamento): repetir não faz mal.
  if (c) saveCoupon(c)
  return <Navigate to={c ? `/criar-conta?cupom=${c}` : '/criar-conta'} replace />
}
