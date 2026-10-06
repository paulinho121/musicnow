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
function layout({
  title,
  body,
  button,
  reminder = false,
}: {
  title: string
  body: string
  button?: { label: string; url: string }
  /** Lembrete (pode ser desligado no perfil): o rodapé diz como. */
  reminder?: boolean
}) {
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
  <p style="font-size:12px;color:#8a8f9c;margin-top:16px">Você recebeu este e-mail porque tem uma conta no Ensaio Fácil.${
    reminder ? ` Não quer lembretes? <a href="${escapeHtml(env.APP_URL)}/perfil" style="color:#8a8f9c">Desligue no seu perfil</a>.` : ''
  }</p>
  </td></tr></table></body></html>`
}

export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  // Testes automáticos criam contas de mentira: nunca mandam e-mail de verdade.
  if (process.env.NODE_ENV === 'test') return
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

export async function sendSetlistInviteEmail(to: string, fromName: string, setlistName: string, url: string) {
  await sendMail({
    to,
    subject: `${fromName} te convidou para o repertório "${setlistName}"`,
    text: `${fromName} te convidou para participar do repertório "${setlistName}" no Ensaio Fácil.\n\nAbra o link para entrar (vale por 14 dias):\n${url}`,
    html: layout({
      title: `Convite para "${setlistName}"`,
      body: `<p style="font-size:15px;line-height:1.5"><b>${escapeHtml(fromName)}</b> te convidou para participar do repertório <b>${escapeHtml(setlistName)}</b>. Lá você encontra a ordem das músicas, o tom de cada uma e as marcações da banda.</p>`,
      button: { label: 'Entrar no repertório', url },
    }),
  })
}

// ---------------------------------------------------------------- ciclo de vida da conta

const p = (html: string) => `<p style="font-size:15px;line-height:1.5">${html}</p>`
const first = (name: string) => escapeHtml(name.split(' ')[0] || name)
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long' })

export async function sendWelcomeEmail(to: string, name: string) {
  const url = `${env.APP_URL}/comecar`
  await sendMail({
    to,
    subject: 'Bem-vindo ao Ensaio Fácil: seu repertório em 1 minuto',
    text: `Olá, ${name}!

Sua conta está pronta. Comece em 3 passos:
1. Abra a música de exemplo e troque o tom.
2. Cole a lista do seu show (do WhatsApp mesmo): ${url}
3. Mande o link para a banda: eles entram de graça.

Bons ensaios!`,
    html: layout({
      title: `Bem-vindo, ${name.split(' ')[0] || name}!`,
      body:
        p('Sua conta está pronta. Em 3 passos a banda toda já está tocando junto:') +
        `<ol style="font-size:15px;line-height:1.7;padding-left:20px;margin:0">
          <li>Abra a <b>música de exemplo</b> e troque o tom com um toque.</li>
          <li><b>Cole a lista</b> do seu próximo show, do WhatsApp mesmo: o app separa blocos e tons.</li>
          <li>Mande o link para a <b>banda</b>: eles entram de graça e veem tudo no mesmo tom.</li>
        </ol>`,
      button: { label: 'Montar meu primeiro repertório', url },
    }),
  })
}

export async function sendTrialEndingEmail(to: string, name: string, endsAt: Date, daysLeft: number) {
  const url = `${env.APP_URL}/assinatura`
  const when = daysLeft <= 1 ? 'amanhã' : `em ${daysLeft} dias`
  await sendMail({
    to,
    subject: `Seu teste grátis do Ensaio Fácil acaba ${when}`,
    text: `Olá, ${name}! Seu teste grátis acaba ${when} (${dateBR(endsAt)}). Para continuar criando e editando músicas e repertórios, assine por R$ 9,99/mês ou R$ 99,90/ano: ${url}

Suas músicas continuam salvas e você continua podendo abrir e tocar tudo.`,
    html: layout({
      title: `Seu teste grátis acaba ${when}`,
      body:
        p(`Olá, ${first(name)}! Seu teste grátis vai até <b>${dateBR(endsAt)}</b>.`) +
        p(
          'Para continuar <b>criando e editando</b> músicas e repertórios, assine por <b>R$ 9,99/mês</b> ou <b>R$ 99,90/ano</b> (2 meses grátis). Os músicos convidados nunca pagam.',
        ) +
        p('Fique tranquilo: suas músicas continuam salvas e você continua podendo abrir e tocar tudo.'),
      button: { label: 'Escolher meu plano', url },
      reminder: true,
    }),
  })
}

export async function sendTrialEndedEmail(to: string, name: string) {
  const url = `${env.APP_URL}/assinatura`
  await sendMail({
    to,
    subject: 'Seu teste grátis do Ensaio Fácil terminou',
    text: `Olá, ${name}! Seu teste grátis terminou. Suas músicas e repertórios continuam salvos e você pode abrir e tocar tudo. Para voltar a criar e editar, assine: ${url}`,
    html: layout({
      title: 'Seu teste grátis terminou',
      body:
        p(`Olá, ${first(name)}! Suas músicas e repertórios continuam <b>salvos</b> e você ainda pode abrir e tocar tudo.`) +
        p('Para voltar a <b>criar e editar</b>, é só assinar. Leva 1 minuto, com Pix, boleto ou cartão.'),
      button: { label: 'Assinar agora', url },
      reminder: true,
    }),
  })
}

export async function sendPaymentConfirmedEmail(to: string, name: string, value: number, until: Date, invoiceUrl: string | null) {
  await sendMail({
    to,
    subject: 'Pagamento confirmado: obrigado por assinar o Ensaio Fácil',
    text: `Olá, ${name}! Recebemos seu pagamento de ${brl(value)}. Sua assinatura vale até ${dateBR(until)}.${
      invoiceUrl
        ? `
Comprovante: ${invoiceUrl}`
        : ''
    }`,
    html: layout({
      title: 'Pagamento confirmado',
      body:
        p(`Olá, ${first(name)}! Recebemos seu pagamento de <b>${brl(value)}</b>. Obrigado por apoiar o Ensaio Fácil!`) +
        p(`Sua assinatura vale até <b>${dateBR(until)}</b> e renova sozinha.`),
      button: invoiceUrl ? { label: 'Ver comprovante', url: invoiceUrl } : { label: 'Abrir o Ensaio Fácil', url: `${env.APP_URL}/inicio` },
    }),
  })
}

export async function sendPaymentOverdueEmail(to: string, name: string, value: number, invoiceUrl: string | null) {
  const url = invoiceUrl ?? `${env.APP_URL}/assinatura`
  await sendMail({
    to,
    subject: 'Não conseguimos confirmar seu pagamento do Ensaio Fácil',
    text: `Olá, ${name}! O pagamento de ${brl(value)} da sua assinatura ainda não foi confirmado. Pague por aqui para não perder o acesso: ${url}

Se já pagou, pode ignorar: a confirmação chega em até 1 dia útil.`,
    html: layout({
      title: 'Pagamento pendente',
      body:
        p(
          `Olá, ${first(name)}! O pagamento de <b>${brl(value)}</b> da sua assinatura ainda não foi confirmado (cartão recusado ou boleto/Pix vencido).`,
        ) +
        p('Pague pelo link abaixo para não perder o acesso a criar e editar. Você tem <b>3 dias</b> de tolerância.') +
        p('Se já pagou, pode ignorar: a confirmação chega em até 1 dia útil.'),
      button: { label: 'Pagar agora', url },
    }),
  })
}

export async function sendShowTomorrowEmail(
  to: string,
  name: string,
  show: { name: string; eventDate: Date; location: string | null; songCount: number; url: string },
) {
  const time = show.eventDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const where = [`amanhã às ${time}`, show.location].filter(Boolean).join(' · ')
  await sendMail({
    to,
    subject: `Amanhã: ${show.name}`,
    text: `Olá, ${name}! "${show.name}" é ${where}. São ${show.songCount} músicas. Repasse o repertório: ${show.url}`,
    html: layout({
      title: `Amanhã: ${show.name}`,
      body:
        p(`Olá, ${first(name)}! <b>${escapeHtml(show.name)}</b> é ${escapeHtml(where)}.`) +
        p(
          `São <b>${show.songCount} ${show.songCount === 1 ? 'música' : 'músicas'}</b>. Que tal uma última passada nos tons e nas marcações da banda?`,
        ),
      button: { label: 'Abrir o repertório', url: show.url },
      reminder: true,
    }),
  })
}
