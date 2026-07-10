import { useState } from "react";
import { motion } from "motion/react";
import {
  Wallet,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Layout } from "../components/layout";
import { useServiceMap } from "../lib/services";
import { logoUrl } from "../lib/utils";
import { formatPrice, formatDate } from "../lib/format";
import {
  useWallet,
  useWalletAccounts,
  useWalletTransactions,
  type WalletPeriod,
} from "../lib/wallet";
import type { Account } from "../lib/accounts";

const PERIODS: WalletPeriod[] = [7, 15, 30];

function ServiceLogo({ slug, size = "size-8" }: { slug: string; size?: string }) {
  const map = useServiceMap();
  const svc = map[slug];
  if (svc?.logo) {
    return <img src={logoUrl(svc.logo)} alt={svc.name} className={`${size} rounded-lg object-cover`} />;
  }
  return (
    <div
      className={`${size} flex items-center justify-center rounded-lg text-xs font-bold text-white`}
      style={{ backgroundColor: svc?.color ?? "#e11d48" }}
    >
      {svc?.short || slug.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" style={{ color: accent }} />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function AccountsList({ tab }: { tab: "paid_up" | "to_receive" }) {
  const { data, isLoading } = useWalletAccounts(tab);
  const map = useServiceMap();
  const nameOf = (slug: string) => map[slug]?.name ?? slug;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if ((data?.length ?? 0) === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {tab === "paid_up" ? "Nenhuma conta em dia." : "Nenhuma conta a receber."}
      </div>
    );
  }
  const total = (data ?? []).reduce((s, a) => s + (a.priceCents ?? 0), 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {data?.length} conta(s) · {tab === "paid_up" ? "já garantido no ciclo" : "pendente de recebimento"}
        </span>
        <span className="font-display text-lg font-bold tabular-nums" style={{ color: tab === "paid_up" ? "#2fbf71" : "#f5a524" }}>
          {formatPrice(total)}
        </span>
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
        {(data ?? []).map((a: Account) => (
          <div key={a.id} className="flex items-center gap-3 p-4">
            <ServiceLogo slug={a.service} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {a.clientCode ? `#${a.clientCode} ` : ""}
                {a.client || a.email}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {nameOf(a.service)} · vence {formatDate(a.dueDate)}
              </div>
            </div>
            <div className="text-right font-semibold tabular-nums">{formatPrice(a.priceCents)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsList({ period }: { period: WalletPeriod }) {
  const { data, isLoading } = useWalletTransactions(period);
  const map = useServiceMap();
  const nameOf = (slug: string) => map[slug]?.name ?? slug;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if ((data?.length ?? 0) === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Nenhuma entrada nos últimos {period} dias.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
      {(data ?? []).map((t) => (
        <div key={t.id} className="flex items-center gap-3 p-4">
          <ServiceLogo slug={t.service} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {t.clientCode ? `#${t.clientCode} ` : ""}
              {t.clientName || t.email}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t.kind === "venda" ? (
                <ShoppingCart className="size-3" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              {t.kind === "venda" ? "Venda" : "Renovação"} · {nameOf(t.service)} · {formatDate(t.paidOn)}
            </div>
          </div>
          <div className="text-right font-semibold tabular-nums text-[#2fbf71]">
            +{formatPrice(t.amountCents)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WalletPage() {
  const [period, setPeriod] = useState<WalletPeriod>(30);
  const [tab, setTab] = useState<"paid_up" | "to_receive" | "extrato">("paid_up");
  const { data, isLoading } = useWallet(period);

  return (
    <Layout>
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 font-display text-3xl font-bold"
        >
          <Wallet className="size-7 text-primary" />
          Carteira
        </motion.h1>
        <p className="mt-1 text-muted-foreground">Controle das entradas e do que você tem a receber.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Faturamento recorrente */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4 text-primary" />
              Faturamento mensal total
            </div>
            <div className="mt-2 font-display text-4xl font-bold tabular-nums text-glow-red">
              {formatPrice(data?.monthlyRecurringCents ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Soma do valor de {data?.soldCount ?? 0} conta(s) vendida(s) e ativa(s).
            </div>
          </motion.div>

          {/* Entradas por período */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Entradas recebidas</h2>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    period === p ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={ArrowDownCircle}
              label={`Total (${period} dias)`}
              value={formatPrice(data?.periodIncome.totalCents ?? 0)}
              sub={`${data?.periodIncome.count ?? 0} entrada(s)`}
              accent="#2fbf71"
            />
            <StatCard
              icon={ShoppingCart}
              label="Vendas novas"
              value={formatPrice(data?.periodIncome.salesCents ?? 0)}
              accent="#e11d48"
              delay={0.05}
            />
            <StatCard
              icon={RefreshCw}
              label="Renovações"
              value={formatPrice(data?.periodIncome.renewalsCents ?? 0)}
              accent="#f5a524"
              delay={0.1}
            />
          </div>

          {/* Abas: em dia / a receber / extrato */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <StatCard
              icon={CheckCircle2}
              label="Em dia (já renovadas)"
              value={formatPrice(data?.paidUp.totalCents ?? 0)}
              sub={`${data?.paidUp.count ?? 0} conta(s) garantidas`}
              accent="#2fbf71"
            />
            <StatCard
              icon={Clock}
              label="A receber (vencidas)"
              value={formatPrice(data?.toReceive.totalCents ?? 0)}
              sub={`${data?.toReceive.count ?? 0} conta(s) pendentes`}
              accent="#f5a524"
            />
          </div>

          <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setTab("paid_up")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "paid_up" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Em dia
            </button>
            <button
              onClick={() => setTab("to_receive")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "to_receive" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              A receber
            </button>
            <button
              onClick={() => setTab("extrato")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "extrato" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Extrato ({period}d)
            </button>
          </div>

          {tab === "extrato" ? (
            <TransactionsList period={period} />
          ) : (
            <AccountsList tab={tab} />
          )}
        </>
      )}
    </Layout>
  );
}
