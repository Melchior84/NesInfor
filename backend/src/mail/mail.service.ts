import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EnvioEmail {
  para: string;
  assunto: string;
  texto: string;
  html: string;
  linkDestaque?: string;
}

export interface DadosPagamentoEmail {
  organizadorNome: string;
  pixChave: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
}

export interface ItemEmailParticipante {
  sabor: string;
  quantidadeConfirmada: number;
  quantidadeNaoFechada: number;
  precoUnitario: number;
  valorConfirmado: number;
}

export interface EmailFechamentoParticipanteParams {
  para: string;
  nomeParticipante: string;
  rodadaId?: number;
  rodadaTitulo: string;
  itens: ItemEmailParticipante[];
  cafezinhosGorjeta: number;
  valorGorjeta: number;
  valorTotalAPagar: number;
  pagamento: DadosPagamentoEmail;
}

export interface EmailFechamentoOrganizadorParams {
  para: string;
  nomeOrganizador: string;
  rodadaTitulo: string;
  caixasFechadas: {
    sabor: string;
    caixas: number;
    capsulas: number;
    tamanhoCaixa: number;
    valor: number;
  }[];
  naoFecharam: {
    sabor: string;
    sobra: number;
    faltam: number;
  }[];
  totalCaixas: number;
  totalCapsulas: number;
  valorCompraNespresso: number;
  totalCafezinhosGorjeta: number;
  totalValorGorjeta: number;
  participantes: {
    nome: string;
    email: string;
    cafezinhosGorjeta: number;
    valorGorjeta: number;
    valorAPagar: number;
    statusPagamento: 'PENDENTE' | 'PAGO';
    itens: ItemEmailParticipante[];
  }[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly brevoApiKey: string | null;
  private readonly from: string;
  private readonly senderName: string;
  private readonly senderEmail: string;
  readonly frontendUrl: string;

  constructor(config: ConfigService) {
    const brevoKey = config.get<string>('BREVO_API_KEY')?.trim() || null;
    const host = config.get<string>('SMTP_HOST')?.trim();
    this.from = config.get<string>(
      'SMTP_FROM',
      'Cafezinho Infor <no-reply@cafezinhoinfor.com.br>',
    );
    const parsedFrom = parseFrom(this.from);
    this.senderName = parsedFrom.name;
    this.senderEmail = parsedFrom.email;
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    this.brevoApiKey = brevoKey;

    if (brevoKey) {
      this.transporter = null;
      this.logger.log(
        `Brevo API HTTPS configurada (remetente: ${this.senderEmail}).`,
      );
    } else if (host) {
      const port = Number(config.get('SMTP_PORT', 587));
      const secure = String(config.get('SMTP_SECURE', 'false')) === 'true';
      const user = config.get<string>('SMTP_USER')?.trim();
      const pass = config.get<string>('SMTP_PASS');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        ...(user ? { auth: { user, pass } } : {}),
      });
      this.logger.log(`SMTP configurado em ${host}:${port}.`);
    } else {
      this.transporter = null;
      this.logger.warn(
        'Nenhum provedor de e-mail configurado (BREVO_API_KEY ou SMTP_HOST): e-mails serao exibidos no terminal do backend.',
      );
    }
  }

  async enviar(email: EnvioEmail): Promise<void> {
    const htmlComRodape =
      email.html +
      `<hr style="margin-top:24px;border:none;border-top:1px solid #e7e5e4" />` +
      `<p style="font-size:11px;color:#a8a29e">Cafezinho Infor · Desenvolvido por <strong>Studios Melk</strong></p>`;

    if (this.brevoApiKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: email.para }],
          subject: email.assunto,
          htmlContent: htmlComRodape,
          textContent: email.texto,
        }),
      });
      if (!res.ok) {
        const detalhe = await res.text();
        this.logger.error(`Erro Brevo API (${res.status}): ${detalhe}`);
        throw new Error(`Falha ao enviar e-mail via Brevo (${res.status}).`);
      }
      this.logger.log(`E-mail enviado via Brevo API para ${email.para}.`);
      return;
    }

    if (!this.transporter) {
      this.logger.log(
        [
          '================ [E-MAIL DEV (sem SMTP)] ================',
          `Para:    ${email.para}`,
          `Assunto: ${email.assunto}`,
          email.linkDestaque ? `Link:    ${email.linkDestaque}` : null,
          `Corpo:   ${email.texto}`,
          '=========================================================',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
      html: htmlComRodape,
    });
  }

  async enviarConfirmacaoEmail(para: string, nome: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/confirmar-email?token=${encodeURIComponent(token)}`;
    await this.enviar({
      para,
      assunto: 'Confirme seu e-mail - Cafezinho Infor',
      linkDestaque: link,
      texto: `Ola ${nome}, confirme seu e-mail para acessar o Cafezinho Infor: ${link} (valido por 24 horas).`,
      html: `
        <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
        <p>Para concluir seu cadastro no <strong>Cafezinho Infor</strong> e liberar o acesso, clique no link abaixo:</p>
        <p><a href="${link}">Confirmar meu e-mail</a></p>
        <p style="font-size:12px;color:#666">Este link é válido por 24 horas. Se você não criou esta conta, ignore este e-mail.</p>
      `,
    });
  }

  async enviarRecuperacaoSenha(para: string, nome: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    await this.enviar({
      para,
      assunto: 'Recuperação de senha - Cafezinho Infor',
      linkDestaque: link,
      texto: `Ola ${nome}, use este link para redefinir sua senha no Cafezinho Infor: ${link} (valido por 1 hora).`,
      html: `
        <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
        <p>Recebemos uma solicitação para redefinir sua senha no <strong>Cafezinho Infor</strong>.</p>
        <p><a href="${link}">Definir nova senha</a></p>
        <p style="font-size:12px;color:#666">Este link expira em 1 hora. Se não foi você, ignore este e-mail.</p>
      `,
    });
  }

  async enviarSenhaZeradaPorAdmin(
    para: string,
    nome: string,
    senhaTemporaria: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/login`;
    await this.enviar({
      para,
      assunto: 'Sua senha foi redefinida por um administrador - Cafezinho Infor',
      linkDestaque: link,
      texto: `Ola ${nome}, um administrador zerou sua senha no Cafezinho Infor. Senha temporaria: ${senhaTemporaria}. No proximo login voce devera escolher uma nova senha. Acesse: ${link}`,
      html: `
        <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
        <p>Um administrador redefiniu sua senha no <strong>Cafezinho Infor</strong>.</p>
        <p>Sua senha temporária é: <code><strong>${escapeHtml(senhaTemporaria)}</strong></code></p>
        <p>No próximo acesso em <a href="${link}">${link}</a>, você será solicitado a cadastrar uma nova senha.</p>
      `,
    });
  }

  async enviarAvisoNovoCadastroPendente(
    paraAdmin: string,
    nomeAdmin: string,
    novoNome: string,
    novoEmail: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/admin/usuarios`;
    await this.enviar({
      para: paraAdmin,
      assunto: `Novo cadastro aguardando aprovação: ${novoNome} - Cafezinho Infor`,
      linkDestaque: link,
      texto: `Ola ${nomeAdmin}, ${novoNome} (${novoEmail}) confirmou o e-mail e aguarda sua aprovacao para acessar o Cafezinho Infor. Aprove ou recuse em: ${link}`,
      html: `
        <p>Olá, <strong>${escapeHtml(nomeAdmin)}</strong>!</p>
        <p>Um novo usuário confirmou o e-mail e aguarda aprovação de um administrador para acessar o <strong>Cafezinho Infor</strong>:</p>
        <ul>
          <li><strong>Nome:</strong> ${escapeHtml(novoNome)}</li>
          <li><strong>E-mail:</strong> ${escapeHtml(novoEmail)}</li>
        </ul>
        <p><a href="${link}">Abrir painel de Usuários para aprovar ou recusar</a></p>
      `,
    });
  }

  async enviarCadastroAprovado(para: string, nome: string): Promise<void> {
    const link = `${this.frontendUrl}/login`;
    await this.enviar({
      para,
      assunto: 'Seu cadastro foi aprovado! - Cafezinho Infor',
      linkDestaque: link,
      texto: `Ola ${nome}, seu cadastro no Cafezinho Infor foi aprovado por um administrador! Voce ja pode acessar em: ${link}`,
      html: `
        <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
        <p>Boa notícia: seu cadastro no <strong>Cafezinho Infor</strong> foi <strong>aprovado</strong> por um administrador!</p>
        <p><a href="${link}">Acessar o Cafezinho Infor</a></p>
      `,
    });
  }

  async enviarNovaRodadaAberta(
    para: string,
    nome: string,
    rodadaTitulo: string,
    organizadorNome: string | null,
  ): Promise<void> {
    const link = `${this.frontendUrl}/`;
    const linkPainel = `${this.frontendUrl}/painel`;
    const orgTxt = organizadorNome ? ` Organizador: ${organizadorNome}.` : '';
    await this.enviar({
      para,
      assunto: `☕ Nova rodada aberta: ${rodadaTitulo} - Cafezinho Infor`,
      linkDestaque: link,
      texto:
        `Ola ${nome}!\n\n` +
        `Uma nova rodada de pedidos de cafe foi aberta: "${rodadaTitulo}".${orgTxt}\n\n` +
        `Acesse para escolher suas capsulas: ${link}\n\n` +
        `Se nao quiser mais receber avisos de cafe por e-mail, desative no seu Painel: ${linkPainel}`,
      html: `
        <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
        <p>☕ Uma nova rodada de pedidos coletivos foi aberta no <strong>Cafezinho Infor</strong>:</p>
        <div style="margin:12px 0;padding:12px;border:1px solid #e2cdb3;background:#faf6f1;border-radius:8px;max-width:520px">
          <p style="margin:0;font-size:16px;color:#583619"><strong>${escapeHtml(rodadaTitulo)}</strong></p>
          ${organizadorNome ? `<p style="margin:4px 0 0 0;font-size:13px;color:#57534e">Organizador: <strong>${escapeHtml(organizadorNome)}</strong></p>` : ''}
        </div>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#7c4a1d;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Fazer meu pedido de café</a></p>
        <p style="font-size:11px;color:#78716c;margin-top:16px">Você recebeu este aviso porque optou por receber e-mails sobre os cafés. Para alterar, acesse seu <a href="${linkPainel}">Painel</a>.</p>
      `,
    });
  }

  async enviarFechamentoParticipante(
    p: EmailFechamentoParticipanteParams,
  ): Promise<void> {
    const confirmados = p.itens.filter((i) => i.quantidadeConfirmada > 0);
    const naoFechados = p.itens.filter((i) => i.quantidadeNaoFechada > 0);

    const textoConfirmados = confirmados.length
      ? confirmados
          .map(
            (i) =>
              `- ${i.sabor}: ${i.quantidadeConfirmada} un. x ${brl(i.precoUnitario)} = ${brl(i.valorConfirmado)}`,
          )
          .join('\n')
      : '- Nenhum item seu entrou em caixa fechada nesta rodada.';

    const textoNaoFechados = naoFechados.length
      ? `\n\nItens que NAO fecharam caixa (nao entram na compra nem na cobranca):\n` +
        naoFechados
          .map((i) => `- ${i.sabor}: ${i.quantidadeNaoFechada} un.`)
          .join('\n')
      : '';

    const linhasPagTexto: string[] = [];
    if (p.pagamento.pixChave) linhasPagTexto.push(`PIX: ${p.pagamento.pixChave}`);
    if (p.pagamento.banco || p.pagamento.agencia || p.pagamento.conta) {
      linhasPagTexto.push(
        `Conta bancaria: ${[
          p.pagamento.banco ? `Banco ${p.pagamento.banco}` : null,
          p.pagamento.agencia ? `Agencia ${p.pagamento.agencia}` : null,
          p.pagamento.conta ? `Conta ${p.pagamento.conta}` : null,
        ]
          .filter(Boolean)
          .join(' | ')}`,
      );
    }
    const textoPagamento =
      p.valorTotalAPagar > 0
        ? `\n\nDados para pagamento (Organizador: ${p.pagamento.organizadorNome}):\n` +
          (linhasPagTexto.length
            ? linhasPagTexto.join('\n')
            : 'Consulte o organizador para os dados de pagamento.')
        : '';

    const htmlConfirmados = confirmados.length
      ? `<table style="border-collapse:collapse;width:100%;max-width:560px;font-size:14px">
          <thead>
            <tr style="background:#f5f5f4;text-align:left">
              <th style="padding:6px 8px;border:1px solid #e7e5e4">Sabor</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Qtd.</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Preço un.</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${confirmados
              .map(
                (i) => `<tr>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4">${escapeHtml(i.sabor)}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${i.quantidadeConfirmada}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${brl(i.precoUnitario)}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right"><strong>${brl(i.valorConfirmado)}</strong></td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>`
      : '<p><em>Nenhum item seu entrou em caixa fechada nesta rodada.</em></p>';

    const htmlNaoFechados = naoFechados.length
      ? `<h3 style="margin-top:16px;color:#b45309">Itens que não fecharam caixa (fora da compra)</h3>
         <ul>
           ${naoFechados
             .map(
               (i) =>
                 `<li>${escapeHtml(i.sabor)}: <strong>${i.quantidadeNaoFechada}</strong> cápsula(s) não confirmada(s)</li>`,
             )
             .join('')}
         </ul>`
      : '';

    const pixLimpo = p.pagamento.pixChave?.trim() || null;
    const isPixCopiaCola = Boolean(
      pixLimpo && pixLimpo.startsWith('000201') && pixLimpo.includes('br.gov.bcb.pix'),
    );
    const qrCodeUrl =
      isPixCopiaCola && p.rodadaId
        ? `${this.frontendUrl}/api/rodadas/${p.rodadaId}/pix-qrcode.png`
        : null;

    const htmlPagamento =
      p.valorTotalAPagar > 0
        ? `<div style="margin-top:16px;padding:14px;border:1px solid #e2cdb3;background:#faf6f1;border-radius:8px;max-width:540px">
            <h3 style="margin:0 0 8px 0;color:#583619">Dados para pagamento</h3>
            <p style="margin:4px 0"><strong>Organizador:</strong> ${escapeHtml(p.pagamento.organizadorNome)}</p>
            <p style="margin:4px 0"><strong>Valor a pagar:</strong> ${brl(p.valorTotalAPagar)}</p>
            ${
              qrCodeUrl
                ? `<div style="margin:12px 0;text-align:center;background:#ffffff;padding:12px;border-radius:8px;border:1px solid #e7e5e4">
                    <p style="margin:0 0 8px 0;font-size:13px;color:#583619"><strong>Pague via QR Code PIX</strong></p>
                    <img src="${qrCodeUrl}" alt="QR Code PIX" width="210" height="210" style="display:block;margin:0 auto;border:0" />
                    <p style="margin:8px 0 4px 0;font-size:12px;color:#78716c">Ou use o código <strong>PIX Copia e Cola</strong> abaixo:</p>
                    <div style="font-family:monospace;font-size:11px;word-break:break-all;background:#f5f5f4;padding:8px;border-radius:6px;text-align:left;color:#292524">${escapeHtml(pixLimpo!)}</div>
                  </div>`
                : pixLimpo
                  ? `<p style="margin:4px 0"><strong>Chave PIX:</strong> <code>${escapeHtml(pixLimpo)}</code></p>`
                  : ''
            }
            ${p.pagamento.banco ? `<p style="margin:4px 0"><strong>Banco:</strong> ${escapeHtml(p.pagamento.banco)}</p>` : ''}
            ${p.pagamento.agencia ? `<p style="margin:4px 0"><strong>Agência:</strong> ${escapeHtml(p.pagamento.agencia)}</p>` : ''}
            ${p.pagamento.conta ? `<p style="margin:4px 0"><strong>Conta:</strong> ${escapeHtml(p.pagamento.conta)}</p>` : ''}
            ${!pixLimpo && !p.pagamento.banco && !p.pagamento.agencia && !p.pagamento.conta ? '<p style="margin:4px 0"><em>Dados bancários/PIX ainda não informados — consulte o organizador.</em></p>' : ''}
          </div>`
        : '';

    const textoGorjeta =
      p.cafezinhosGorjeta > 0
        ? `\n\nCaixinha para o Cafezinho Infor: ${p.cafezinhosGorjeta} cafezinho(s) = ${brl(p.valorGorjeta)}\nMuito obrigado pelo apoio! Sua contribuicao ajuda a manter o Cafezinho Infor no ar.`
        : '';

    const htmlGorjeta =
      p.cafezinhosGorjeta > 0
        ? `<div style="margin-top:12px;padding:10px 12px;border:1px solid #d6c4b0;background:#fdf8f3;border-radius:8px;max-width:540px">
            <p style="margin:0;color:#583619"><strong>☕ Caixinha para o Cafezinho Infor:</strong> ${p.cafezinhosGorjeta} cafezinho(s) — <strong>${brl(p.valorGorjeta)}</strong></p>
            <p style="margin:4px 0 0 0;font-size:12px;color:#78716c">Muito obrigado pelo carinho! Sua contribuição ajuda a custear servidor, domínio e melhorias do Cafezinho Infor.</p>
          </div>`
        : '';

    await this.enviar({
      para: p.para,
      assunto: `Pedido fechado: ${p.rodadaTitulo} - Cafezinho Infor`,
      texto:
        `Ola ${p.nomeParticipante}!\n\n` +
        `A rodada "${p.rodadaTitulo}" foi fechada.\n\n` +
        `Seus pedidos confirmados (em caixas fechadas):\n${textoConfirmados}` +
        textoGorjeta +
        `\n\nTotal a pagar: ${brl(p.valorTotalAPagar)}` +
        textoNaoFechados +
        textoPagamento,
      html: `
        <p>Olá, <strong>${escapeHtml(p.nomeParticipante)}</strong>!</p>
        <p>A rodada <strong>${escapeHtml(p.rodadaTitulo)}</strong> foi fechada. Confira abaixo o resumo do seu pedido:</p>
        <h3 style="color:#583619">Pedidos confirmados (em caixas fechadas)</h3>
        ${htmlConfirmados}
        ${htmlGorjeta}
        <p style="font-size:16px;margin-top:12px"><strong>Total a pagar: ${brl(p.valorTotalAPagar)}</strong></p>
        ${htmlNaoFechados}
        ${htmlPagamento}
      `,
    });
  }

  async enviarFechamentoOrganizador(
    p: EmailFechamentoOrganizadorParams,
  ): Promise<void> {
    const textoCaixas = p.caixasFechadas.length
      ? p.caixasFechadas
          .map(
            (c) =>
              `- ${c.caixas}x caixa de ${c.tamanhoCaixa} - ${c.sabor} (${c.capsulas} un.) = ${brl(c.valor)}`,
          )
          .join('\n')
      : '- Nenhuma caixa fechada.';

    const textoNaoFechados = p.naoFecharam.length
      ? `\n\nSobras / sabores que NAO fecharam caixa:\n` +
        p.naoFecharam
          .map((n) => `- ${n.sabor}: ${n.sobra} un. (faltaram ${n.faltam})`)
          .join('\n')
      : '';

    const textoParticipantes = p.participantes
      .map((part) => {
        const itensStr = part.itens
          .map((i) => {
            const partes: string[] = [];
            if (i.quantidadeConfirmada > 0)
              partes.push(`${i.quantidadeConfirmada} confirmadas`);
            if (i.quantidadeNaoFechada > 0)
              partes.push(`${i.quantidadeNaoFechada} nao fechadas`);
            return `  * ${i.sabor}: ${partes.join(', ')}`;
          })
          .join('\n');
        const gorjetaStr =
          part.cafezinhosGorjeta > 0
            ? ` | Caixinha: ${part.cafezinhosGorjeta}x (${brl(part.valorGorjeta)})`
            : '';
        return `- ${part.nome} (${part.email}) | A pagar: ${brl(part.valorAPagar)}${gorjetaStr} [${part.statusPagamento}]\n${itensStr}`;
      })
      .join('\n');

    const htmlCaixas = p.caixasFechadas.length
      ? `<table style="border-collapse:collapse;width:100%;max-width:640px;font-size:14px">
          <thead>
            <tr style="background:#f5f5f4;text-align:left">
              <th style="padding:6px 8px;border:1px solid #e7e5e4">Sabor</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Caixas</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Cápsulas</th>
              <th style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${p.caixasFechadas
              .map(
                (c) => `<tr>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4">${escapeHtml(c.sabor)}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${c.caixas}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${c.capsulas}</td>
                  <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${brl(c.valor)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr style="background:#faf6f1;font-weight:bold">
              <td style="padding:6px 8px;border:1px solid #e7e5e4">Total</td>
              <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${p.totalCaixas}</td>
              <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${p.totalCapsulas}</td>
              <td style="padding:6px 8px;border:1px solid #e7e5e4;text-align:right">${brl(p.valorCompraNespresso)}</td>
            </tr>
          </tfoot>
        </table>`
      : '<p><em>Nenhuma caixa fechada nesta rodada.</em></p>';

    const htmlParticipantes = p.participantes.length
      ? p.participantes
          .map(
            (part) => `<div style="margin-bottom:12px;padding:10px;border:1px solid #e7e5e4;border-radius:6px;max-width:620px">
              <div style="font-size:14px">
                <strong>${escapeHtml(part.nome)}</strong> (${escapeHtml(part.email)}) —
                <strong>A pagar: ${brl(part.valorAPagar)}</strong>${
                  part.cafezinhosGorjeta > 0
                    ? ` <span style="color:#7c4a1d">(inclui ${part.cafezinhosGorjeta} cafezinho(s): ${brl(part.valorGorjeta)})</span>`
                    : ''
                } (${part.statusPagamento})
              </div>
              <ul style="margin:6px 0 0 0;padding-left:18px;font-size:13px">
                ${part.itens
                  .map(
                    (i) => `<li>${escapeHtml(i.sabor)}: ${
                      i.quantidadeConfirmada > 0
                        ? `<strong>${i.quantidadeConfirmada} confirmada(s)</strong> (${brl(i.valorConfirmado)})`
                        : '0 confirmada'
                    }${
                      i.quantidadeNaoFechada > 0
                        ? ` · <span style="color:#b45309">${i.quantidadeNaoFechada} fora da caixa</span>`
                        : ''
                    }</li>`,
                  )
                  .join('')}
              </ul>
            </div>`,
          )
          .join('')
      : '<p><em>Nenhum participante fez pedido.</em></p>';

    const textoCaixinhaOrg =
      p.totalCafezinhosGorjeta > 0
        ? `\n\nCAIXINHA PARA O CAFEZINHO INFOR: ${p.totalCafezinhosGorjeta} cafezinho(s) = ${brl(p.totalValorGorjeta)}`
        : '';

    const htmlCaixinhaOrg =
      p.totalCafezinhosGorjeta > 0
        ? `<div style="margin-top:16px;padding:10px 12px;border:1px solid #d6c4b0;background:#fdf8f3;border-radius:8px;max-width:620px">
            <strong>☕ Caixinha para o Cafezinho Infor nesta rodada:</strong> ${p.totalCafezinhosGorjeta} cafezinho(s) — <strong>${brl(p.totalValorGorjeta)}</strong>
          </div>`
        : '';

    await this.enviar({
      para: p.para,
      assunto: `[Organizador] Detalhamento da rodada fechada: ${p.rodadaTitulo} - Cafezinho Infor`,
      texto:
        `Ola ${p.nomeOrganizador}!\n\n` +
        `A rodada "${p.rodadaTitulo}" foi fechada.\n\n` +
        `RESUMO PARA COMPRA NA NESPRESSO (${p.totalCaixas} caixas / ${p.totalCapsulas} capsulas / ${brl(p.valorCompraNespresso)}):\n${textoCaixas}` +
        textoCaixinhaOrg +
        textoNaoFechados +
        `\n\nDETALHAMENTO POR PARTICIPANTE:\n${textoParticipantes || '- Nenhum participante.'}`,
      html: `
        <p>Olá, <strong>${escapeHtml(p.nomeOrganizador)}</strong>!</p>
        <p>A rodada <strong>${escapeHtml(p.rodadaTitulo)}</strong> foi fechada. Segue o detalhamento completo para a compra e controle de pagamentos:</p>
        <h3 style="color:#583619">Resumo para compra na Nespresso (caixas fechadas)</h3>
        ${htmlCaixas}
        ${htmlCaixinhaOrg}
        ${
          p.naoFecharam.length
            ? `<h3 style="color:#b45309;margin-top:16px">Sobras / sabores fora da compra</h3>
               <ul>${p.naoFecharam
                 .map(
                   (n) =>
                     `<li>${escapeHtml(n.sabor)}: ${n.sobra} un. (faltaram ${n.faltam})</li>`,
                 )
                 .join('')}</ul>`
            : ''
        }
        <h3 style="color:#583619;margin-top:20px">Todas as solicitações por participante</h3>
        ${htmlParticipantes}
      `,
    });
  }
}

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function brl(valor: number): string {
  return fmtBrl.format(Number(valor ?? 0));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: 'Cafezinho Infor', email: from.trim() };
}
