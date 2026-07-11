import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  X,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Copy,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// Detecta se o cliente está logado no portal
function getStoredCustomer() {
  try {
    const token = localStorage.getItem("customer_token");
    const user = localStorage.getItem("customer_user");
    if (token && user) {
      return JSON.parse(user) as { name: string; email: string; id: string };
    }
  } catch { /* */ }
  return null;
}

type Product = {
  id: string;
  service: string;
  serviceName: string;
  serviceColor: string;
  serviceLogo: string;
  serviceShort: string;
  priceCents: number;
  priceFormatted: string;
};

type CatalogRes = { catalog: Product[] };
type ProductRes = { product: Product };
type OrderRes = {
  order: {
    id: string;
    status: string;
    priceCents: number;
    priceFormatted: string;
    service: string;
    createdAt: string;
  };
  paymentUrl?: string | null;
};

const SRV: Record<string, { label: string; logo?: string }> = {
  netflix: { label: "Netflix", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nixos/nixos-original.svg" },
  disney: { label: "Disney+" },
  hbomax: { label: "Max" },
  prime: { label: "Prime Video" },
  spotify: { label: "Spotify" },
  globoplay: { label: "Globoplay" },
  "globoplay-telecine": { label: "Globoplay + Telecine" },
  premiere: { label: "Premiere" },
  youtube: { label: "YouTube" },
  paramount: { label: "Paramount+" },
};

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

function serviceLabel(slug: string) {
  return SRV[slug]?.label ?? slug;
}

function fmtPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function ShopPage() {
  // Rotas: /loja (catálogo), /loja/checkout/:id (checkout), /loja/sucesso/:id (pós-compra)
  const [, matchCheckout, checkoutId] = useRoute("/loja/checkout/:id") ?? [false, null, null];
  const [, matchSuccess, successId] = useRoute("/loja/sucesso/:id") ?? [false, null, null];

  if (matchCheckout && checkoutId) return <Checkout productId={checkoutId} />;
  if (matchSuccess && successId) return <Success orderId={successId} />;
  return <Catalog />;
}

function Catalog() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const customer = getStoredCustomer();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("service", filter);

    fetch(`/api/shop/catalog?${params.toString()}`)
      .then((r) => r.json())
      .then((d: CatalogRes) => setCatalog(d.catalog ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const services = [...new Set(catalog.map((p) => p.service))];

  const displayed = search
    ? catalog.filter(
        (p) =>
          p.serviceName.toLowerCase().includes(search.toLowerCase()) ||
          p.serviceShort?.toLowerCase().includes(search.toLowerCase()),
      )
    : catalog;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Store className="size-5" />
            </div>
            <div>
              <div className="font-brand text-base font-extrabold text-glow-red">BKLOGINS</div>
              <div className="text-xs text-muted-foreground">Loja de Contas</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {customer ? (
              <Link
                href="/portal"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[#00a8e1] hover:bg-[#00a8e1]/10 transition-colors"
              >
                <User className="size-4" />
                Minhas Contas
              </Link>
            ) : (
              <Link
                href="/portal"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Contas Premium
          </h1>
          <p className="mt-2 text-muted-foreground">
            Escolha seu serviço e garanta já sua conta — entrega rápida após confirmação.
          </p>
        </motion.div>

        {/* Busca + Filtros */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar serviço..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                !filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            {["netflix", "prime", "disney", "hbomax", "spotify", "globoplay", "premiere", "youtube", "paramount"].map(
              (s) => {
                const count = catalog.filter((p) => p.service === s).length;
                if (count === 0 && filter !== s) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(filter === s ? "" : s)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      filter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {SRV[s]?.label ?? s} ({count})
                  </button>
                );
              },
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center rounded-2xl border border-border bg-card p-12 text-center"
          >
            <ShoppingBag className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhum produto disponível</h3>
            <p className="text-sm text-muted-foreground">
              Novas contas são adicionadas em breve. Volte mais tarde!
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {displayed.map((product, i) => {
                const color = SERVICE_COLORS[product.service] ?? product.serviceColor ?? "#e11d48";
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className="flex size-12 items-center justify-center rounded-xl text-white text-lg font-bold shadow-lg"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 4px 20px ${color}40`,
                        }}
                      >
                        {product.serviceLogo ? (
                          <img src={product.serviceLogo} alt="" className="size-6 object-contain" />
                        ) : (
                          serviceLabel(product.service).slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {product.serviceName || serviceLabel(product.service)}
                        </h3>
                        {product.serviceShort && (
                          <p className="text-xs text-muted-foreground">{product.serviceShort}</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">
                        {product.priceFormatted}
                      </span>
                    </div>

                    <Link href={`/loja/checkout/${product.id}`}>
                      <Button className="w-full" style={{ backgroundColor: color, borderColor: color }}>
                        <ShoppingCart className="size-4" />
                        Comprar
                      </Button>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        BKLOGINS © {new Date().getFullYear()} — Loja de Contas
      </footer>
    </div>
  );
}

function Checkout({ productId }: { productId: string }) {
  const [, navigate] = useLocation();
  const customer = getStoredCustomer();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    fetch(`/api/shop/product/${productId}`)
      .then((r) => r.json())
      .then((d: ProductRes) => {
        setProduct(d.product);
      })
      .catch(() => setError("Erro ao carregar produto."))
      .finally(() => setLoading(false));
  }, [productId]);

  async function doCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerName: name,
          customerEmail: email,
          customerWhatsapp: whatsapp,
        }),
      });

      const data = (await res.json()) as { order?: { id: string }; message?: string; paymentUrl?: string | null };
      if (!res.ok) throw new Error(data.message ?? "Falha no checkout.");

      const orderId = data.order?.id;
      if (orderId) {
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          navigate(`/loja/sucesso/${orderId}`);
        }
      } else {
        throw new Error("Pedido não criado.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Produto não encontrado."}</p>
          <Link href="/loja">
            <Button variant="outline">
              <ArrowLeft className="size-4" /> Voltar para loja
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const color = SERVICE_COLORS[product.service] ?? product.serviceColor ?? "#e11d48";

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link href="/loja" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="font-brand text-base font-extrabold text-glow-red">BKLOGINS</div>
            <div className="text-xs text-muted-foreground">Checkout</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          {/* Resumo do produto */}
          <div className="mb-6 flex items-center gap-4 rounded-xl bg-secondary/40 p-4">
            <div
              className="flex size-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: color }}
            >
              {product.serviceLogo ? (
                <img src={product.serviceLogo} alt="" className="size-6 object-contain" />
              ) : (
                serviceLabel(product.service).slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {product.serviceName || serviceLabel(product.service)}
              </h3>
              <p className="text-2xl font-bold text-foreground">{product.priceFormatted}</p>
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={doCheckout} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>WhatsApp (opcional)</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="mt-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Finalizar Pedido
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-[#2fbf71]" />
            Após a confirmação, os dados de acesso aparecerão no seu portal.
          </div>

          {!customer && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/portal" className="text-primary hover:underline font-medium">
                Faça login no portal
              </Link>{" "}
              para acompanhar seus pedidos.
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function Success({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/shop/order/${orderId}`)
      .then((r) => r.json())
      .then((d: OrderRes) => {
        setStatus(d.order.status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      fetch(`/api/shop/order/${orderId}`)
        .then((r) => r.json())
        .then((d: OrderRes) => {
          if (d.order.status !== status) setStatus(d.order.status);
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(t);
  }, [orderId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center"
      >
        <div className="mb-4 flex justify-center">
          {status === "approved" ? (
            <div className="flex size-16 items-center justify-center rounded-full bg-[#2fbf71]/15">
              <CheckCircle2 className="size-8 text-[#2fbf71]" />
            </div>
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-[#f5a524]/15">
              <Loader2 className="size-8 animate-spin text-[#f5a524]" />
            </div>
          )}
        </div>

        <h2 className="font-display text-xl font-bold mb-2">
          {status === "approved" ? "Pedido aprovado!" : "Pedido recebido!"}
        </h2>
        <p className="text-muted-foreground mb-2">
          {status === "approved"
            ? "Seus dados de acesso já estão disponíveis."
            : "Seu pedido está em análise. Você receberá os dados em breve."}
        }

        <div className="mb-6 rounded-lg bg-secondary/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">ID do pedido:</p>
          <p className="font-mono text-sm text-foreground">{orderId}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/portal">
            <Button className="w-full">
              <User className="size-4" />
              Acessar Minhas Contas
            </Button>
          </Link>
          <Link href="/loja">
            <Button variant="outline" className="w-full">
              <Store className="size-4" />
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
