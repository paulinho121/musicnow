import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
})

export const { useSession, signIn, signUp, signOut } = authClient

/**
 * Lembra no aparelho que há alguém logado. Sem internet (ou com o servidor fora do ar) a
 * checagem do login falha: aí o app entra mesmo assim com o que está salvo (palco sem sinal),
 * em vez de mandar para a tela de login. Login expirado de verdade (resposta "sem sessão") sai.
 */
const SESSION_KEY = 'ef-sessao'
const SESSION_MAX_AGE = 60 * 24 * 60 * 60 * 1000

export function rememberSession(userId: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: Date.now() }))
  } catch {
    // sem localStorage: sem modo offline do login
  }
}

export function rememberedSession(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { userId: string; at: number } | null
    return v && Date.now() - v.at < SESSION_MAX_AGE ? v.userId : null
  } catch {
    return null
  }
}

function forgetSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // nada a esquecer
  }
}

/**
 * Apaga as respostas da API guardadas para uso offline. Chamado ao sair e ao entrar:
 * num aparelho compartilhado (tablet da igreja), um músico não pode ver as músicas do anterior.
 */
export async function clearOfflineData() {
  try {
    if ('caches' in window) await Promise.all(['api', 'covers'].map((c) => caches.delete(c)))
    // As marcas "baixado para o show" eram da conta anterior.
    for (const k of Object.keys(localStorage)) if (k.startsWith('ef-offline:')) localStorage.removeItem(k)
  } catch {
    // navegador sem Cache Storage: nada a limpar
  }
}

export async function logout() {
  forgetSession()
  await signOut().catch(() => {})
  await clearOfflineData()
}

// Better Auth devolve códigos em inglês; aqui viram mensagens para o usuário.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  INVALID_PASSWORD: 'Senha incorreta.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail. Tente entrar.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este e-mail. Tente entrar.',
  PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'A senha é longa demais.',
  INVALID_EMAIL: 'Digite um e-mail válido.',
  INVALID_TOKEN: 'Este link de redefinição é inválido ou já expirou. Peça um novo.',
}

export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!err) return 'Não foi possível concluir. Tente novamente.'
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]
  if (err.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  return err.message || 'Não foi possível concluir. Tente novamente.'
}
