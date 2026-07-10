import { db } from "../database";
import { settings } from "../database/schema";
import { eq } from "drizzle-orm";

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? "";
}

/**
 * Envia mensagem via bot do Telegram usando as credenciais salvas em settings.
 * Retorna true se enviou com sucesso.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = await getSetting("telegram_bot_token");
  const chatId = await getSetting("telegram_chat_id");
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Indica se as credenciais do Telegram estão configuradas. */
export async function isTelegramConfigured(): Promise<boolean> {
  const token = await getSetting("telegram_bot_token");
  const chatId = await getSetting("telegram_chat_id");
  return Boolean(token && chatId);
}
