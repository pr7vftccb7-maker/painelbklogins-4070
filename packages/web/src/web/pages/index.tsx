import { useState } from "react";
import { Link } from "wouter";
import { motion } from "motion/react";
import { AlertTriangle, Plus, Pencil, Trash2, Loader2, DatabaseBackup } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";
import { useSummary } from "../lib/accounts";
import { logoUrl } from "../lib/utils";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type Service,
} from "../lib/services";
import { toast } from "sonner";

const emptyForm = { name: "", color: "#e11d48", short: "", logo: "" };

export default function Index() {
  const { data: summary } = useSummary();
  const { data: services, isLoading } = useServices();
  const createMut = useCreateService();
  const updateMut = useUpdateService();
  const deleteMut = useDeleteService();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  async function runBackup() {
    setBackingUp(true);
    try {
      const res = await api.backup.run.$post();
      const body = await res.json();
      if (res.ok && "ok" in body && body.ok) {
        const dest: string[] = [];
        if ("telegram" in body && body.telegram?.ok) dest.push("Telegram");
        if ("email" in body && body.email?.ok) dest.push("email");
        const where = dest.length ? ` para ${dest.join(" e ")}` : "";
        toast.success(`Backup enviado${where} — ${body.rows} registros.`);
      } else {
        const err = "error" in body ? body.error : null;
        toast.error(err ?? "Falha ao gerar backup. Configure o Telegram ou o email nas Configurações.");
      }
    } catch {
      toast.error("Erro de conexão ao gerar backup.");
    }
    setBackingUp(false);
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(e: React.MouseEvent, svc: Service) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(svc);
    setForm({ name: svc.name, color: svc.color, short: svc.short, logo: svc.logo });
    setFormOpen(true);
  }

  function askDelete(e: React.MouseEvent, svc: Service) {
    e.preventDefault();
    e.stopPropagation();
    setToDelete(svc);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do serviço");
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...form });
        toast.success("Serviço atualizado");
      } else {
        await createMut.mutateAsync(form);
        toast.success("Serviço criado");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.id);
      toast.success("Serviço removido");
      setToDelete(null);
    } catch {
      toast.error("Erro ao remover");
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Layout>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl font-bold"
          >
            Serviços
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-muted-foreground"
          >
            Selecione um serviço para gerenciar as contas
          </motion.p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" onClick={runBackup} disabled={backingUp}>
            {backingUp ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}
            Backup
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo serviço
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {(services ?? []).map((svc, i) => {
            const stats = summary?.byService[svc.slug];
            const total = stats?.total ?? 0;
            const due = stats?.due ?? 0;
            return (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ease: "easeOut" }}
              >
                <Link href={`/servico/${svc.slug}`}>
                  <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-xl">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: svc.color }} />

                    {/* ações: editar / excluir */}
                    <div className="absolute right-2 top-3 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => openEdit(e, svc)}
                        className="flex size-7 items-center justify-center rounded-md bg-secondary/90 text-muted-foreground backdrop-blur transition-colors hover:bg-secondary hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={(e) => askDelete(e, svc)}
                        className="flex size-7 items-center justify-center rounded-md bg-secondary/90 text-muted-foreground backdrop-blur transition-colors hover:bg-destructive hover:text-white"
                        title="Excluir"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="mb-4 flex size-12 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
                      {svc.logo ? (
                        <img src={logoUrl(svc.logo)} alt={svc.name} className="size-full object-contain p-1.5" loading="lazy" />
                      ) : (
                        <span
                          className="flex size-full items-center justify-center text-sm font-bold text-white"
                          style={{ backgroundColor: svc.color }}
                        >
                          {svc.short || svc.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="font-display font-semibold leading-tight">{svc.name}</div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {total} {total === 1 ? "conta" : "contas"}
                      </span>
                      {due > 0 && (
                        <span className="flex items-center gap-1 font-medium text-[#ff6b35]">
                          <AlertTriangle className="size-3.5" />
                          {due}
                        </span>
                      )}
                    </div>
                    <div
                      className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30"
                      style={{ backgroundColor: svc.color }}
                    />
                  </div>
                </Link>
              </motion.div>
            );
          })}

          {/* card de adicionar */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={openCreate}
            className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-5 text-muted-foreground transition-all hover:-translate-y-1 hover:border-primary/50 hover:text-primary"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Novo serviço</span>
          </motion.button>
        </div>
      )}

      {/* modal criar/editar */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar serviço" : "Novo serviço"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: Max, Crunchyroll, Deezer…"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                />
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sigla (opcional)</Label>
              <Input
                value={form.short}
                onChange={(e) => set("short", e.target.value)}
                placeholder="Ex: MAX"
                maxLength={4}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>URL do logo (opcional)</Label>
            <Input
              value={form.logo}
              onChange={(e) => set("logo", e.target.value)}
              placeholder="https://… ou /logos/arquivo.png"
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para usar a cor + sigla como ícone.</p>
          </div>

          {/* preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
            <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
              {form.logo ? (
                <img src={form.logo} alt="preview" className="size-full object-contain p-1.5" />
              ) : (
                <span
                  className="flex size-full items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.short || form.name.slice(0, 2).toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div>
              <div className="font-display font-semibold leading-tight">{form.name || "Nome do serviço"}</div>
              <div className="text-xs text-muted-foreground">Prévia do card</div>
            </div>
          </div>
        </div>
      </Modal>

      {/* confirmar exclusão */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir serviço"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Remover o card <span className="font-medium text-foreground">{toDelete?.name}</span>? As contas já
          cadastradas não serão apagadas, mas o card deixará de aparecer.
        </p>
      </Modal>
    </Layout>
  );
}
