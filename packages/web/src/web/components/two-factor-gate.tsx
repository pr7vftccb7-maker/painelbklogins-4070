import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, Loader2, Send, LogOut } from "lucide-react";
import { api } from "../lib/api";
import { setTrustToken } from "../lib/auth";
import { authClient } from "../lib/auth";
import { Button } from "./ui/button";
import brandIcon from "../assets/bklogins-icon_1783171873307.png";

/**
 * Portão de verificação em duas etapas.
 * Renderiza os filhos apenas depois que o dispositivo é confiável (24h).
 * Enquanto precisa verificar, mostra a tela de código do Telegram.
 */
export function TwoFactorGate({
  children,
  onVerified,
}: {
  children: React.ReactNode;
  onVerified?: () => void;
}) {
  const [checking, setChecking] = useState(true);
  const [needs, setNeeds] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const sentOnce = useRef(false);

  const sendCode = useCallback(async (silent = false) => {
    setError("");
    setInfo("");
    setSending(true);
    try {
      const res = await api.twofa.send.$post();
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Não foi possível enviar o código.");
      } else if (!silent) {
        setInfo("Novo código enviado ao seu Telegram.");
      } else {
        setInfo("Enviamos um código ao seu Telegram.");
      }
    } catch {
      setError("Falha de conexão ao enviar o código.");
    } finally {
      setSending(false);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.twofa.status.$get();
      if (!res.ok) {
        // sem 2FA acessível (ex.: sessão inválida) — deixa passar, o Layout trata a sessão
        setNeeds(false);
        return;
      }
      const data = await res.json();
      setNeeds(Boolean(data.needsVerification));
      if (!data.needsVerification) onVerified?.();
      if (data.needsVerification && !sentOnce.current) {
        sentOnce.current = true;
        void sendCode(true);
      }
    } catch {
      setNeeds(false);
    } finally {
      setChecking(false);
    }
  }, [onVerified, sendCode]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setVerifying(true);
    try {
      const res = await api.twofa.verify.$post({ json: { code } });
      const body = (await res.json().catch(() => ({}))) as {
        trustToken?: string;
        message?: string;
        attemptsLeft?: number;
      };
      if (!res.ok || !body.trustToken) {
        let msg = body.message ?? "Código incorreto.";
        if (typeof body.attemptsLeft === "number") {
          msg += ` (${body.attemptsLeft} tentativa${body.attemptsLeft === 1 ? "" : "s"} restante${body.attemptsLeft === 1 ? "" : "s"})`;
        }
        setError(msg);
        return;
      }
      setTrustToken(body.trustToken);
      setNeeds(false);
      onVerified?.();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/sign-in";
  }

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!needs) return <>{children}</>;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#00a8e1]/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={brandIcon}
            alt="Bklogins"
            className="mb-4 size-16 rounded-2xl shadow-[0_0_35px_rgba(225,29,72,0.45)]"
          />
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <h1 className="font-display text-xl font-bold">Verificação em duas etapas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enviamos um código de 6 dígitos ao seu Telegram. Digite-o para continuar.
          </p>
        </div>

        <form onSubmit={verify} className="flex flex-col gap-4">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código de verificação"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            ref={(el) => el?.focus()}
            className="w-full rounded-xl border border-border bg-secondary/40 py-4 text-center font-display text-3xl font-bold tracking-[0.5em] text-foreground outline-none ring-primary/40 focus:ring-2"
          />

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="rounded-lg border border-[#2fbf71]/30 bg-[#2fbf71]/10 px-3 py-2 text-sm text-[#2fbf71]">
              {info}
            </div>
          )}

          <Button type="submit" size="lg" disabled={verifying || code.length < 6}>
            {verifying && <Loader2 className="size-4 animate-spin" />}
            Verificar e entrar
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <button
            onClick={() => sendCode(false)}
            disabled={sending}
            className="flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Reenviar código
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </div>
      </motion.div>
    </div>
  );
}
