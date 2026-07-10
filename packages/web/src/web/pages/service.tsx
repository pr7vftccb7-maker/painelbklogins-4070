import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "motion/react";
import { ArrowLeft, Plus, Loader2, Search, User, LayoutList, Users, ChevronRight, AlertTriangle } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AccountTable } from "../components/account-table";
import { AccountForm } from "../components/account-form";
import { SERVICE_MAP } from "../../shared/services";
import { useServiceMap } from "../lib/services";
import { logoUrl } from "../lib/utils";
import {
  useServiceAccounts,
  useCreateAccount,
  useUpdateAccount,
  useRenewAccount,
  useDeleteAccount,
  usePixInfo,
  type Account,
  type AccountInput,
} from "../lib/accounts";

export default function ServicePage() {
  const { slug } = useParams();
  const service = slug ?? "";
  const dynamicMap = useServiceMap();
  const meta = dynamicMap[service] ?? SERVICE_MAP[service];
  const { data: accounts, isLoading } = useServiceAccounts(service);
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const renew = useRenewAccount();
  const del = useDeleteAccount();
  const { data: pix } = usePixInfo();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  // cliente aberto no drill-down (key do grupo). null = mostrando cards
  const [openClient, setOpenClient] = useState<string | null>(null);

  const filtered = (accounts ?? []).filter((a) => {
    const q = query.toLowerCase();
    return (
      a.email.toLowerCase().includes(q) ||
      a.client.toLowerCase().includes(q) ||
      a.paymentMethod.toLowerCase().includes(q) ||
      (a.extraScreenEmail1 ?? "").toLowerCase().includes(q) ||
      (a.extraScreenEmail2 ?? "").toLowerCase().includes(q)
    );
  });

  const isOverdue = (a: Account) => a.status !== "cancelada" && new Date(a.dueDate) <= new Date();

  // Agrupa por código do cliente (identidade do cliente). Sem código → "Sem cliente".
  const groups = (() => {
    const map = new Map<string, { code: number | null; name: string; list: Account[] }>();
    for (const a of filtered) {
      const key = a.clientCode != null ? `c${a.clientCode}` : "__none__";
      if (!map.has(key)) map.set(key, { code: a.clientCode, name: a.client.trim(), list: [] });
      map.get(key)!.list.push(a);
    }
    // ordena por código crescente; "sem cliente" por último
    return [...map.entries()].sort(([, a], [, b]) => {
      if (a.code == null) return 1;
      if (b.code == null) return -1;
      return a.code - b.code;
    });
  })();

  const activeGroup = openClient ? groups.find(([key]) => key === openClient) : null;

  function handleSubmit(input: AccountInput) {
    if (editing) {
      update.mutate({ id: editing.id, input }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(input, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete(a: Account) {
    if (confirm(`Excluir a conta de ${a.client || a.email}?`)) del.mutate(a.id);
  }

  return (
    <Layout>
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
            {meta?.logo ? (
              <img src={logoUrl(meta.logo)} alt={meta.name} className="size-full object-contain p-1.5" />
            ) : (
              <span className="font-display text-lg font-bold text-white">{meta?.short}</span>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{meta?.name ?? service}</h1>
            <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} contas cadastradas</p>
          </div>
        </motion.div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setGrouped(true)}
              title="Agrupar por cliente"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                grouped ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" /> Por cliente
            </button>
            <button
              onClick={() => {
                setGrouped(false);
                setOpenClient(null);
              }}
              title="Lista completa"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                !grouped ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="size-3.5" /> Lista
            </button>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 sm:w-56"
            />
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Adicionar conta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
          {query ? "Nenhuma conta encontrada." : "Nenhuma conta cadastrada ainda."}
        </div>
      ) : grouped && activeGroup ? (
        (() => {
          const [, group] = activeGroup;
          const isNone = group.code == null;
          const list = group.list;
          const overdue = list.filter(isOverdue);
          const current = list.filter((a) => !isOverdue(a));
          return (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setOpenClient(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Clientes
                </button>
                <div
                  className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                    isNone ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary"
                  }`}
                >
                  {isNone ? <User className="size-4" /> : group.code}
                </div>
                <h2 className="font-display text-xl font-semibold">
                  {isNone ? "Sem cliente" : group.name || `Cliente #${group.code}`}
                </h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {list.length} {list.length === 1 ? "conta" : "contas"}
                </span>
              </div>

              {overdue.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="mb-2.5 flex items-center gap-2 text-[#ff6b35]">
                    <AlertTriangle className="size-4" />
                    <h3 className="font-display text-base font-semibold">
                      Vencidas ({overdue.length})
                    </h3>
                  </div>
                  <div className="rounded-2xl ring-1 ring-[#ff6b35]/30">
                    <AccountTable
                      accounts={overdue}
                      onEdit={(a) => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                      onRenew={(a) => renew.mutate(a.id)}
                      onDelete={handleDelete}
                      renewingId={renew.isPending ? renew.variables : null}
                      pix={pix}
                    />
                  </div>
                </motion.section>
              )}

              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <h3 className="mb-2.5 font-display text-base font-semibold text-muted-foreground">
                  Em dia ({current.length})
                </h3>
                {current.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    Nenhuma conta em dia.
                  </div>
                ) : (
                  <AccountTable
                    accounts={current}
                    onEdit={(a) => {
                      setEditing(a);
                      setFormOpen(true);
                    }}
                    onRenew={(a) => renew.mutate(a.id)}
                    onDelete={handleDelete}
                    renewingId={renew.isPending ? renew.variables : null}
                    pix={pix}
                  />
                )}
              </motion.section>
            </div>
          );
        })()
      ) : grouped ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(([key, group], i) => {
            const isNone = group.code == null;
            const list = group.list;
            const dueCount = list.filter(isOverdue).length;
            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setOpenClient(key)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/20"
              >
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                    isNone ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary"
                  }`}
                >
                  {isNone ? <User className="size-5" /> : group.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold">
                    {isNone ? "Sem cliente" : group.name || `Cliente #${group.code}`}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {list.length} {list.length === 1 ? "conta" : "contas"}
                    </span>
                    {dueCount > 0 && (
                      <span className="rounded-full bg-[#ff6b35]/15 px-2 py-0.5 text-xs font-medium text-[#ff6b35]">
                        {dueCount} vencida{dueCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
      ) : (
        <AccountTable
          accounts={filtered}
          onEdit={(a) => {
            setEditing(a);
            setFormOpen(true);
          }}
          onRenew={(a) => renew.mutate(a.id)}
          onDelete={handleDelete}
          renewingId={renew.isPending ? renew.variables : null}
          pix={pix}
        />
      )}

      <AccountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        submitting={create.isPending || update.isPending}
        initial={editing}
        defaultService={service}
      />
    </Layout>
  );
}
