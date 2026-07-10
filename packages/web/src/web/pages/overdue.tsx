import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Loader2, ChevronDown, ChevronRight, MessageCircle, RefreshCw, Users, List, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { AccountTable } from "../components/account-table";
import { AccountForm } from "../components/account-form";
import { buildBulkWhatsappLink, buildBulkChargeMessage } from "../lib/charge";
import {
  useOverdue,
  useUpdateAccount,
  useRenewAccount,
  useDeleteAccount,
  usePixInfo,
  type Account,
  type AccountInput,
} from "../lib/accounts";

interface ClientGroup {
  key: string;
  clientName: string;
  whatsapp: string;
  accounts: Account[];
}

function groupByClient(accounts: Account[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>();
  for (const a of accounts) {
    // agrupa por clientId quando existe; senão por nome+whatsapp (contas avulsas sem cliente cadastrado)
    const key = a.clientId || `${a.client}|${a.whatsapp}` || a.id;
    if (!map.has(key)) {
      map.set(key, { key, clientName: a.client || "Sem nome", whatsapp: a.whatsapp, accounts: [] });
    }
    map.get(key)!.accounts.push(a);
  }
  // clientes com mais contas vencidas primeiro
  return Array.from(map.values()).sort((a, b) => b.accounts.length - a.accounts.length);
}

function ClientGroupCard({
  group,
  pix,
  onEdit,
  onRenew,
  onDelete,
  renewingId,
  renewingAll,
  onRenewAll,
}: {
  group: ClientGroup;
  pix: { pixKey: string; pixName: string };
  onEdit: (a: Account) => void;
  onRenew: (a: Account) => void;
  onDelete: (a: Account) => void;
  renewingId?: string | null;
  renewingAll: string | null;
  onRenewAll: (group: ClientGroup) => void;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const hasPhone = Boolean((group.whatsapp || "").replace(/\D/g, ""));

  function chargeAll() {
    const link = buildBulkWhatsappLink(group.accounts, pix);
    if (!link) {
      toast.error("Cadastre o WhatsApp deste cliente para cobrar.");
      return;
    }
    window.open(link, "_blank", "noopener");
  }

  async function copyAll() {
    const text = buildBulkChargeMessage(group.accounts, pix);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensagem copiada — cole onde quiser enviar");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/30"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <Users className="size-4 shrink-0 text-[#ff6b35]" />
          <span className="truncate font-display font-semibold">{group.clientName}</span>
          <span className="shrink-0 rounded-full bg-[#ff6b35]/15 px-2 py-0.5 text-xs font-medium text-[#ff6b35]">
            {group.accounts.length} {group.accounts.length === 1 ? "conta vencida" : "contas vencidas"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRenewAll(group)}
            disabled={renewingAll === group.key}
            title="Renovar todas as contas deste cliente"
          >
            {renewingAll === group.key ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Renovar todas
          </Button>
          <button
            onClick={chargeAll}
            disabled={!hasPhone}
            title={hasPhone ? "Enviar cobrança de todas as contas no WhatsApp" : "Sem WhatsApp cadastrado"}
            className="flex items-center gap-1.5 rounded-md bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/25 disabled:opacity-40"
          >
            <MessageCircle className="size-3.5" />
            Cobrar todas
          </button>
          <button
            onClick={copyAll}
            title="Copiar mensagem de cobrança para enviar manualmente"
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
          >
            {copied ? <Check className="size-3.5 text-[#2fbf71]" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar mensagem"}
          </button>
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <AccountTable
            accounts={group.accounts}
            showService
            onEdit={onEdit}
            onRenew={onRenew}
            onDelete={onDelete}
            renewingId={renewingId}
            pix={pix}
          />
        </div>
      )}
    </div>
  );
}

export default function OverduePage() {
  const { data: accounts, isLoading } = useOverdue();
  const update = useUpdateAccount();
  const renew = useRenewAccount();
  const del = useDeleteAccount();
  const { data: pix } = usePixInfo();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [viewMode, setViewMode] = useState<"cliente" | "lista">("cliente");
  const [renewingAll, setRenewingAll] = useState<string | null>(null);

  const pixInfo = pix ?? { pixKey: "", pixName: "" };
  const groups = useMemo(() => groupByClient(accounts ?? []), [accounts]);

  function handleSubmit(input: AccountInput) {
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess: () => setFormOpen(false) });
  }

  function handleDelete(a: Account) {
    if (confirm(`Excluir a conta de ${a.client || a.email}?`)) del.mutate(a.id);
  }

  async function handleRenewAll(group: ClientGroup) {
    setRenewingAll(group.key);
    try {
      for (const a of group.accounts) {
        await renew.mutateAsync(a.id);
      }
      toast.success(`${group.accounts.length} conta(s) de ${group.clientName} renovada(s)`);
    } catch {
      toast.error("Falha ao renovar uma ou mais contas. Tente novamente.");
    } finally {
      setRenewingAll(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 font-display text-3xl font-bold"
          >
            <AlertTriangle className="size-7 text-[#ff6b35]" />
            Contas Vencidas
          </motion.h1>
          <p className="mt-1 text-muted-foreground">
            Contas com vencimento até hoje. Clique em "Renovou" quando o cliente renovar.
          </p>
        </div>
        {(accounts?.length ?? 0) > 0 && (
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode("cliente")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "cliente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-4" />
              Por cliente
            </button>
            <button
              onClick={() => setViewMode("lista")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" />
              Lista única
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (accounts?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="mb-2 text-4xl">🎉</div>
          <p className="text-muted-foreground">Nenhuma conta vencida. Tudo em dia!</p>
        </div>
      ) : viewMode === "cliente" ? (
        <div>
          {groups.map((group) => (
            <ClientGroupCard
              key={group.key}
              group={group}
              pix={pixInfo}
              onEdit={(a) => {
                setEditing(a);
                setFormOpen(true);
              }}
              onRenew={(a) => renew.mutate(a.id)}
              onDelete={handleDelete}
              renewingId={renew.isPending ? renew.variables : null}
              renewingAll={renewingAll}
              onRenewAll={handleRenewAll}
            />
          ))}
        </div>
      ) : (
        <AccountTable
          accounts={accounts ?? []}
          showService
          onEdit={(a) => {
            setEditing(a);
            setFormOpen(true);
          }}
          onRenew={(a) => renew.mutate(a.id)}
          onDelete={handleDelete}
          renewingId={renew.isPending ? renew.variables : null}
          pix={pixInfo}
        />
      )}

      <AccountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        submitting={update.isPending}
        initial={editing}
      />
    </Layout>
  );
}
