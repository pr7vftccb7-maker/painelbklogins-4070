import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ShoppingBag, Loader2, CreditCard, CheckCircle2, Copy, ExternalLink, Search, X } from "lucide-react";
import { useLocation, useRoute, Link } from "wouter";
import { useCatalog, useCheckout, useOrder, type CatalogProduct } from "../lib/shop";
import { useServices, useServiceMap } from "../lib/services";
import { SERVICE_MAP } from "../../shared/services";
import { logoUrl } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";

function ServiceLogo({ slug, size = "size-10" }: { slug: string; size?: string }) {
  const dynamicMap = useServiceMap();
  const svc = dynamicMap[slug] ?? SERVICE_MAP[slug];
  if (!svc) return null;
  return (
    <div className={`flex ${size} items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5`}>
      {svc.logo ? (
        <img src={logoUrl(svc.logo)} alt={svc.name} className="size-full object-contain p-1.5" loading="lazy" />
      ) : (
        <span
          className="flex size-full items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: svc.color }}
        >
          {svc.short || svc.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function ShopPage() {
  const [location, navigate] = useLocation();
  const [matchCheckout, paramsCheckout] = useRoute("/loja/checkout/:id");
  const [matchSuccess, paramsSuccess] = useRoute("/loja/sucesso/:id");

  if (matchCheckout && paramsCheckout?.id) {
    return <CheckoutPage productId={paramsCheckout.id} />;
  }
  if (matchSuccess && paramsSuccess?.id) {
    return <SuccessPage orderId={paramsSuccess.id} />;
  }
  return <CatalogPage />;
}

function CatalogPage() {
  const [selectedService, setSelectedService] = useState<string>("");
  const [search, setSearch] = useState("");
  const { data: catalog, isPending } = useCatalog(selectedService || undefined);
  const { data: dynServices } = useServices();
  const svcMap = useServiceMap();
  const nameOf = (slug: string) => svcMap[slug]?.name ?? SERVICE_MAP[slug]?.name ?? slug;

  const filtered = (catalog ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const haystack = `${nameOf(p.service)} ${p.serviceName}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <h1 className="font-brand text-lg font-extrabold">BKLOGINS</h1>
              <p className="text-xs text-muted-foreground">Assinaturas</p>
            </div>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Área do Cliente
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="mb-2 font-display text-3xl font-bold">Escolha sua assinatura</h2>
          <p className="mb-8 text-muted-foreground">
            Contas premium com garantia. Pagamento rápido e entrega automática.
          </p>
        </motion.div>

        {/* Barra de busca */}
        <div className="mb-6 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por serviço..."
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filtro por serviço */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedService("")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedService === ""
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {(dynServices ?? []).map((svc) => (
            <button
              key={svc.slug}
              onClick={() => setSelectedService(svc.slug)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedService === svc.slug
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              {svc.name}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isPending && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Grid do catálogo */}
        {!isPending && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <ShoppingBag className="mx-auto mb-3 size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhuma assinatura disponível no momento.</p>
            {search && <p className="mt-1 text-sm text-muted-foreground">Tente outro termo de busca.</p>}
          </div>
        )}

        {!isPending && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ServiceLogo slug={product.service} size="size-12" />
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold">{product.serviceName}</h3>
                    {product.serviceShort && (
                      <p className="text-xs text-muted-foreground">{product.serviceShort}</p>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Preço único</p>
                    <p className="font-display text-2xl font-bold text-primary">{product.priceFormatted}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/loja/checkout/${product.id}`)}
                    className="gap-1.5"
                  >
                    <CreditCard className="size-4" />
                    Comprar
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        BKLOGINS © {new Date().getFullYear()} — Todas as assinaturas com garantia.
      </footer>
    </div>
  );
}

function CheckoutPage({ productId }: { productId: string }) {
  const [, navigate] = useLocation();
  const { data: catalog } = useCatalog();
  const checkout = useCheckout();
  const svcMap = useServiceMap();
  const nameOf = (slug: string) => svcMap[slug]?.name ?? SERVICE_MAP[slug]?.name ?? slug;

  const product = (catalog ?? []).find((p) => p.id === productId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShoppingBag className="mx-auto mb-3 size-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/loja")}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  async function handleCheckout() {
    try {
      const r = await checkout.mutateAsync({
        productId: product!.id,
        customerName: name,
        customerEmail: email,
        customerWhatsapp: whatsapp,
      });
      if (r.paymentUrl) {
        navigate(`/loja/sucesso/${r.order.id}`);
        window.open(r.paymentUrl, "_blank", "noopener");
      } else {
        navigate(`/loja/sucesso/${r.order.id}`);
      }
    } catch {
      toast.error("Falha ao criar pedido. Tente novamente.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <button onClick={() => navigate("/loja")} className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </button>
          <div className="font-brand text-base font-extrabold">BKLOGINS</div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="mb-6 font-display text-2xl font-bold">Finalizar pedido</h2>

        {/* Card do produto */}
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <ServiceLogo slug={product.service} size="size-14" />
          <div>
            <h3 className="text-lg font-semibold">{nameOf(product.service)}</h3>
            <p className="text-sm text-muted-foreground">Licença única — entrega imediata</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-display text-xl font-bold text-primary">{product.priceFormatted}</p>
          </div>
        </div>

        {/* Formulário */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nome (opcional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
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

          <Button
            onClick={handleCheckout}
            disabled={checkout.isPending}
            className="mt-2 w-full"
            size="lg"
          >
            {checkout.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            Pagar com Mercado Pago
          </Button>
        </div>
      </main>
    </div>
  );
}

function SuccessPage({ orderId }: { orderId: string }) {
  const [, navigate] = useLocation();
  const { data, isPending } = useOrder(orderId);

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "Aguardando pagamento", color: "text-amber-500" },
    approved: { label: "Pagamento aprovado!", color: "text-[#2fbf71]" },
    rejected: { label: "Pagamento recusado", color: "text-[#F0484B]" },
    cancelled: { label: "Cancelado", color: "text-muted-foreground" },
    refunded: { label: "Reembolsado", color: "text-muted-foreground" },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <button onClick={() => navigate("/loja")} className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para a loja
          </button>
          <div className="font-brand text-base font-extrabold">BKLOGINS</div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        {isPending ? (
          <Loader2 className="mx-auto mb-4 size-10 animate-spin text-muted-foreground" />
        ) : data ? (
          <>
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-[#2fbf71]/15">
              {data.status === "approved" ? (
                <CheckCircle2 className="size-10 text-[#2fbf71]" />
              ) : data.status === "pending" ? (
                <Loader2 className="size-10 animate-spin text-amber-500" />
              ) : (
                <X className="size-10 text-[#F0484B]" />
              )}
            </div>

            <h2 className="mb-2 font-display text-2xl font-bold">
              {data.status === "approved" ? "Pedido confirmado!" : data.status === "pending" ? "Pagamento pendente" : "Pedido não finalizado"}
            </h2>

            <p className={`mb-6 font-medium ${statusLabel[data.status]?.color ?? "text-muted-foreground"}`}>
              {statusLabel[data.status]?.label ?? data.status}
            </p>

            <div className="rounded-2xl border border-border bg-card p-5 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Pedido</span>
                <span className="font-mono text-xs">{data.id.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Serviço</span>
                <span className="font-medium">{data.service}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-display font-bold text-primary">{data.priceFormatted}</span>
              </div>
            </div>

            {data.status === "pending" && (
              <p className="mt-6 text-sm text-muted-foreground">
                Complete o pagamento na janela do Mercado Pago que abriu.
                Se já pagou, aguarde a confirmação — pode levar até 2 minutos.
              </p>
            )}

            {data.status === "approved" && (
              <Button className="mt-6" onClick={() => navigate("/loja")}>
                <ShoppingBag className="size-4" />
                Comprar outra assinatura
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Pedido não encontrado.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/loja")}>
              Voltar para a loja
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
