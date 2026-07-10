import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { is2faEnabled, isDeviceTrusted } from "../lib/twofa";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  return next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  if (!c.get("user")) return c.json({ message: "Unauthorized" }, 401);
  return next();
});

/**
 * Exige que o segundo fator (2FA por Telegram) já tenha sido validado neste
 * dispositivo. Só bloqueia quando o 2FA está ligado e o Telegram configurado.
 * O front envia o token de dispositivo confiável no header X-Trust-Token.
 */
export const require2fa = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  if (!(await is2faEnabled())) return next();

  const trustToken = c.req.header("X-Trust-Token");
  if (await isDeviceTrusted(user.id, trustToken)) return next();

  return c.json({ message: "2FA required", code: "2fa_required" }, 403);
});
