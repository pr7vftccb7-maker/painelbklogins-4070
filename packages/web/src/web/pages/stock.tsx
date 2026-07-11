import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Boxes, Upload, Loader2, Trash2, Copy, Eye, EyeOff, Package, CheckCircle2, UserPlus, AlertTriangle, Tag, MessageCircle, Search, X, Sparkles, BadgeCheck, Check, ShoppingCart, ShoppingBag } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { ClientSelect } from "../components/client-select";
import type { Client } from "../lib/clients";
import { SERVICE_MAP } from "../../shared/services";
import { useServices, useServiceMap } from "../lib/services";
import { logoUrl } from "../lib/utils";
import { useStock, useStockSummary, useImportStock, useDeleteStock, useClearUsed, useAssignStock, useSetStockStatus, useActivateStock } from "../lib/stock";
import { useToggleSale } from "../lib/shop";
import type { StockAccount } from "../lib/stock";
import { usePixInfo, type Account } from "../lib/accounts";
import { buildWelcomeLink } from "../lib/charge";
import { addMonthsKeepDay, todayISO, formatPrice } from "../lib/format";

function ServiceLogo({ slug, size = "size-9" }: { slug: string; size?: string }) {
  const dynamicMap = useServiceMap();
  const svc = dynamicMap[slug] ?? SERVICE_MAP[slug];
  if (!svc) return null;
  return (
    <div className={`flex ${size} items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5`}>
      {svc.logo ? (
        <img src={logoUrl(svc.logo)} alt={svc.name} className="size-full object-contain p-1" loading="lazy" />
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

export default function StockPage() {
  const [selectedService, setSelectedService] = useState<string>("");
  const [search, setSearch] = useState("");
  const { data: dynServices } = useServices();
  const svcMap = useServiceMap();
  const { data: pix } = usePixInfo();
  const nameOf = (slug: string) => svcMap[slug]?.name ?? SERVICE_MAP[slug]?.name ?? slug;
  const { data: summary } = useStockSummary();
  const { data: stock } = useStock(selectedService || undefined);
  const importMut = useImportStock();
  const deleteMut = useDeleteStock();
  const clearMut = useClearUsed();
  const assignMut = useAssignStock();
  const statusMut = useSetStockStatus();
  const activateMut = useActivateStock();
  const toggleSaleMut = useToggleSale();

  const [importOpen, setImportOpen] = useState(false);
  const [importService, setImportService] = useState("netflix");
  const [importClient, setImportClient] = useState<Client | null>(null);
  const [importVirgin, setImportVirgin] = useState(false);
  const [listText, setListText] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  // visão: "disponivel" (disponíveis + usadas), "problema" (canceladas/caídas/atualizar pagamento)
  // ou "virgem" (emails ainda sem assinatura)
  const [stockView, setStockView] = useState<"disponivel" | "problema" | "virgem">("disponivel");

  // Modal "assinar email virgem"
  const [activateAccount, setActivateAccount] = useState<StockAccount | null>(null);
  const [activatePassword, setActivatePassword] = useState("");

  // Modal toggle venda
  const [saleAccount, setSaleAccount] = useState<StockAccount | null>(null);
  const [salePrice, setSalePrice] = useState("");

  function openToggleSale(s: StockAccount) {
    setSaleAccount(s);
    setSalePrice(s.salePriceCents ? String((s.salePriceCents / 100).toFixed(2).replace(".", ",")) : "");
  }

  async function doToggleSale() {
    if (!saleAccount) return;
    try {
      const priceCents = salePrice
        ? Math.round(parseFloat(salePrice.replace(",", ".")) * 100)
        : saleAccount.salePriceCents;

      const newForSale = !saleAccount.forSale;
      if (newForSale && !priceCents) {
        toast.error("Defina um preço para liberar a venda.");
        return;
      }

      await toggleSaleMut.mutateAsync({
        id: saleAccount.id,
        forSale: newForSale,
        salePriceCents: priceCents || undefined,
      });
      toast.success(
        newForSale
          ? `Conta ${saleAccount.email} liberada para venda na loja`
          : `Conta ${saleAccount.email} removida da vitrine`,
      );
      setSaleAccount(null);
    } catch {
      toast.error("Falha ao alterar disponibilidade. Tente novamente.");
    }
  }

  function openActivate(s: StockAccount) {
    setActivateAccount(s);
    setActivatePassword(s.password || "");
  }

  async function doActivate() {
    if (!activateAccount) return;
    try {
      await activateMut.mutateAsync({ id: activateAccount.id, password: activatePassword });
      toast.success(`${activateAccount.email} assinado — agora está disponível no estoque`);
      setActivateAccount(null);
    } catch {
      toast.error("Falha ao assinar conta. Tente novamente.");
    }
  }

  // Modal "passar conta para cliente"
  const [assignAccount, setAssignAccount] = useState<StockAccount | null>(null);
  const [assignClient, setAssignClient] = useState<Client | null>(null);
  const [assignDue, setAssignDue] = useState("");
  const [assignPrice, setAssignPrice] = useState("");
  const [assignExtra1, setAssignExtra1] = useState("");
  const [assignExtra2, setAssignExtra2] = useState("");

  function openAssign(s: StockAccount) {
    setAssignAccount(s);
    setAssignClient(null);
    setAssignDue("");
    setAssignPrice("");
    setAssignExtra1("");
    setAssignExtra2("");
  }

  // Modal "mudar status"
  const [statusAccount, setStatusAccount] = useState<StockAccount | null>(null);
  const [statusValue, setStatusValue] = useState<"disponivel" | "usada" | "problema">("disponivel");
  const [statusProblem, setStatusProblem] = useState("cancelada");

  function openStatus(s: StockAccount) {
    setStatusAccount(s);
    setStatusValue((s.status as "disponivel" | "usada" | "problema") ?? "disponivel");
    setStatusProblem(s.problemType || "cancelada");
  }

  async function doStatus() {
    if (!statusAccount) return;
    try {
      await statusMut.mutateAsync({
        id: statusAccount.id,
        status: statusValue,
        problemType: statusValue === "problema" ? statusProblem : undefined,
      });
      toast.success(`Status de ${statusAccount.email} atualizado`);
      setStatusAccount(null);
    } catch {
      toast.error("Falha ao mudar status. Tente novamente.");
    }
  }

  async function doAssign(sendWhatsapp = false) {
    if (!assignAccount) return;
    if (!assignClient) {
      toast.error("Selecione um cliente");
      return;
    }
    if (sendWhatsapp && !assignClient.whatsapp) {
      toast.error("Este cliente não tem WhatsApp cadastrado");
      return;
    }
    const priceCents = assignPrice
      ? Math.round(parseFloat(assignPrice.replace(",", ".")) * 100)
      : undefined;

    // Monta o link do WhatsApp com os dados que já temos (sem depender do servidor),
    // para abrir a aba JÁ com a URL de forma síncrona — igual ao botão "Cobrar".
    // Abrir a aba em branco e setar href depois quebra dentro do preview (tela em branco).
    let waLink: string | null = null;
    if (sendWhatsapp) {
      const dueDate = assignDue || addMonthsKeepDay(todayISO(), 1);
      const previewAccount: Account = {
        id: "",
        service: assignAccount.service,
        email: assignAccount.email,
        password: assignAccount.password,
        client: assignClient.name,
        clientId: assignClient.id,
        clientCode: assignClient.code,
        whatsapp: assignClient.whatsapp,
        priceCents: priceCents ?? 0,
        dueDate,
        extraScreens: [assignExtra1, assignExtra2].filter(Boolean).length,
        extraScreenEmail1: assignExtra1,
        extraScreenEmail2: assignExtra2,
        paymentMethod: "",
        status: "ativa",
        notes: assignAccount.notes ?? "",
      } as Account;
      waLink = buildWelcomeLink(
        previewAccount,
        { pixKey: pix?.pixKey ?? "", pixName: pix?.pixName ?? "" },
        assignClient.whatsapp,
      );
    }

    // Abre a aba JÁ com a URL, de forma síncrona, dentro do gesto do clique.
    if (sendWhatsapp && waLink) {
      window.open(waLink, "_blank", "noopener");
    }

    try {
      await assignMut.mutateAsync({
        id: assignAccount.id,
        clientId: assignClient.id,
        dueDate: assignDue || undefined,
        priceCents,
        extraScreenEmail1: assignExtra1 || undefined,
        extraScreenEmail2: assignExtra2 || undefined,
      });
      toast.success(
        `Conta ${assignAccount.email} atribuída a #${assignClient.code} ${assignClient.name}`,
      );
      setAssignAccount(null);
      setAssignClient(null);
    } catch {
      toast.error("Falha ao passar a conta. Tente novamente.");
    }
  }

  const availableTotal = summary?.availableTotal ?? 0;
  const problemTotal = summary?.problemTotal ?? 0;
  const virginTotal = summary?.virginTotal ?? 0;

  // filtra o estoque pela visão selecionada + busca por email ou cliente
  const searchTerm = search.trim().toLowerCase();
  const viewStock = (stock ?? [])
    .filter((s) => {
      if (stockView === "problema") return s.status === "problema";
      if (stockView === "virgem") return s.status === "virgem";
      return s.status !== "problema" && s.status !== "virgem";
    })
    .filter((s) => {
      if (!searchTerm) return true;
      const haystack = `${s.email} ${s.clientName ?? ""} ${nameOf(s.service)}`.toLowerCase();
      return haystack.includes(searchTerm);
    });

  const PROBLEM_LABEL: Record<string, string> = {
    cancelada: "Cancelada",
    caida: "Caída",
    atualizar_pagamento: "Atualizar pagamento",
  };

  async function doImport() {
    if (!listText.trim()) {
      toast.error("Cole a lista de contas primeiro");
      return;
    }
    try {
      const clientId = importVirgin ? undefined : importClient?.id;
      const r = await importMut.mutateAsync({ service: importService, list: listText, clientId, virgin: importVirgin });
      if (r.added === 0 && r.skipped === 0) {
        toast.error("Nenhuma conta válida encontrada. Use o formato email:senha por linha.");
        return;
      }
      if (importVirgin) {
        toast.success(`${r.added} email(s) virgem(ns) adicionado(s) em ${nameOf(importService)}`);
      } else if (importClient) {
        toast.success(
          `${r.added} conta(s) cadastrada(s) para #${importClient.code} ${importClient.name} em ${nameOf(importService)}`,
        );
      } else {
        toast.success(
          `${r.added} conta(s) adicionada(s) ao estoque${r.skipped > 0 ? ` — ${r.skipped} duplicada(s) ignorada(s)` : ""}`,
        );
      }
      setListText("");
      setImportClient(null);
      setImportVirgin(false);
      setImportOpen(false);
      setSelectedService(importService);
      if (importVirgin) setStockView("virgem");
    } catch {
      toast.error("Falha ao importar. Tente novamente.");
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  // linhas contadas na caixa de texto
  const lineCount = listText.split(/\r?\n/).filter((l) => l.trim() && l.includes("@")).length;

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 font-display text-3xl font-bold"
          >
            <Boxes className="size-7 text-primary" />
            Estoque
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-muted-foreground"
          >
            {availableTotal} conta(s) disponível(is) para usar. Importe listas de email:senha por serviço.
          </motion.p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="size-4" />
          Importar contas
        </Button>
      </div>

      {/* Cards de visão: Disponíveis x Com problema x Email Virgens */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          onClick={() => setStockView("disponivel")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            stockView === "disponivel" ? "border-[#2fbf71] bg-[#2fbf71]/10" : "border-border bg-card hover:border-white/20"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#2fbf71]/15 text-[#2fbf71]">
            <Package className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{availableTotal}</div>
            <div className="text-sm text-muted-foreground">Disponíveis para usar</div>
          </div>
        </button>
        <button
          onClick={() => setStockView("virgem")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            stockView === "virgem" ? "border-[#6D5EF6] bg-[#6D5EF6]/10" : "border-border bg-card hover:border-white/20"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#6D5EF6]/15 text-[#6D5EF6]">
            <Sparkles className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{virginTotal}</div>
            <div className="text-sm text-muted-foreground">Email Virgens (sem assinatura)</div>
          </div>
        </button>
        <button
          onClick={() => setStockView("problema")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            stockView === "problema" ? "border-[#F0484B] bg-[#F0484B]/10" : "border-border bg-card hover:border-white/20"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#F0484B]/15 text-[#F0484B]">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">{problemTotal}</div>
            <div className="text-sm text-muted-foreground">Canceladas / caídas / pagamento</div>
          </div>
        </button>
      </div>

      {/* Cards de serviço com contagem de estoque */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <button
          onClick={() => setSelectedService("")}
          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            selectedService === "" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-white/20"
          }`}
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold">Todos</div>
            <div className="text-xs text-muted-foreground">
              {stockView === "problema"
                ? `${problemTotal} c/ problema`
                : stockView === "virgem"
                  ? `${virginTotal} virgens`
                  : `${availableTotal} disp.`}
            </div>
          </div>
        </button>
        {(dynServices ?? []).map((svc) => {
          const stats = summary?.byService[svc.slug];
          const available = stats?.available ?? 0;
          const problem = stats?.problem ?? 0;
          const virgin = stats?.virgin ?? 0;
          const count = stockView === "problema" ? problem : stockView === "virgem" ? virgin : available;
          const countLabel = stockView === "problema" ? "c/ prob." : stockView === "virgem" ? "virgens" : "disp.";
          const countColor = stockView === "problema" ? "text-[#F0484B]" : stockView === "virgem" ? "text-[#6D5EF6]" : "text-[#2fbf71]";
          return (
            <button
              key={svc.slug}
              onClick={() => setSelectedService(svc.slug)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                selectedService === svc.slug ? "border-primary bg-primary/10" : "border-border bg-card hover:border-white/20"
              }`}
            >
              <ServiceLogo slug={svc.slug} />
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{svc.name}</div>
                <div className="text-xs text-muted-foreground">
                  {count > 0 ? (
                    <span className={countColor}>
                      {count} {countLabel}
                    </span>
                  ) : (
                    `0 ${countLabel}`
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Busca de contas no estoque */}
      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por email ou cliente..."
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Tabela de contas do estoque */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {stockView === "problema" ? "Com problema" : stockView === "virgem" ? "Email Virgens" : "Disponíveis"}
          {selectedService ? ` · ${nameOf(selectedService)}` : ""}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({viewStock.length})</span>
        </h2>
        {stockView === "disponivel" && viewStock.some((s) => s.status === "usada") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMut.mutate(selectedService || undefined)}
            disabled={clearMut.isPending}
          >
            <Trash2 className="size-4" />
            Limpar usadas
          </Button>
        )}
      </div>

      {viewStock.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Boxes className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {searchTerm
              ? `Nenhuma conta encontrada para "${search}".`
              : stockView === "problema"
                ? `Nenhuma conta com problema${selectedService ? " para este serviço" : ""}.`
                : stockView === "virgem"
                  ? `Nenhum email virgem${selectedService ? " para este serviço" : ""}.`
                  : `Nenhuma conta no estoque${selectedService ? " para este serviço" : ""}.`}
          </p>
          {stockView === "disponivel" && !searchTerm && (
            <Button className="mt-4" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Importar agora
            </Button>
          )}
          {stockView === "virgem" && !searchTerm && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setImportVirgin(true);
                setImportOpen(true);
              }}
            >
              <Sparkles className="size-4" />
              Adicionar email virgem
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Desktop */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Senha</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">Vitrine</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {viewStock.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ServiceLogo slug={s.service} size="size-8" />
                      <span className="font-medium">{nameOf(s.service)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/90">{s.email}</span>
                      <button onClick={() => copy(s.email, "Email")} className="text-muted-foreground hover:text-foreground">
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-foreground/90">
                        {reveal[s.id] ? s.password || "—" : "••••••••"}
                      </span>
                      <button
                        onClick={() => setReveal((r) => ({ ...r, [s.id]: !r[s.id] }))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {reveal[s.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      {s.password && (
                        <button onClick={() => copy(s.password, "Senha")} className="text-muted-foreground hover:text-foreground">
                          <Copy className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "virgem" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#6D5EF6]/15 px-2.5 py-1 text-xs font-medium text-[#6D5EF6]">
                        <Sparkles className="size-3" />
                        Virgem
                      </span>
                    ) : s.status === "problema" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F0484B]/15 px-2.5 py-1 text-xs font-medium text-[#F0484B]">
                        <AlertTriangle className="size-3" />
                        {PROBLEM_LABEL[s.problemType ?? ""] ?? "Problema"}
                      </span>
                    ) : s.status === "usada" ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          <CheckCircle2 className="size-3" /> Usada
                        </span>
                        {s.clientName && (
                          <span className="text-xs text-muted-foreground">
                            {s.clientCode ? `#${s.clientCode} ` : ""}
                            {s.clientName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#2fbf71]/15 px-2.5 py-1 text-xs font-medium text-[#2fbf71]">
                        Disponível
                      </span>
                    )}
                  </td>
                  {/* Coluna Vitrine */}
                  <td className="px-4 py-3 text-center">
                    {s.status === "disponivel" ? (
                      <button
                        onClick={() => openToggleSale(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          (s as any).forSale
                            ? "bg-primary/15 text-primary hover:bg-primary/25"
                            : "bg-muted text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                        }`}
                        title={(s as any).forSale ? `R$ ${formatPrice((s as any).salePriceCents ?? 0)} — Clique para remover` : "Clique para liberar na loja"}
                      >
                        <ShoppingBag className="size-3" />
                        {(s as any).forSale
                          ? `R$ ${((s as any).salePriceCents ?? 0) > 0 ? formatPrice((s as any).salePriceCents) : "0,00"}`
                          : "Vender"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === "virgem" ? (
                        <>
                          <button
                            onClick={() => openActivate(s)}
                            className="flex items-center gap-1 rounded-md bg-[#6D5EF6]/15 px-2 py-1.5 text-xs font-medium text-[#6D5EF6] transition-colors hover:bg-[#6D5EF6]/25"
                            title="Marcar como assinado"
                          >
                            <BadgeCheck className="size-3.5" />
                            Assinar
                          </button>
                          <button
                            onClick={() => deleteMut.mutate(s.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openStatus(s)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-amber-500/15 hover:text-amber-500"
                            aria-label="Mudar status"
                            title="Mudar status"
                          >
                            <Tag className="size-4" />
                          </button>
                          {s.status !== "usada" && (
                            <button
                              onClick={() => openAssign(s)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                              aria-label="Passar para cliente"
                              title="Passar para cliente"
                            >
                              <UserPlus className="size-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMut.mutate(s.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <div className="divide-y divide-border/60 md:hidden">
            {viewStock.map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-4">
                <ServiceLogo slug={s.service} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{nameOf(s.service)}</span>
                    {s.status === "virgem" ? (
                      <span className="rounded-full bg-[#6D5EF6]/15 px-2 py-0.5 text-[11px] text-[#6D5EF6]">Virgem</span>
                    ) : s.status === "problema" ? (
                      <span className="rounded-full bg-[#F0484B]/15 px-2 py-0.5 text-[11px] text-[#F0484B]">
                        {PROBLEM_LABEL[s.problemType ?? ""] ?? "Problema"}
                      </span>
                    ) : s.status === "usada" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Usada</span>
                    ) : (
                      <span className="rounded-full bg-[#2fbf71]/15 px-2 py-0.5 text-[11px] text-[#2fbf71]">Disponível</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="truncate text-foreground/90">{s.email}</span>
                    <button onClick={() => copy(s.email, "Email")} className="shrink-0 text-muted-foreground">
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="font-mono text-foreground/80">{reveal[s.id] ? s.password || "—" : "••••••"}</span>
                    <button onClick={() => setReveal((r) => ({ ...r, [s.id]: !r[s.id] }))} className="text-muted-foreground">
                      {reveal[s.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    {s.password && (
                      <button onClick={() => copy(s.password, "Senha")} className="text-muted-foreground">
                        <Copy className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {s.status === "disponivel" && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => openToggleSale(s)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          (s as any).forSale
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <ShoppingBag className="size-3" />
                        {(s as any).forSale
                          ? `Na loja — R$ ${((s as any).salePriceCents ?? 0) > 0 ? formatPrice((s as any).salePriceCents) : "0,00"}`
                          : "Liberar na loja"}
                      </button>
                    </div>
                  )}
                  {s.status === "usada" && s.clientName && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Cliente: {s.clientCode ? `#${s.clientCode} ` : ""}
                      {s.clientName}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {s.status === "virgem" ? (
                    <button
                      onClick={() => openActivate(s)}
                      className="rounded-md p-1.5 text-[#6D5EF6] hover:bg-[#6D5EF6]/15"
                      aria-label="Marcar como assinado"
                    >
                      <BadgeCheck className="size-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => openStatus(s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-500/15 hover:text-amber-500"
                        aria-label="Mudar status"
                      >
                        <Tag className="size-4" />
                      </button>
                      {s.status !== "usada" && (
                        <button
                          onClick={() => openAssign(s)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                          aria-label="Passar para cliente"
                        >
                          <UserPlus className="size-4" />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => deleteMut.mutate(s.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Liberar para venda */}
      <Modal
        open={!!saleAccount}
        onClose={() => setSaleAccount(null)}
        title={(saleAccount as any)?.forSale ? "Gerenciar venda na loja" : "Liberar para venda na loja"}
        footer={
          <>
            <Button variant="outline" onClick={() => setSaleAccount(null)}>
              Cancelar
            </Button>
            <Button onClick={doToggleSale} disabled={toggleSaleMut.isPending}>
              {toggleSaleMut.isPending && <Loader2 className="size-4 animate-spin" />}
              {(saleAccount as any)?.forSale ? "Remover da loja" : "Liberar na loja"}
            </Button>
          </>
        }
      >
        {saleAccount && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
              <ServiceLogo slug={saleAccount.service} size="size-8" />
              <div className="min-w-0">
                <div className="font-medium">{nameOf(saleAccount.service)}</div>
                <div className="truncate text-sm text-muted-foreground">{saleAccount.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <ShoppingBag className="size-5 text-primary" />
              <div>
                <div className="text-sm font-medium">
                  {(saleAccount as any).forSale
                    ? "Esta conta está na vitrine da loja"
                    : "Esta conta NÃO está na vitrine"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(saleAccount as any).forSale
                    ? `Preço atual: R$ ${formatPrice((saleAccount as any).salePriceCents ?? 0)}`
                    : "Nenhum preço definido para venda"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Preço de venda (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="29,90"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {saleAccount.salePriceCents
                  ? `Preço atual: ${formatPrice(saleAccount.salePriceCents)}. Deixe vazio para manter.`
                  : "Defina o preço que aparecerá na vitrine da loja."}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de importação */}
      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportVirgin(false);
        }}
        title={importVirgin ? "Adicionar emails virgens" : "Importar contas para o estoque"}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(false);
                setImportVirgin(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={doImport} disabled={importMut.isPending}>
              {importMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Adicionar {lineCount > 0 ? `(${lineCount})` : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setImportVirgin((v) => !v)}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              importVirgin ? "border-[#6D5EF6] bg-[#6D5EF6]/10" : "border-border bg-secondary/30 hover:border-white/20"
            }`}
          >
            <div className={`flex size-9 items-center justify-center rounded-lg ${importVirgin ? "bg-[#6D5EF6]/20 text-[#6D5EF6]" : "bg-muted text-muted-foreground"}`}>
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Email virgem (ainda sem assinatura)</div>
              <p className="text-xs text-muted-foreground">
                Use pra guardar emails que você já tem mas ainda não assinou o serviço. Depois de assinar, marque como "Assinar" e a conta vira estoque normal.
              </p>
            </div>
            <div
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                importVirgin ? "border-[#6D5EF6] bg-[#6D5EF6]" : "border-muted-foreground/40"
              }`}
            >
              {importVirgin && <Check className="size-3 text-white" />}
            </div>
          </button>
          <div className="flex flex-col gap-1.5">
            <Label>Serviço</Label>
            <select
              value={importService}
              onChange={(e) => setImportService(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {(dynServices ?? []).map((s) => (
                <option key={s.slug} value={s.slug} className="bg-card">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {!importVirgin && (
            <div className="flex flex-col gap-1.5">
              <Label>Cliente (opcional)</Label>
              <ClientSelect value={importClient?.id ?? null} onChange={setImportClient} allowNone />
              <p className="text-xs text-muted-foreground">
                {importClient
                  ? `As contas serão cadastradas para #${importClient.code} ${importClient.name} e aparecerão dentro do serviço.`
                  : "Sem cliente, as contas entram no estoque como disponíveis."}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>{importVirgin ? "Lista de emails" : "Lista de contas"}</Label>
            <textarea
              value={listText}
              onChange={(e) => setListText(e.target.value)}
              rows={10}
              placeholder={
                importVirgin
                  ? "email1@gmail.com\nemail2@gmail.com\nemail3@gmail.com"
                  : "email1@gmail.com:senha123\nemail2@gmail.com:senha456\nemail3@gmail.com:senha789"
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              {importVirgin
                ? "Um email por linha (senha é opcional, pode colocar email:senha se já souber). Duplicadas são ignoradas."
                : "Uma conta por linha no formato email:senha. Também aceita separação por espaço, vírgula ou ponto-e-vírgula. Duplicadas são ignoradas."}
            </p>
            {lineCount > 0 && (
              <p className="text-xs text-[#2fbf71]">{lineCount} {importVirgin ? "email(s) detectado(s)" : "conta(s) detectada(s)"}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: passar conta do estoque para um cliente */}
      <Modal
        open={!!assignAccount}
        onClose={() => setAssignAccount(null)}
        title="Passar conta para cliente"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignAccount(null)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => doAssign(false)} disabled={assignMut.isPending}>
              {assignMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Só passar
            </Button>
            <Button onClick={() => doAssign(true)} disabled={assignMut.isPending}>
              {assignMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Passar e enviar no WhatsApp
            </Button>
          </>
        }
      >
        {assignAccount && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
              <ServiceLogo slug={assignAccount.service} size="size-8" />
              <div className="min-w-0">
                <div className="font-medium">{nameOf(assignAccount.service)}</div>
                <div className="truncate text-sm text-muted-foreground">{assignAccount.email}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cliente</Label>
              <ClientSelect value={assignClient?.id ?? null} onChange={setAssignClient} />
              <p className="text-xs text-muted-foreground">
                A conta vira uma assinatura ativa deste cliente e sai do estoque (marcada como usada).
              </p>
              {assignClient && !assignClient.whatsapp && (
                <p className="text-xs text-[#f5a524]">
                  Este cliente não tem WhatsApp cadastrado — o envio automático ficará indisponível.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
                <p className="text-xs text-muted-foreground">Vazio = +1 mês.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={assignPrice}
                  onChange={(e) => setAssignPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Telas extra (emails)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={assignExtra1}
                  onChange={(e) => setAssignExtra1(e.target.value)}
                  placeholder="Email da tela extra 1"
                />
                <Input
                  value={assignExtra2}
                  onChange={(e) => setAssignExtra2(e.target.value)}
                  placeholder="Email da tela extra 2"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: mudar status da conta do estoque */}
      <Modal
        open={!!statusAccount}
        onClose={() => setStatusAccount(null)}
        title="Mudar status da conta"
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusAccount(null)}>
              Cancelar
            </Button>
            <Button onClick={doStatus} disabled={statusMut.isPending}>
              {statusMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar status
            </Button>
          </>
        }
      >
        {statusAccount && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
              <ServiceLogo slug={statusAccount.service} size="size-8" />
              <div className="min-w-0">
                <div className="font-medium">{nameOf(statusAccount.service)}</div>
                <div className="truncate text-sm text-muted-foreground">{statusAccount.email}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value as "disponivel" | "usada" | "problema")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="disponivel" className="bg-card">Disponível</option>
                <option value="usada" className="bg-card">Usada</option>
                <option value="problema" className="bg-card">Com problema</option>
              </select>
            </div>
            {statusValue === "problema" && (
              <div className="flex flex-col gap-1.5">
                <Label>Motivo do problema</Label>
                <select
                  value={statusProblem}
                  onChange={(e) => setStatusProblem(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="cancelada" className="bg-card">Cancelada</option>
                  <option value="caida" className="bg-card">Caída</option>
                  <option value="atualizar_pagamento" className="bg-card">Atualizar pagamento</option>
                </select>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: assinar email virgem */}
      <Modal
        open={!!activateAccount}
        onClose={() => setActivateAccount(null)}
        title="Marcar email como assinado"
        footer={
          <>
            <Button variant="outline" onClick={() => setActivateAccount(null)}>
              Cancelar
            </Button>
            <Button onClick={doActivate} disabled={activateMut.isPending}>
              {activateMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar assinatura
            </Button>
          </>
        }
      >
        {activateAccount && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
              <ServiceLogo slug={activateAccount.service} size="size-8" />
              <div className="min-w-0">
                <div className="font-medium">{nameOf(activateAccount.service)}</div>
                <div className="truncate text-sm text-muted-foreground">{activateAccount.email}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Confirme que você já assinou o serviço com este email. Ele sai de "Email Virgens" e passa a
              aparecer em "Disponíveis" no estoque, pronto pra passar pra um cliente.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>Senha da conta</Label>
              <Input
                value={activatePassword}
                onChange={(e) => setActivatePassword(e.target.value)}
                placeholder="Senha definida na assinatura"
              />
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
