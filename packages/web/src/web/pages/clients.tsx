import { useState } from "react";
import { Link } from "wouter";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Loader2, Search, Hash, ExternalLink } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, type Client } from "../lib/clients";

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const create = useCreateClient();
  const update = useUpdateClient();
  const del = useDeleteClient();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const filtered = (clients ?? []).filter((c) => {
    const t = query.trim().toLowerCase();
    if (!t) return true;
    return c.name.toLowerCase().includes(t) || String(c.code).includes(t);
  });

  function openNew() {
    setEditing(null);
    setName("");
    setCode("");
    setWhatsapp("");
    setOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setName(c.name);
    setCode(String(c.code));
    setWhatsapp(c.whatsapp);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: { name, code, whatsapp } });
        toast.success("Cliente atualizado");
      } else {
        const c = await create.mutateAsync({ name, code: code || undefined, whatsapp });
        toast.success(`Cliente #${c.code} criado`);
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  function remove(c: Client) {
    if (confirm(`Excluir o cliente #${c.code} ${c.name}? As contas dele ficarão sem cliente.`)) {
      del.mutate(c.id);
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
            <Users className="size-7 text-primary" />
            Clientes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-muted-foreground"
          >
            {clients?.length ?? 0} cliente(s). Cada um tem um código numérico único.
          </motion.p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nome ou código…"
              className="w-full pl-9 sm:w-56"
            />
          </div>
          <Button className="w-full sm:w-auto" onClick={openNew}>
            <Plus className="size-4" /> Novo cliente
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Users className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">{query ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
          {!query && (
            <Button className="mt-4" variant="outline" onClick={openNew}>
              <Plus className="size-4" /> Criar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Desktop */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Contas</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 font-mono text-xs font-bold text-primary tabular-nums">
                      <Hash className="size-3" />
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.whatsapp || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{c.accountsCount} conta(s)</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <div className="divide-y divide-border/60 md:hidden">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 font-mono text-sm font-bold text-primary tabular-nums">
                  {c.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.accountsCount} conta(s){c.whatsapp ? ` · ${c.whatsapp}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => openEdit(c)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar cliente #${editing.code}` : "Novo cliente"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Código {editing ? "" : "(opcional — automático se vazio)"}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Automático"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Número único que identifica o cliente. Deixe vazio para gerar automaticamente.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>WhatsApp (opcional)</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
