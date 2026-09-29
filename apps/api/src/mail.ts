import nodemailer from 'nodemailer'
import { env } from './env'

// SMTP genérico: funciona com Gmail (senha de app), Brevo, Resend, Zoho...
// Sem SMTP configurado, o e-mail não sai: o link aparece no log do servidor.
const transport =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null

export const mailEnabled = transport !== null

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Layout simples, legível em qualquer cliente de e-mail (tabelas e estilos inline). */
function layout({ title, body, button }: { title: string; body: string; button?: { label: string; url: string } }) {
  const btn = button
    ? `<p style="margin:28px 0"><a href="${escapeHtml(button.url)}" style="background:#f5a524;color:#1a1204;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">${escapeHtml(button.label)}</a></p>
       <p style="font-size:13px;color:#6b7080">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${escapeHtml(button.url)}</span></p>`
    : ''
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#17181c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
    <p style="font-size:20px;font-weight:700;margin:0 0 24px">Ensaio <span style="color:#d97a06">Fácil</span></p>
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
    ${body}
    ${btn}
  </td></tr></table>
  <p style="font-size:12px;color:#8a8f9c;margin-top:16px">Você recebeu este e-mail porque tem uma conta no Ensaio Fácil.</p>
  </td></tr></table></body></html>`
}

export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  if (!transport) {
    console.warn(`[e-mail desativado] Para: ${to} | ${subject}\n${text}`)
    return
  }
  await transport.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, to, subject, html, text })
}

export async function sendPasswordResetEmail(to: string, name: string, url: string) {
  await sendMail({
    to,
    subject: 'Redefinir sua senha do Ensaio Fácil',
    text: `Olá, ${name}!\n\nRecebemos um pedido para redefinir sua senha. Abra o link abaixo (vale por 1 hora):\n${url}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: layout({
      title: 'Redefinir sua senha',
      body: `<p style="font-size:15px;line-height:1.5">Olá, ${escapeHtml(name)}! Recebemos um pedido para redefinir sua senha. O link vale por <b>1 hora</b>.</p>
             <p style="font-size:15px;line-height:1.5">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
      button: { label: 'Criar nova senha', url },
    }),
  })
}

export async function sendPasswordChangedEmail(to: string, name: string) {
  await sendMail({
    to,
    subject: 'Sua senha do Ensaio Fácil foi alterada',
    text: `Olá, ${name}! Sua senha foi alterada agora. Se não foi você, redefina a senha imediatamente em ${env.APP_URL}/esqueci-senha.`,
    html: layout({
      title: 'Senha alterada',
      body: `<p style="font-size:15px;line-height:1.5">Olá, ${escapeHtml(name)}! Sua senha foi alterada agora e as outras sessões foram encerradas.</p>
             <p style="font-size:15px;line-height:1.5">Se não foi você, redefina a senha imediatamente.</p>`,
      button: { label: 'Redefinir senha', url: `${env.APP_URL}/esqueci-senha` },
    }),
  })
}
