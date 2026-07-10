import { gzipSync, gunzipSync } from "zlib";
import { client, db } from "../database";
import { settings } from "../database/schema";
import { eq } from "drizzle-orm";
import { sendGmail } from "./email";

/**
 * Backup/restore do banco (Turso/libsql remoto).
 * Estratégia: como o banco é remoto (não é um arquivo .db local), o backup é
 * um dump JSON de todas as tabelas, comprimido com gzip e enviado como
 * documento para o bot do Telegram configurado nas configurações.
 * O restore lê o mesmo formato e reinsere linha a linha dentro de uma transação.
 */

// Ordem importa no restore por causa de foreign keys (pais antes de filhos).
// Limpamos e reinserimos na ordem: primeiro tabelas referenciadas, depois as que referenciam.
const BACKUP_TABLES = [
  "app_settings",
  "services",
  "clients",
  "subscription_accounts",
  "stock_accounts",
  "wallet_transactions",
  "user",
  "session",
  "account",
  "verification",
] as const;

// Ordem de limpeza no restore: inverso das dependências (filhos antes de pais).
const TRUNCATE_ORDER = [
  "verification",
  "account",
  "session",
  "wallet_transactions",
  "stock_accounts",
  "subscription_accounts",
  "clients",
  "services",
  "app_settings",
  "user",
] as const;

export type BackupDump = {
  version: 1;
  createdAt: string;
  tables: Record<string, { columns: string[]; rows: unknown[][] }>;
};

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? "";
}

async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Gera o dump completo de todas as tabelas como objeto. */
export async function createDump(): Promise<BackupDump> {
  const tables: BackupDump["tables"] = {};
  for (const table of BACKUP_TABLES) {
    const res = await client.execute(`SELECT * FROM ${table}`);
    const columns = res.columns ?? [];
    // Rows do libsql são array-like/objeto — extraímos os valores por índice de coluna.
    const rows = res.rows.map((r) =>
      columns.map((_, i) => (r as Record<number, unknown>)[i] as unknown),
    );
    tables[table] = { columns, rows };
  }
  return { version: 1, createdAt: new Date().toISOString(), tables };
}

/** Serializa e comprime o dump em um buffer .json.gz. */
export function serializeDump(dump: BackupDump): Buffer {
  const json = JSON.stringify(dump);
  return gzipSync(Buffer.from(json, "utf-8"));
}

/** Descomprime e faz o parse de um buffer de backup. */
export function parseDump(buffer: Buffer): BackupDump {
  let jsonBuf: Buffer = buffer;
  // Detecta gzip (magic bytes 1f 8b). Se não for, tenta como JSON puro.
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    jsonBuf = gunzipSync(buffer);
  }
  let parsed: BackupDump;
  try {
    parsed = JSON.parse(jsonBuf.toString("utf-8")) as BackupDump;
  } catch {
    throw new Error("Arquivo de backup inválido — não é um backup do painel.");
  }
  if (!parsed || parsed.version !== 1 || !parsed.tables) {
    throw new Error("Arquivo de backup inválido ou incompatível.");
  }
  return parsed;
}

/** Conta o total de linhas de um dump (para mensagens). */
export function countRows(dump: BackupDump): number {
  return Object.values(dump.tables).reduce((sum, t) => sum + t.rows.length, 0);
}

/**
 * Restaura o banco a partir de um dump: limpa as tabelas e reinsere tudo.
 * Roda dentro de uma transação — se qualquer passo falhar, faz rollback.
 */
