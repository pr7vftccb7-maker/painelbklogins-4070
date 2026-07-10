import nodemailer from "nodemailer";
import { db } from "../database";
import { settings } from "../database/schema";
import { eq } from "drizzle-orm";

/**
 * Envio de email via SMTP do Gmail (usando senha de app).
 * As credenciais ficam salvas em app_settings:
 *  - smtp_gmail_user   -> email do Gmail que envia
 *  - smtp_gmail_pass   -> senha de app do Google (16 caracteres, sem espaços)
 *  - backup_email_to   -> destino do backup
 */

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? "";
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

/**
 * Envia um email pelo SMTP do Gmail com as credenciais salvas.
 * Retorna { ok, error? }.
 */
export async function sendGmail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const user = (await getSetting("smtp_gmail_user")).trim();
  // A senha de app costuma ser colada com espaços — removemos.
  const pass = (await getSetting("smtp_gmail_pass")).replace(/\s+/g, "");
  if (!user || !pass) {
    return { ok: false, error: "SMTP do Gmail não configurado (email/senha de app)." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `Painel Bklogins <${user}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao enviar email." };
  }
}

/** Envia um email de teste para validar as credenciais SMTP. */
export async function sendTestEmail(): Promise<{ ok: boolean; error?: string }> {
  const to = (await getSetting("backup_email_to")).trim() || (await getSetting("smtp_gmail_user")).trim();
  if (!to) return { ok: false, error: "Defina o email de destino." };
  return sendGmail({
    to,
    subject: "✅ Painel Bklogins — email configurado",
    html: "<p>Seu envio de backup por email está funcionando! Os backups chegarão neste endereço.</p>",
  });
}
