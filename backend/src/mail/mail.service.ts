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
  rodadaTitulo: string;
  itens: ItemEmailParticipante[];
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
  participantes: {
    nome: string;
    email: string;
    valorAPagar: number;
    statusPagamento: 'PENDENTE' | 'PAGO';
    itens: ItemEmailParticipante[];
  }[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  readonly frontendUrl: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')?.trim();
    this.from = config.get<string>('SMTP_FROM', 'Cafezinho Infor <no-reply@cafezinhoinfor.com.br>');
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    if (host) {
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
        'SMTP_HOST nao configurado: e-mails serao exibidos no terminal do backend.',
      );
    }
  }

  async enviar(email: EnvioEmail): Promise<void> {
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
      html: email.html,
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

    const htmlPagamento =
      p.valorTotalAPagar > 0
        ? `<div style="margin-top:16px;padding:12px;border:1px solid #e2cdb3;background:#faf6f1;border-radius:8px;max-width:540px">
            <h3 style="margin:0 0 8px 0;color:#583619">Dados para pagamento</h3>
            <p style="margin:4px 0"><strong>Organizador:</strong> ${escapeHtml(p.pagamento.organizadorNome)}</p>
            ${p.pagamento.pixChave ? `<p style="margin:4px 0"><strong>Chave PIX:</strong> <code>${escapeHtml(p.pagamento.pixChave)}</code></p>` : ''}
            ${p.pagamento.banco ? `<p style="margin:4px 0"><strong>Banco:</strong> ${escapeHtml(p.pagamento.banco)}</p>` : ''}
            ${p.pagamento.agencia ? `<p style="margin:4px 0"><strong>Agência:</strong> ${escapeHtml(p.pagamento.agencia)}</p>` : ''}
            ${p.pagamento.conta ? `<p style="margin:4px 0"><strong>Conta:</strong> ${escapeHtml(p.pagamento.conta)}</p>` : ''}
            ${!p.pagamento.pixChave && !p.pagamento.banco && !p.pagamento.agencia && !p.pagamento.conta ? '<p style="margin:4px 0"><em>Dados bancários/PIX ainda não informados — consulte o organizador.</em></p>' : ''}
          </div>`
        : '';

    await this.enviar({
      para: p.para,
      assunto: `Pedido fechado: ${p.rodadaTitulo} - Cafezinho Infor`,
      texto:
        `Ola ${p.nomeParticipante}!\n\n` +
        `A rodada "${p.rodadaTitulo}" foi fechada.\n\n` +
        `Seus pedidos confirmados (em caixas fechadas):\n${textoConfirmados}\n\n` +
        `Total a pagar: ${brl(p.valorTotalAPagar)}` +
        textoNaoFechados +
        textoPagamento,
      html: `
        <p>Olá, <strong>${escapeHtml(p.nomeParticipante)}</strong>!</p>
        <p>A rodada <strong>${escapeHtml(p.rodadaTitulo)}</strong> foi fechada. Confira abaixo o resumo do seu pedido:</p>
        <h3 style="color:#583619">Pedidos confirmados (em caixas fechadas)</h3>
        ${htmlConfirmados}
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
        return `- ${part.nome} (${part.email}) | A pagar: ${brl(part.valorAPagar)} [${part.statusPagamento}]\n${itensStr}`;
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
                <strong>A pagar: ${brl(part.valorAPagar)}</strong> (${part.statusPagamento})
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

    await this.enviar({
      para: p.para,
      assunto: `[Organizador] Detalhamento da rodada fechada: ${p.rodadaTitulo} - Cafezinho Infor`,
      texto:
        `Ola ${p.nomeOrganizador}!\n\n` +
        `A rodada "${p.rodadaTitulo}" foi fechada.\n\n` +
        `RESUMO PARA COMPRA NA NESPRESSO (${p.totalCaixas} caixas / ${p.totalCapsulas} capsulas / ${brl(p.valorCompraNespresso)}):\n${textoCaixas}` +
        textoNaoFechados +
        `\n\nDETALHAMENTO POR PARTICIPANTE:\n${textoParticipantes || '- Nenhum participante.'}`,
      html: `
        <p>Olá, <strong>${escapeHtml(p.nomeOrganizador)}</strong>!</p>
        <p>A rodada <strong>${escapeHtml(p.rodadaTitulo)}</strong> foi fechada. Segue o detalhamento completo para a compra e controle de pagamentos:</p>
        <h3 style="color:#583619">Resumo para compra na Nespresso (caixas fechadas)</h3>
        ${htmlCaixas}
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
