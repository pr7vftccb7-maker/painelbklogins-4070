import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "motion/react";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";
import brandIcon from "../assets/bklogins-icon_1783171873307.png";

export default function SignIn() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({ email, password, name: name || email });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* fundo com brilho */}
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
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={brandIcon}
            alt="Bklogins"
            className="mb-4 size-20 rounded-2xl shadow-[0_0_35px_rgba(225,29,72,0.45)]"
          />
          <h1 className="font-brand text-3xl font-extrabold text-glow-red">BKLOGINS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Entre para gerenciar suas contas" : "Crie o acesso do administrador"}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exemplo.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" disabled={loading} className="mt-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Criar acesso"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Primeiro acesso? " : "Já tem acesso? "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
