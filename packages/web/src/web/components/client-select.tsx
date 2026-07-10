import { useState, useMemo } from "react";
import { Check, ChevronDown, Plus, Search, User, Loader2 } from "lucide-react";
import { useClients, useCreateClient, type Client } from "../lib/clients";
import { toast } from "sonner";

interface Props {
  value: string | null; // clientId
  onChange: (client: Client | null) => void;
  allowNone?: boolean; // permite "sem cliente" (usado no estoque)
  noneLabel?: string;
}

/** Seletor de cliente: busca, escolhe existente ou cria um novo na hora. */
export function ClientSelect({ value, onChange, allowNone, noneLabel = "Sem cliente (estoque)" }: Props) {
  const { data: clients } = useClients();
  const createClient = useCreateClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = clients?.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(term) || String(c.code).includes(term),
    );
  }, [clients, q]);

  async function createNew() {
    const name = q.trim();
    if (!name) {
      toast.error("Digite o nome do cliente");
      return;
    }
    try {
      const c = await createClient.mutateAsync({ name });
      toast.success(`Cliente #${c.code} ${c.name} criado`);
      onChange(c);
      setOpen(false);
      setQ("");
    } catch {
      toast.error("Falha ao criar cliente");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-secondary/60 px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {selected ? (
          <>
            <span className="flex size-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary tabular-nums">
              {selected.code}
            </span>
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">
            {allowNone ? noneLabel : "Selecione um cliente"}
          </span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou código…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="flex size-5 items-center justify-center rounded bg-secondary text-muted-foreground">
                    <User className="size-3" />
                  </span>
                  <span className="flex-1 text-muted-foreground">{noneLabel}</span>
                  {value === null && <Check className="size-4 text-primary" />}
                </button>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="flex size-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary tabular-nums">
                    {c.code}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.accountsCount} conta(s)</span>
                  {value === c.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
              {filtered.length === 0 && !q.trim() && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum cliente ainda.</div>
              )}
            </div>
            {q.trim() && (
              <button
                type="button"
                onClick={createNew}
                disabled={createClient.isPending}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/10"
              >
                {createClient.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Criar cliente "{q.trim()}"
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
