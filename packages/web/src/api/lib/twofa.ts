import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "../database";
import { twofaCodes, trustedDevices, settings } from "../database/schema";
import { sendTelegramMessage, isTelegramConfigured } from "./telegram";

// Janela de validade do código enviado por Telegram.
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutos
// "Uma vez por dia": o dispositivo fica confiável por 24h após passar no 2FA.
const TRUST_TTL_MS = 24 * 60 * 60 * 1000;
// Tentativas erradas permitidas antes de invalidar o código.
const MAX_ATTEMPTS = 5;

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? "";
}

/** O 2FA por Telegram só é exigido quando o admin liga a chave E o Telegram está configurado. */
export async function is2faEnabled(): Promise<boolean> {
  const enabled = (await getSetting("twofa_enabled")) === "1";
  if (!enabled) return false;
  return isTelegramConfigured();
}

/** Verifica se o token de dispositivo confiável enviado ainda é válido para o usuário. */
export async function isDeviceTrusted(userId: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [row] = await db.select().from(trustedDevices).where(eq(trustedDevices.token, token));
  if (!row) return false;
  if (row.userId !== userId) return false;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(trustedDevices).where(eq(trustedDevices.token, token));
    return false;
  }
  return true;
}

/**
 * Gera um código de 6 dígitos, guarda apenas o hash e envia ao Telegram.
 * Retorna false se o Telegram não estiver configurado ou o envio falhar.
 */
export async function issueCode(userId: string, userEmail: string): Promise<boolean> {
  if (!(await isTelegramConfigured())) return false;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db
    .insert(twofaCodes)
    .values({ userId, codeHash: sha256(code), attempts: MAX_ATTEMPTS, expiresAt })
    .onConflictDoUpdate({
      target: twofaCodes.userId,
      set: { codeHash: sha256(code), attempts: MAX_ATTEMPTS, expiresAt },
    });

  const msg =
    `🔐 <b>Código de acesso ao painel</b>\n\n` +
    `Seu código é: <code>${code}</code>\n` +
    `Conta: ${userEmail}\n\n` +
    `Válido por 5 minutos. Se você não tentou entrar, ignore e troque sua senha.`;

  const sent = await sendTelegramMessage(msg);
  if (!sent) {
    await db.delete(twofaCodes).where(eq(twofaCodes.userId, userId));
    return false;
  }
  return true;
}

export type VerifyResult =
  | { ok: true; trustToken: string; trustExpiresAt: number }
  | { ok: false; reason: "no_code" | "expired" | "too_many" | "wrong"; attemptsLeft?: number };

/**
 * Confere o código. Em caso de sucesso, cria um token de dispositivo confiável (24h).
 */
export async function verifyCode(
  userId: string,
  code: string,
  deviceLabel: string,
): Promise<VerifyResult> {
  const clean = (code || "").replace(/\D/g, "");
  const [row] = await db.select().from(twofaCodes).where(eq(twofaCodes.userId, userId));
  if (!row) return { ok: false, reason: "no_code" };

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(twofaCodes).where(eq(twofaCodes.userId, userId));
    return { ok: false, reason: "expired" };
  }
  if (row.attempts <= 0) {
    await db.delete(twofaCodes).where(eq(twofaCodes.userId, userId));
    return { ok: false, reason: "too_many" };
  }

  if (!safeEqualHex(sha256(clean), row.codeHash)) {
    const left = row.attempts - 1;
    if (left <= 0) {
      await db.delete(twofaCodes).where(eq(twofaCodes.userId, userId));
      return { ok: false, reason: "too_many" };
    }
    await db.update(twofaCodes).set({ attempts: left }).where(eq(twofaCodes.userId, userId));
    return { ok: false, reason: "wrong", attemptsLeft: left };
  }

  // sucesso: consome o código e cria o dispositivo confiável
  await db.delete(twofaCodes).where(eq(twofaCodes.userId, userId));
  const trustToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TRUST_TTL_MS);
  await db.insert(trustedDevices).values({
    token: trustToken,
    userId,
    label: deviceLabel.slice(0, 120),
    expiresAt,
  });

  // limpeza oportunista de tokens expirados
  await db.delete(trustedDevices).where(lt(trustedDevices.expiresAt, new Date()));

  return { ok: true, trustToken, trustExpiresAt: expiresAt.getTime() };
}

/** Revoga um dispositivo confiável específico (logout do 2FA). */
export async function revokeDevice(token: string): Promise<void> {
  await db.delete(trustedDevices).where(eq(trustedDevices.token, token));
}

/** Revoga TODOS os dispositivos confiáveis de um usuário. */
export async function revokeAllDevices(userId: string): Promise<void> {
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));
}
