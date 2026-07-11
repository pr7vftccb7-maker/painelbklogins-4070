import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "motion/react";
import { Loader2, Eye, EyeOff, LogOut, ShoppingBag, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import brandIcon from "../assets/bklogins-icon_1783171873307.png";

const STORAGE_KEY = "customer_token";
const USER_KEY = "customer_user";

function getStoredToken(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
function setStoredToken(t: string) {
  try { localStorage.setItem(STORAGE_KEY, t); } catch { /* */ }
}
function clearStored() {
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(USER_KEY); } catch { /* */ }
}

type CustomerUser = { id: string; name: string; email: string };

type MyAccount = {
  id: string;
  service: string;
  email: string;
  password: string;
  dueDate: string;
  status: string;
  deliveredAt: string | null;
};

const SERVICE_NAMES: Record<string, string> = {
  netflix: "Netflix",
  disney: "Disney+",
  hbomax: "Max",
  prime: "Amazon Prime",
  spotify: "Spotify",
  globoplay: "Globoplay",
  "globoplay-telecine": "Globoplay + Telecine",
  premiere: "Premiere",
  youtube: "YouTube Premium",
  paramount: "Paramount+",
};

function serviceName(slug: string) {
  return SERVICE_NAMES[slug] ?? slug;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

const SERVICE_COLORS: Record<string, string> = {
  netflix: "#e50914",
  disney: "#113ccf",
  hbomax: "#5822b4",
  prime: "#00a8e1",
  spotify: "#1db954",
  globoplay: "#e11d48",
  "globoplay-telecine": "#cf022b",
  premiere: "#690496",
  youtube: "#ff0000",
  paramount: "#0064ff",
};

export default function CustomerPortal() {
  const [location, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [accounts, setAccounts] = useState<MyAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Verifica se já está logado
  useEffect(() => {
    const token = getStoredToken();
    const saved = localStorage.getItem(USER_KEY);
    if (token && saved) {
      try {
        const u = JSON.parse(saved) as CustomerUser;
        setUser(u);
      } catch { clearStored(); }
    }
  }, []);

  // Carrega contas do cliente
  useEffect(() => {
    if (!user) return;
    setLoadingAccounts(true);
    fetch("/api/customers/my-accounts", {
      headers: { Authorization: `Bearer ${getStoredToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAccounts(data);
        else if (data.error) setError(data.error);
      })
      .catch(() => setError("Erro ao carregar suas contas."))
      .finally(() => setLoadingAccounts(false));
  }, [user]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no login.");
      setStoredToken(data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no cadastro.");
      setMode("login");
      setError("");
      alert("Conta criada! Faça login agora.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearStored();
    setUser(null);
    setAccounts([]);
    navigate("/portal");
  }

  // Tela de login/cadastro
  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 bg-[#0a0a0f]">
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
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" ? "Acesse suas contas" : "Crie sua conta gratuita"}
            </p>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="flex flex-col gap-4">
            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="font-medium text-primary hover:underline"
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          <p className="mt-4 text-center">
            <a href="/loja" className="text-sm text-[#00a8e1] hover:underline">
              ← Voltar para a loja
            </a>
          </p>
        </motion.div>
      </div>
    );
  }

  // Dashboard do cliente
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={brandIcon} alt="BK" className="size-9 rounded-lg shadow-[0_0_14px_rgba(225,29,72,0.4)]" />
            <div>
              <div className="font-brand text-sm font-extrabold text-glow-red">BKLOGINS</div>
              <div className="text-xs text-muted-foreground">Portal do Cliente</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <a href="/loja" className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-[#00a8e1] hover:bg-[#00a8e1]/10 transition-colors sm:flex items-center gap-1">
              <ShoppingBag className="size-3.5" />
              Loja
            </a>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="mb-2 font-display text-2xl font-bold">Minhas Contas</h1>
          <p className="text-muted-foreground">
            Contas que você comprou na loja. Os dados de acesso aparecem aqui após a aprovação do pedido.
          </p>
        </motion.div>

        {loadingAccounts ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 flex flex-col items-center rounded-2xl border border-border bg-card p-10 text-center"
          >
            <ShoppingBag className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhuma conta ainda</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Acesse nossa loja, escolha um serviço e faça sua primeira compra! Após a aprovação, os dados aparecerão aqui.
            </p>
            <a href="/loja">
              <Button>
                <ShoppingBag className="size-4" />
                Ir para a Loja
              </Button>
            </a>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            {accounts.map((acc) => {
              const color = SERVICE_COLORS[acc.service] ?? "#666";
              const name = serviceName(acc.service);
              return (
                <div
                  key={acc.id}
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-xl text-white text-sm font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {acc.deliveredAt ? `Entregue em ${fmtDate(acc.deliveredAt)}` : "Aguardando"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg bg-secondary/40 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium text-foreground">{acc.email || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Senha:</span>
                      <span className="font-medium text-foreground">{acc.password || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vencimento:</span>
                      <span className="font-medium text-foreground">{fmtDate(acc.dueDate)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        acc.status === "ativa"
                          ? "bg-[#2fbf71]/15 text-[#2fbf71]"
                          : acc.status === "vencida"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-[#f5a524]/15 text-[#f5a524]"
                      }`}
                    >
                      {acc.status === "ativa" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                      {acc.status === "ativa" ? "Ativa" : acc.status === "vencida" ? "Vencida" : acc.status}
                    </span>

                    {acc.dueDate && new Date(acc.dueDate) < new Date() && acc.status === "ativa" && (
                      <span className="flex items-center gap-1 text-xs text-[#f5a524]">
                        <AlertTriangle className="size-3" />
                        Vence hoje ou já venceu
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        BKLOGINS © {new Date().getFullYear()} — Portal do Cliente
      </footer>
    </div>
  );
}