export async function restoreDump(dump: BackupDump): Promise<{ inserted: number }> {
  // Metadados de backup são estado do servidor, não dados de negócio.
  // Preservamos para não perder a referência ao último backup no Telegram.
  const SYSTEM_KEYS = ["last_backup_file_id", "last_backup_at", "last_backup_name"];
  // Nota: credenciais (Telegram/SMTP/PIX) vêm dentro do próprio dump em app_settings,
  // então são restauradas normalmente. Só os metadados do último backup são estado local.
  const preserved: Record<string, string> = {};
  for (const key of SYSTEM_KEYS) {
    preserved[key] = await getSetting(key);
  }

  const tx = await client.transaction("write");
  let inserted = 0;
  try {
    await tx.execute("PRAGMA foreign_keys = OFF");

    // Limpa na ordem segura (filhos antes de pais).
    for (const table of TRUNCATE_ORDER) {
      await tx.execute(`DELETE FROM ${table}`);
    }

    // Reinsere na ordem de dependência (pais antes de filhos).
    for (const table of BACKUP_TABLES) {
      const data = dump.tables[table];
      if (!data || data.rows.length === 0) continue;
      const cols = data.columns;
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      const sqlStmt = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;
      for (const row of data.rows) {
        await tx.execute({ sql: sqlStmt, args: row as never[] });
        inserted++;
      }
    }

    // Restaura os metadados de backup preservados (sobrescreve o que veio do dump).
    for (const key of SYSTEM_KEYS) {
      const value = preserved[key];
      if (value) {
        await tx.execute({
          sql: `INSERT INTO app_settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [key, value],
        });
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
  return { inserted };
}

/**
 * Envia um buffer de backup como documento para o Telegram configurado.
 * Salva o file_id retornado em settings para permitir restore automático depois.
 * Retorna { ok, error? }.
 */
export async function sendBackupToTelegram(
  buffer: Buffer,
  filename: string,
  caption: string,
): Promise<{ ok: boolean; error?: string; fileId?: string }> {
  const token = await getSetting("telegram_bot_token");
  const chatId = await getSetting("telegram_chat_id");
  if (!token || !chatId) {
    return { ok: false, error: "Telegram não configurado (token/chat ID)." };
  }

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([new Uint8Array(buffer)], { type: "application/gzip" }), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { document?: { file_id?: string } };
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    const fileId = data.result?.document?.file_id;
    if (fileId) {
      await setSetting("last_backup_file_id", fileId);
      await setSetting("last_backup_at", new Date().toISOString());
      await setSetting("last_backup_name", filename);
    }
    return { ok: true, fileId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao enviar." };
  }
}

/** Baixa o último backup enviado ao Telegram (via file_id salvo) e retorna o buffer. */
export async function downloadLastBackupFromTelegram(): Promise<{
  ok: boolean;
  buffer?: Buffer;
  error?: string;
}> {
  const token = await getSetting("telegram_bot_token");
  const fileId = await getSetting("last_backup_file_id");
  if (!token) return { ok: false, error: "Telegram não configurado." };
  if (!fileId) return { ok: false, error: "Nenhum backup encontrado no Telegram ainda." };

  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const info = (await infoRes.json()) as {
      ok: boolean;
      description?: string;
      result?: { file_path?: string };
    };
    if (!info.ok || !info.result?.file_path) {
      return { ok: false, error: info.description ?? "Não foi possível localizar o arquivo." };
    }
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${info.result.file_path}`,
    );
    if (!fileRes.ok) return { ok: false, error: `HTTP ${fileRes.status} ao baixar.` };
    const arrBuf = await fileRes.arrayBuffer();
    return { ok: true, buffer: Buffer.from(arrBuf) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao baixar." };
  }
}

/**
 * Executa o fluxo completo de backup: dump -> gzip -> envia ao Telegram e/ou email.
 * Envia por todos os canais configurados. Considera sucesso se pelo menos um canal
 * enviou (ou se nenhum canal está configurado, reporta erro).
 */
export async function runBackup(trigger: "auto" | "manual"): Promise<{
  ok: boolean;
  error?: string;
  rows?: number;
  bytes?: number;
  telegram?: { ok: boolean; error?: string; skipped?: boolean };
  email?: { ok: boolean; error?: string; skipped?: boolean };
}> {
  const dump = await createDump();
  const buffer = serializeDump(dump);
  const rows = countRows(dump);
  const stamp = dump.createdAt.slice(0, 19).replace(/[:T]/g, "-");
  const filename = `backup-painel-${stamp}.json.gz`;
  const whenBR = new Date(dump.createdAt).toLocaleString("pt-BR");
  const sizeKB = (buffer.length / 1024).toFixed(1);
  const triggerLabel = trigger === "auto" ? "automático" : "manual";

  // --- Telegram ---
  const tgToken = await getSetting("telegram_bot_token");
  const tgChat = await getSetting("telegram_chat_id");
  const tgConfigured = Boolean(tgToken && tgChat);
  let telegram: { ok: boolean; error?: string; skipped?: boolean } = { ok: false, skipped: true };
  if (tgConfigured) {
    const caption =
      `🗄️ <b>Backup do Painel</b> (${triggerLabel})\n` +
      `📅 ${whenBR}\n📊 ${rows} registros • ${sizeKB} KB`;
    const sent = await sendBackupToTelegram(buffer, filename, caption);
    telegram = { ok: sent.ok, error: sent.error };
  }

  // --- Email (SMTP Gmail) ---
  const smtpUser = await getSetting("smtp_gmail_user");
  const smtpPass = await getSetting("smtp_gmail_pass");
  const emailTo = (await getSetting("backup_email_to")).trim() || smtpUser.trim();
  const emailConfigured = Boolean(smtpUser && smtpPass && emailTo);
  let email: { ok: boolean; error?: string; skipped?: boolean } = { ok: false, skipped: true };
  if (emailConfigured) {
    const sent = await sendGmail({
      to: emailTo,
      subject: `🗄️ Backup do Painel (${triggerLabel}) — ${whenBR}`,
      html:
        `<h2>Backup do Painel Bklogins</h2>` +
        `<p><b>Tipo:</b> ${triggerLabel}<br/>` +
        `<b>Data:</b> ${whenBR}<br/>` +
        `<b>Registros:</b> ${rows}<br/>` +
        `<b>Tamanho:</b> ${sizeKB} KB</p>` +
        `<p>O backup completo está anexado como <code>${filename}</code>. ` +
        `Guarde este arquivo — ele pode ser restaurado na tela de Configurações.</p>`,
      attachments: [{ filename, content: buffer, contentType: "application/gzip" }],
    });
    email = { ok: sent.ok, error: sent.error };
  }

  if (!tgConfigured && !emailConfigured) {
    return {
      ok: false,
      error: "Nenhum canal configurado. Configure o Telegram ou o email nas Configurações.",
      rows,
      bytes: buffer.length,
      telegram,
      email,
    };
  }

  const anyOk = telegram.ok || email.ok;
  const errors: string[] = [];
  if (tgConfigured && !telegram.ok) errors.push(`Telegram: ${telegram.error ?? "falhou"}`);
  if (emailConfigured && !email.ok) errors.push(`Email: ${email.error ?? "falhou"}`);

  return {
    ok: anyOk,
    error: errors.length ? errors.join(" • ") : undefined,
    rows,
    bytes: buffer.length,
    telegram,
    email,
  };
}
