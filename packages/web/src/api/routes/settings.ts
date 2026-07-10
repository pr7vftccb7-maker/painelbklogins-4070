import { Hono } from "hono";
import { db } from "../database";
import { settings, accounts } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { sendTelegramMessage } from "../lib/telegram";
import { sendTestEmail } from "../lib/email";
import { isDue, todayISO } from "../lib/dates";
import { SERVICE_MAP } from "../../shared/services";

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

export const settingsRoute = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const token = await getSetting("telegram_bot_token");
    const chatId = await getSetting("telegram_chat_id");
    const pixKey = await getSetting("pix_key");
    const pixName = await getSetting("pix_name");
    const smtpUser = await getSetting("smtp_gmail_user");
    const smtpPass = await getSetting("smtp_gmail_pass");
    const backupEmailTo = await getSetting("backup_email_to");
    const twofaEnabled = (await getSetting("twofa_enabled")) === "1";
    return c.json(
      {
        telegramBotToken: token,
        telegramChatId: chatId,
        telegramConfigured: Boolean(token && chatId),
        pixKey,
        pixName,
        smtpGmailUser: smtpUser,
        smtpGmailPass: smtpPass,
        backupEmailTo,
        emailConfigured: Boolean(smtpUser && smtpPass && (backupEmailTo || smtpUser)),
        twofaEnabled,
      },
      200,
    );
  })
  // Liga/desliga o 2FA por Telegram. Só pode ligar com o Telegram configurado.
  .put("/twofa", async (c) => {
    const body = await c.req.json<{ enabled?: boolean }>();
    const enabled = Boolean(body.enabled);
    if (enabled) {
      const token = await getSetting("telegram_bot_token");
      const chatId = await getSetting("telegram_chat_id");
      if (!token || !chatId) {
        return c.json(
          { message: "Configure o Telegram antes de ativar a verificação em duas etapas." },
          400,
        );
      }
    }
    await setSetting("twofa_enabled", enabled ? "1" : "0");
    return c.json({ ok: true, enabled }, 200);
  })
  .put("/telegram", async (c) => {
    const body = await c.req.json();
    await setSetting("telegram_bot_token", body.telegramBotToken ?? "");
    await setSetting("telegram_chat_id", body.telegramChatId ?? "");
    return c.json({ ok: true }, 200);
  })
  .put("/payment", async (c) => {
    const body = await c.req.json();
    await setSetting("pix_key", body.pixKey ?? "");
    await setSetting("pix_name", body.pixName ?? "");
    return c.json({ ok: true }, 200);
  })
  // Salva credenciais SMTP do Gmail e destino do backup por email.
  .put("/email", async (c) => {
    const body = await c.req.json();
    await setSetting("smtp_gmail_user", (body.smtpGmailUser ?? "").trim());
    await setSetting("smtp_gmail_pass", body.smtpGmailPass ?? "");
    await setSetting("backup_email_to", (body.backupEmailTo ?? "").trim());
    return c.json({ ok: true }, 200);
  })
  // Envia um email de teste para validar as credenciais.
  .post("/email/test", async (c) => {
    const result = await sendTestEmail();
    return c.json(result, result.ok ? 200 : 400);
  })
  // Envia mensagem de teste
  .post("/telegram/test", async (c) => {
    const ok = await sendTelegramMessage(
      "✅ <b>Painel de Assinaturas</b>\nNotificações do Telegram configuradas com sucesso!",
    );
    return c.json({ ok }, ok ? 200 : 400);
  })
  // Verifica vencimentos e notifica no Telegram (chamado pelo frontend ao carregar)
  .post("/check-due", async (c) => {
    const rows = await db.select().from(accounts);
    const today = todayISO();
    const dueToNotify = rows.filter(
      (r) => r.status !== "cancelada" && isDue(r.dueDate) && r.notifiedDueAt !== today,
    );

    let notified = 0;
    if (dueToNotify.length > 0) {
      const lines = dueToNotify.map((r) => {
        const svc = SERVICE_MAP[r.service]?.name ?? r.service;
        return `• <b>${svc}</b> — ${r.client || r.email} (venc. ${r.dueDate})`;
      });
      const msg = `⚠️ <b>Contas vencidas / vencendo hoje</b>\n\n${lines.join("\n")}`;
      const sent = await sendTelegramMessage(msg);
      if (sent) {
        for (const r of dueToNotify) {
          await db.update(accounts).set({ notifiedDueAt: today }).where(eq(accounts.id, r.id));
        }
        notified = dueToNotify.length;
      }
    }
    return c.json({ due: dueToNotify.length, notified }, 200);
  });
