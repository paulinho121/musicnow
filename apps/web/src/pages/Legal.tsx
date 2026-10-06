import { formatBRL, GRACE_DAYS, PLANS, TRIAL_DAYS } from '@ensaio/shared'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'

// Dados do responsável pelo app. PREENCHER antes de cobrar (exigência do Código de Defesa
// do Consumidor e da LGPD): razão social ou nome, CNPJ/MEI e um e-mail de atendimento.
export const COMPANY = {
  name: import.meta.env.VITE_COMPANY_NAME ?? '[NOME OU RAZÃO SOCIAL]',
  document: import.meta.env.VITE_COMPANY_DOCUMENT ?? '[CNPJ]',
  email: import.meta.env.VITE_SUPPORT_EMAIL ?? '[E-MAIL DE ATENDIMENTO]',
}
const UPDATED = '5 de outubro de 2026'

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/" aria-label="Início">
          <Logo />
        </Link>
        <button
          className="btn-ghost h-9 px-3 text-sm"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign('/'))}
        >
          <ArrowLeft className="size-4" /> Voltar
        </button>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Atualizado em {UPDATED}</p>
      <div className="legal mt-6 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </div>
  )
}

export function Terms() {
  return (
    <LegalPage title="Termos de uso">
      <p>
        O Ensaio Fácil é um app para músicos organizarem cifras, partituras e repertórios e tocarem juntos. Ele é oferecido por{' '}
        {COMPANY.name}, CNPJ {COMPANY.document}. Ao criar uma conta, você concorda com estes termos.
      </p>

      <h2>1. Conta</h2>
      <p>Você é responsável pelo que faz na sua conta e por manter a sua senha em segredo. Cada conta é pessoal.</p>

      <h2>2. Teste grátis e assinatura</h2>
      <ul>
        <li>Toda conta nova tem {TRIAL_DAYS} dias de teste com tudo liberado, sem pedir cartão.</li>
        <li>
          Cupons de parceiros podem dar mais dias de teste. Cada conta usa um cupom só, nos primeiros 7 dias depois do cadastro e antes da
          primeira assinatura.
        </li>
        <li>
          Depois do teste, ver e tocar músicas e repertórios continua gratuito. Para criar e editar músicas, partituras e repertórios, é
          preciso assinar: plano mensal de {formatBRL(PLANS.monthly.price)} ou anual de {formatBRL(PLANS.yearly.price)}.
        </li>
        <li>Músicos convidados para o repertório de um assinante tocam e fazem marcações de graça.</li>
        <li>
          O pagamento é feito pelo Asaas (Pix, cartão ou boleto). A assinatura renova sozinha no fim de cada período, pelo mesmo valor, até
          você cancelar. Avisaremos com antecedência qualquer mudança de preço.
        </li>
        <li>
          Se um pagamento atrasar, a edição continua por {GRACE_DAYS} dias; depois, a conta fica só para leitura até o pagamento. Nada é
          apagado.
        </li>
      </ul>

      <h2>3. Cancelamento e reembolso</h2>
      <ul>
        <li>Você cancela quando quiser, pelo próprio app (Perfil → Assinatura). O acesso continua até o fim do período já pago.</li>
        <li>
          Direito de arrependimento (art. 49 do Código de Defesa do Consumidor): em até 7 dias depois de um pagamento, você pode pedir o
          reembolso integral pelo e-mail {COMPANY.email}.
        </li>
      </ul>

      <h2>4. O que você coloca no app</h2>
      <ul>
        <li>
          Cifras, letras, partituras e arquivos que você cadastra continuam sendo seus (ou de quem detém os direitos). Você só deve
          cadastrar conteúdo que tem direito de usar.
        </li>
        <li>
          Músicas novas são privadas: só você e os músicos dos seus repertórios veem. Publicar para todos exige informar a licença (obra
          própria, domínio público ou licenciada).
        </li>
        <li>
          Podemos remover conteúdo que viole direitos de terceiros, após denúncia ou aviso. Há um botão de denúncia em cada música pública.
        </li>
      </ul>

      <h2>5. Uso aceitável</h2>
      <p>
        Não é permitido usar o app para enviar conteúdo ilegal, tentar acessar contas de outras pessoas ou sobrecarregar o serviço. Contas
        que fizerem isso podem ser bloqueadas.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        Trabalhamos para o app estar sempre no ar, mas falhas podem acontecer. Recomendamos abrir as músicas do repertório antes do show
        (elas ficam guardadas no aparelho). Não nos responsabilizamos por perdas causadas por indisponibilidade, na medida permitida pela
        lei.
      </p>

      <h2>7. Mudanças nestes termos</h2>
      <p>Se mudarmos estes termos, avisaremos no app. Continuar usando depois do aviso significa concordar com a nova versão.</p>

      <h2>8. Contato e foro</h2>
      <p>Dúvidas: {COMPANY.email}. Fica eleito o foro do domicílio do consumidor, conforme o Código de Defesa do Consumidor.</p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Esta política explica quais dados o Ensaio Fácil coleta, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de
        Dados (LGPD, Lei 13.709/2018). Responsável: {COMPANY.name}, CNPJ {COMPANY.document}. Contato do encarregado: {COMPANY.email}.
      </p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li>
          <b>Conta:</b> nome, e-mail e senha (guardada de forma criptografada; nem nós conseguimos lê-la). Se você entrar com o Google,
          recebemos nome, e-mail e foto.
        </li>
        <li>
          <b>Perfil:</b> cidade, função e instrumentos, se você preencher.
        </li>
        <li>
          <b>Conteúdo:</b> músicas, cifras, partituras, repertórios, marcações e convites que você cria.
        </li>
        <li>
          <b>Assinatura:</b> nome e CPF/CNPJ, enviados ao Asaas para a cobrança e a nota fiscal. Os dados de cartão são digitados direto no
          Asaas; o Ensaio Fácil não os vê nem guarda.
        </li>
        <li>
          <b>Uso do app:</b> páginas visitadas, navegador e uma impressão irreversível do endereço IP (não guardamos o IP em si), para
          estatísticas e segurança. Esses registros são apagados depois de 90 dias. Também mostramos quem está online no momento.
        </li>
        <li>
          <b>Erros do app:</b> quando uma tela falha, registramos a mensagem técnica, a página e o navegador para corrigir o problema (sem o
          que você digitou). Apagados depois de 30 dias sem se repetir.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Prestar o serviço: guardar o seu conteúdo e compartilhar repertórios com a sua banda (execução de contrato).</li>
        <li>Cobrar a assinatura e emitir nota fiscal (execução de contrato e obrigação legal).</li>
        <li>Segurança, prevenção de abuso e melhoria do app (legítimo interesse).</li>
        <li>Enviar e-mails da conta, como recuperação de senha e avisos de cobrança. Não enviamos propaganda sem o seu consentimento.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>Músicos dos repertórios em que você está (veem o que for compartilhado no repertório).</li>
        <li>
          Asaas, para a cobrança. Oracle Cloud, onde o app e os dados ficam hospedados. O provedor de e-mail, para os e-mails da conta.
        </li>
        <li>Capas de álbum são buscadas no Cover Art Archive/MusicBrainz pelo título e artista (sem dados pessoais).</li>
        <li>Não vendemos os seus dados.</li>
      </ul>

      <h2>Por quanto tempo</h2>
      <p>
        Enquanto a sua conta existir. Você mesmo exclui a conta em <b>Perfil &gt; Excluir minha conta</b>: apagamos na hora os seus dados,
        exceto o que a lei manda guardar (como registros fiscais dos pagamentos). Músicas suas que estão no repertório de outras pessoas
        continuam lá como cópia delas, sem o seu nome. Cópias de segurança são substituídas em até 7 dias.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, cópia (portabilidade) e exclusão dos seus dados, e saber com quem eles foram compartilhados. Basta
        escrever para {COMPANY.email}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>Cookies</h2>
      <p>Usamos apenas os cookies necessários para manter você conectado. Não usamos cookies de propaganda.</p>
    </LegalPage>
  )
}
