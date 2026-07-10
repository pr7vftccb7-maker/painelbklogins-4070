import { Hono } from "hono";
import { db } from "../database";
import { settings } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import {
  runBackup,
  parseDump,
  restoreDump,
  countRows,
  downloadLastBackupFromTelegram,
} from "../lib/backup";

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? "";
}

export const backupRoute = new Hono()
  .use("*", requireAuth)
  // Status do backup: quando foi o último e se o Telegram está configurado.
  .get("/", async (c) => {
    const token = await getSetting("telegram_bot_token");
    const chatId = await getSetting("telegram_chat_id");
    const smtpUser = await getSetting("smtp_gmail_user");
    const smtpPass = await getSetting("smtp_gmail_pass");
    const emailTo = (await getSetting("backup_email_to")) || smtpUser;
    const lastAt = await getSetting("last_backup_at");
    const lastName = await getSetting("last_backup_name");
    const hasRemote = Boolean(await getSetting("last_backup_file_id"));
    return c.json(
      {
        telegramConfigured: Boolean(token && chatId),
        emailConfigured: Boolean(smtpUser && smtpPass && emailTo),
        backupEmailTo: emailTo || null,
        lastBackupAt: lastAt || null,
        lastBackupName: lastName || null,
        hasRemoteBackup: hasRemote,
      },
      200,
    );
  })
  // Dispara um backup manual agora (envia ao Telegram).
  .post("/run", async (c) => {
    const result = await runBackup("manual");
    if (!result.ok) {
      return c.json({ ok: false, error: result.error, telegram: result.telegram, email: result.email }, 400);
    }
    return c.json(
      {
        ok: true,
        rows: result.rows,
        bytes: result.bytes,
        telegram: result.telegram,
        email: result.email,
        error: result.error, // pode haver erro parcial (um canal falhou)
      },
      200,
    );
  })
  // Baixa o dump atual do navegador (sem passar pelo Telegram).
  .get("/download", async (c) => {
    const { createDump, serializeDump } = await import("../lib/backup");
    const dump = await createDump();
    const buffer = serializeDump(dump);
    const stamp = dump.createdAt.slice(0, 19).replace(/[:T]/g, "-");
    c.header("Content-Type", "application/gzip");
    c.header("Content-Disposition", `attachment; filename="backup-painel-${stamp}.json.gz"`);
    return c.body(new Uint8Array(buffer), 200);
  })
  // Restaura a partir de um arquivo enviado (upload manual).
  .post("/restore/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ ok: false, error: "Nenhum arquivo enviado." }, 400);
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const dump = parseDump(buffer);
      const total = countRows(dump);
      const result = await restoreDump(dump);
      return c.json({ ok: true, inserted: result.inserted, total }, 200);
    } catch (err) {
      return c.json(
        { ok: false, error: err instanceof Error ? err.message : "Falha ao restaurar." },
        400,
      );
    }
  })
  // Restaura puxando o último backup do Telegram automaticamente.
  .post("/restore/telegram", async (c) => {
    const dl = await downloadLastBackupFromTelegram();
    if (!dl.ok || !dl.buffer) {
      return c.json({ ok: false, error: dl.error ?? "Falha ao baixar backup." }, 400);
    }
    try {
      const dump = parseDump(dl.buffer);
      const total = countRows(dump);
      const result = await restoreDump(dump);
      return c.json({ ok: true, inserted: result.inserted, total }, 200);
    } catch (err) {
      return c.json(
        { ok: false, error: err instanceof Error ? err.message : "Falha ao restaurar." },
        400,
      );
    }
  });
