import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ClipboardList, Loader2, CheckCircle2, XCircle, Undo2, Search, ExternalLink, Copy, Eye, EyeOff } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { useAdminOrders, useUpdateOrderStatus, type ShopOrder } from "../lib/shop";
import { formatPrice } from "../lib/format";

const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendentes", color: "text-amber-500" },
  { value: "approved", label: "Aprovados", color: "text-[#2fbf71]" },
  { value: "rejected", label: "Recusados", color: "text-[#F0484B]" },
  { value: "cancelled", label: "Cancelados", color: "text-muted-foreground" },
];

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  pending: { label: "Pendente", classes: "bg-amber-500/15 text-amber-500" },
  approved: { label: "Aprovado", classes: "bg-[#2fbf71]/15 text-[#2fbf71]" },
  rejected: { label: "Recusado", classes: "bg-[#F0484B]/15 text-[#F0484B]" },
  cancelled: { label: "Cancelado", classes: "bg-muted text-muted-foreground" },
  refunded: { label: "Reembolsado", classes: "bg-muted text-muted-foreground" },
};

function formatDate(ts: string | number): string {
  const d = new Date(typeof ts === "string" ? ts : ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ShopOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const { data: orders, isPending } = useAdminOrders(statusFilter || undefined);
  const updateStatus = useUpdateOrderStatus();

  // Modal de detalhes
  const [detailOrder, setDetailOrder] = useState<ShopOrder | null>(null);
  const [reveal, setReveal] = useState(false);

  const filtered = (orders ?? []).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const haystack = `${o.customerName} ${o.customerEmail} ${o.service} ${o.id}`.toLowerCase();
    return haystack.includes(q);
  });

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    try {
      await updateStatus.mutateAsync({ id: orderId, status: newStatus });
      toast.success(`Pedido ${newStatus === "approved" ? "aprovado" : newStatus === "cancelled" ? "cancelado" : "atualizado"}`);
      setDetailOrder(null);
    } catch {
      toast.error("Falha ao atualizar pedido.");
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  const pendingCount = orders?.filter((o) => o.status === "pending").length ?? 0;
  const approvedCount = orders?.filter((o) => o.status === "approved").length ?? 0;

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 font-display text-3xl font-bold"
          >
            <ClipboardList className="size-7 text-primary" />
            Pedidos da Loja
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-muted-foreground"
          >
            Gerencie os pedidos da vitrine. Aprove pagamentos ou cancele pedidos.
          </motion.p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{orders?.length ?? 0}</div>
            <div className="text-sm text-muted-foreground">Total de pedidos</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <Loader2 className="size-6 animate-spin" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-[#2fbf71]/30 bg-[#2fbf71]/5 p-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#2fbf71]/15 text-[#2fbf71]">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{approvedCount}</div>
            <div className="text-sm text-muted-foreground">Aprovados</div>
          </div>
        </div>
      </div>

      {/* Filtro por status */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, serviço..."
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {isPending && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Lista */}
      {!isPending && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
          <ClipboardList className="mx-auto mb-3 size-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
        </div>
      )}

      {!isPending && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Desktop */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 text-foreground/80">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customerName || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customerEmail || o.customerWhatsapp || "sem contato"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{o.service}</td>
                  <td className="px-4 py-3 font-display font-semibold text-primary">{formatPrice(o.priceCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[o.status]?.classes ?? "bg-muted text-muted-foreground"}`}>
                      {o.status === "approved" && <CheckCircle2 className="size-3" />}
                      {o.status === "pending" && <Loader2 className="size-3 animate-spin" />}
                      {o.status === "rejected" && <XCircle className="size-3" />}
                      {o.status === "cancelled" && <Undo2 className="size-3" />}
                      {STATUS_BADGE[o.status]?.label ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => { setDetailOrder(o); setReveal(false); }}>
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <div className="divide-y divide-border/60 md:hidden">
            {filtered.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[o.status]?.classes ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_BADGE[o.status]?.label ?? o.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{o.customerName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.service}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-bold text-primary">{formatPrice(o.priceCents)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setDetailOrder(o); setReveal(false); }}>
                  Ver detalhes
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de detalhes do pedido */}
      <Modal
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={`Pedido ${detailOrder?.id?.slice(0, 8) ?? ""}...`}
        footer={
          detailOrder ? (
            <>
              <Button variant="outline" onClick={() => setDetailOrder(null)}>
                Fechar
              </Button>
              {detailOrder.status === "pending" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleUpdateStatus(detailOrder.id, "cancelled")}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="size-4" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(detailOrder.id, "approved")}
                    disabled={updateStatus.isPending}
                  >
                    {updateStatus.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Aprovar manualmente
                  </Button>
                </>
              )}
              {detailOrder.status === "approved" && (
                <Button
                  variant="secondary"
                  onClick={() => handleUpdateStatus(detailOrder.id, "cancelled")}
                  disabled={updateStatus.isPending}
                >
                  <Undo2 className="size-4" />
                  Cancelar / Reembolsar
                </Button>
              )}
              {(detailOrder.status === "rejected" || detailOrder.status === "cancelled") && (
                <Button
                  onClick={() => handleUpdateStatus(detailOrder.id, "approved")}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="size-4" />
                  Reativar (aprovar)
                </Button>
              )}
            </>
          ) : null
        }
      >
        {detailOrder && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className={`mt-1 font-semibold ${STATUS_BADGE[detailOrder.status]?.classes?.split(" ")?.pop() ?? ""}`}>
                  {STATUS_BADGE[detailOrder.status]?.label ?? detailOrder.status}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Valor</div>
                <div className="mt-1 font-display font-bold text-primary">{formatPrice(detailOrder.priceCents)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-xs text-muted-foreground">Serviço</div>
              <div className="mt-1 font-semibold">{detailOrder.service}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Cliente</div>
                <div className="mt-1">{detailOrder.customerName || "—"}</div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1 truncate">{detailOrder.customerEmail || "—"}</div>
              </div>
            </div>

            {detailOrder.customerWhatsapp && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">WhatsApp</div>
                <div className="mt-1">{detailOrder.customerWhatsapp}</div>
              </div>
            )}

            {detailOrder.mercadoPagoPreferenceId && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Mercado Pago</div>
                <div className="mt-1 font-mono text-xs">{detailOrder.mercadoPagoPreferenceId}</div>
              </div>
            )}

            {detailOrder.status === "approved" && detailOrder.deliveredEmail && (
              <div className="rounded-lg border border-[#2fbf71]/30 bg-[#2fbf71]/5 p-4">
                <div className="mb-2 text-xs font-semibold text-[#2fbf71]">CONTA ENTREGUE</div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{detailOrder.deliveredEmail}</span>
                    <button onClick={() => copy(detailOrder.deliveredEmail!, "Email")} className="text-muted-foreground hover:text-foreground">
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Senha</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{reveal ? detailOrder.deliveredPassword : "••••••••"}</span>
                    <button onClick={() => setReveal((r) => !r)} className="text-muted-foreground hover:text-foreground">
                      {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    {detailOrder.deliveredPassword && (
                      <button onClick={() => copy(detailOrder.deliveredPassword!, "Senha")} className="text-muted-foreground hover:text-foreground">
                        <Copy className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detailOrder.notes && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">Observações</div>
                <div className="mt-1 text-sm">{detailOrder.notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
