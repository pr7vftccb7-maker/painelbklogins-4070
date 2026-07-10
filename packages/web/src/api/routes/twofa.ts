import { Hono } from "hono";
import { auth } from "../auth";
import { requireAuth } from "../middleware/auth";
import {
  is2faEnabled,
  isDeviceTrusted,
  issueCode,
  verifyCode,
  revokeDevice,
} from "../lib/twofa";
import { isTelegramConfigured } from "../lib/telegram";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const twofaRoute = new Hono<{ Variables: Variables }>()
  .use("*", requireAuth)

  // Estado do 2FA para o dispositivo atual: precisa pedir código?
  .get("/status", async (c) => {
    const user = c.get("user")!;
    const enabled = await is2faEnabled();
    const trustToken = c.req.header("X-Trust-Token");
    const trusted = enabled ? await isDeviceTrusted(user.id, trustToken) : true;
    return c.json({
      enabled,
      telegramConfigured: await isTelegramConfigured(),
      // se o 2FA está ligado e o dispositivo NÃO é confiável, precisa verificar
      needsVerification: enabled && !trusted,
    });
  })

  // Envia (ou reenvia) o código de 6 dígitos ao Telegram.
  .post("/send", async (c) => {
    const user = c.get("user")!;
    if (!(await is2faEnabled())) return c.json({ message: "2FA desativado" }, 400);
    const sent = await issueCode(user.id, user.email);
    if (!sent) {
      return c.json(
        { message: "Não foi possível enviar o código. Verifique o Telegram nas configurações." },
        502,
      );
    }
    return c.json({ ok: true });
  })

  // Confere o código e devolve o token de dispositivo confiável (24h).
  .post("/verify", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json<{ code?: string }>().catch(() => ({}) as { code?: string });
    const code = (body.code ?? "").trim();
    if (!code) return c.json({ message: "Informe o código." }, 400);

    const ua = c.req.header("user-agent") ?? "";
    const label = ua.slice(0, 120);
    const result = await verifyCode(user.id, code, label);

    if (!result.ok) {
      const messages: Record<string, string> = {
        no_code: "Nenhum código ativo. Solicite um novo código.",
        expired: "Código expirado. Solicite um novo código.",
        too_many: "Muitas tentativas erradas. Solicite um novo código.",
        wrong: "Código incorreto.",
      };
      return c.json(
        {
          message: messages[result.reason],
          reason: result.reason,
          attemptsLeft: result.attemptsLeft,
        },
        401,
      );
    }

    return c.json({
      ok: true,
      trustToken: result.trustToken,
      trustExpiresAt: result.trustExpiresAt,
    });
  })

  // Esquece este dispositivo (vai pedir 2FA no próximo acesso).
  .post("/forget", async (c) => {
    const trustToken = c.req.header("X-Trust-Token");
    if (trustToken) await revokeDevice(trustToken);
    return c.json({ ok: true });
  });
