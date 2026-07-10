import { SERVICE_MAP } from "../../shared/services";
import type { Account } from "./accounts";
import { formatDate, formatPrice, sanitizePhone } from "./format";

export interface PixInfo {
  pixKey: string;
  pixName: string;
}

/** Lista os emails de telas extra cadastrados na conta (até 2), já formatados como linhas. */
function extraScreenLines(acc: Account): string[] {
  const emails = [acc.extraScreenEmail1, acc.extraScreenEmail2].filter(Boolean);
  if (emails.length === 0) return [];
  return emails.map((e, i) => `Tela extra ${i + 1}: ${e}`);
}

/** Monta o texto da mensagem de cobrança para o cliente. */
export function buildChargeMessage(acc: Account, pix: PixInfo): string {
  const serviceName = SERVICE_MAP[acc.service]?.name ?? acc.service;
  const price = formatPrice(acc.priceCents);
  const hello = acc.client ? `Olá, ${acc.client}!` : "Olá!";

  const lines: string[] = [
    hello,
    "",
    `Sua assinatura *${serviceName}* está vencida.`,
    `Login: ${acc.email}`,
    ...extraScreenLines(acc),
    `Vencimento: ${formatDate(acc.dueDate)}`,
  ];

  if (acc.priceCents > 0) {
    lines.push(`Valor para renovar: ${price}`);
  }

  if (pix.pixKey) {
    lines.push("");
    lines.push(`Pague via PIX:`);
    lines.push(`Chave: ${pix.pixKey}`);
    if (pix.pixName) lines.push(`Nome: ${pix.pixName}`);
  }

  lines.push("");
  lines.push("Após o pagamento, envie o comprovante. Obrigado!");

  return lines.join("\n");
}

/** Normaliza para formato internacional. Assume Brasil (55) se vier sem DDI. */
function normalizePhone(raw: string): string {
  let phone = sanitizePhone(raw);
  if (!phone) return "";
  // 10 ou 11 dígitos = número BR sem DDI (DDD + número) → prefixa 55
  if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
  return phone;
}

/** Gera o link wa.me com a mensagem pronta. Retorna null se não houver telefone. */
export function buildWhatsappLink(acc: Account, pix: PixInfo): string | null {
  const phone = normalizePhone(acc.whatsapp);
  if (!phone) return null;
  const text = encodeURIComponent(buildChargeMessage(acc, pix));
  return `https://wa.me/${phone}?text=${text}`;
}

/**
 * Monta uma única mensagem de cobrança agrupando várias contas vencidas do
 * mesmo cliente (ex: Netflix + HBO Max do mesmo cliente em uma mensagem só).
 */
export function buildBulkChargeMessage(accounts: Account[], pix: PixInfo): string {
  if (accounts.length === 0) return "";
  const clientName = accounts[0].client;
  const hello = clientName ? `Olá, ${clientName}!` : "Olá!";
  const totalCents = accounts.reduce((sum, a) => sum + (a.priceCents || 0), 0);

  const lines: string[] = [hello, ""];

  if (accounts.length === 1) {
    const acc = accounts[0];
    const serviceName = SERVICE_MAP[acc.service]?.name ?? acc.service;
    lines.push(`Sua assinatura *${serviceName}* está vencida.`);
    lines.push(`Login: ${acc.email}`);
    lines.push(...extraScreenLines(acc));
    lines.push(`Vencimento: ${formatDate(acc.dueDate)}`);
  } else {
    lines.push(`Suas assinaturas abaixo estão vencidas:`);
    lines.push("");
    for (const acc of accounts) {
      const serviceName = SERVICE_MAP[acc.service]?.name ?? acc.service;
      lines.push(`• *${serviceName}* — ${acc.email} (venceu ${formatDate(acc.dueDate)})`);
      for (const el of extraScreenLines(acc)) {
        lines.push(`  ${el}`);
      }
    }
  }

  if (totalCents > 0) {
    lines.push("");
    lines.push(
      accounts.length === 1
        ? `Valor para renovar: ${formatPrice(totalCents)}`
        : `Valor total para renovar tudo: ${formatPrice(totalCents)}`,
    );
  }

  if (pix.pixKey) {
    lines.push("");
    lines.push(`Pague via PIX:`);
    lines.push(`Chave: ${pix.pixKey}`);
    if (pix.pixName) lines.push(`Nome: ${pix.pixName}`);
  }

  lines.push("");
  lines.push("Após o pagamento, envie o comprovante. Obrigado!");

  return lines.join("\n");
}

/** Gera o link wa.me da cobrança agrupada de várias contas do mesmo cliente. */
export function buildBulkWhatsappLink(accounts: Account[], pix: PixInfo): string | null {
  if (accounts.length === 0) return null;
  const phone = normalizePhone(accounts[0].whatsapp);
  if (!phone) return null;
  const text = encodeURIComponent(buildBulkChargeMessage(accounts, pix));
  return `https://wa.me/${phone}?text=${text}`;
}

/** Monta a mensagem de boas-vindas / confirmação de compra com os dados de acesso. */
export function buildWelcomeMessage(acc: Account, pix: PixInfo): string {
  const serviceName = SERVICE_MAP[acc.service]?.name ?? acc.service;
  const hello = acc.client ? `Olá, ${acc.client}!` : "Olá!";

  const lines: string[] = [
    hello,
    "",
    "Obrigado pela sua compra! 🎉",
    "",
    "Seguem os dados de acesso:",
    `Serviço: *${serviceName}*`,
    `Email: ${acc.email}`,
    `Senha: ${acc.password}`,
    ...extraScreenLines(acc),
    `Vencimento: ${formatDate(acc.dueDate)}`,
  ];

  if (acc.priceCents > 0) {
    lines.push(`Valor: ${formatPrice(acc.priceCents)}`);
  }

  if (pix.pixKey) {
    lines.push("");
    lines.push("Chave PIX para pagamento/renovação:");
    lines.push(`Chave: ${pix.pixKey}`);
    if (pix.pixName) lines.push(`Nome: ${pix.pixName}`);
  }

  lines.push("");
  lines.push("Obrigado pela preferência, volte sempre! 💚");

  return lines.join("\n");
}

/**
 * Gera o link wa.me da mensagem de boas-vindas. Aceita o telefone direto
 * (pois a conta recém-criada pode não ter whatsapp populado ainda).
 */
export function buildWelcomeLink(acc: Account, pix: PixInfo, phoneRaw?: string): string | null {
  const phone = normalizePhone(phoneRaw || acc.whatsapp);
  if (!phone) return null;
  const text = encodeURIComponent(buildWelcomeMessage(acc, pix));
  return `https://wa.me/${phone}?text=${text}`;
}
