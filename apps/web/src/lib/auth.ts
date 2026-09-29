import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
})

export const { useSession, signIn, signUp, signOut } = authClient

// Better Auth devolve códigos em inglês; aqui viram mensagens para o usuário.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail. Tente entrar.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este e-mail. Tente entrar.',
  PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'A senha é longa demais.',
  INVALID_EMAIL: 'Digite um e-mail válido.',
}

export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!err) return 'Não foi possível concluir. Tente novamente.'
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]
  if (err.status === 429) return 'Muitas tentativas. Aguarde um minuto.'
  return err.message || 'Não foi possível concluir. Tente novamente.'
}
