import { useState, useEffect } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Eye, EyeOff } from "lucide-react";
import { STATUSES, PLAN_TYPES } from "../../shared/services";
import { useServices } from "../lib/services";
import { ClientSelect } from "./client-select";
import type { Account, AccountInput } from "../lib/accounts";
import { todayISO, formatPrice, parsePriceToCents } from "../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AccountInput) => void;
  submitting?: boolean;
  initial?: Account | null;
  defaultService?: string;
}

const empty = (service: string): AccountInput => ({
  service,
  email: "",
  password: "",
  client: "",
  clientId: null,
  clientCode: null,
  whatsapp: "",
  priceCents: 0,
  dueDate: todayISO(),
  extraScreens: 0,
  extraScreenEmail1: "",
  extraScreenEmail2: "",
  paymentMethod: "",
  planType: "padrao",
  status: "ativa",
  notes: "",
});

const fieldClass = "flex flex-col gap-1.5";
const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-secondary/60 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]";

export function AccountForm({ open, onClose, onSubmit, submitting, initial, defaultService }: Props) {
  const { data: services } = useServices();
  const [form, setForm] = useState<AccountInput>(empty(defaultService ?? "netflix"));
  const [showPw, setShowPw] = useState(false);
  const [priceText, setPriceText] = useState("");

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          service: initial.service,
          email: initial.email,
          password: initial.password,
          client: initial.client,
          clientId: initial.clientId,
          clientCode: initial.clientCode,
          whatsapp: initial.whatsapp,
          priceCents: initial.priceCents,
          dueDate: initial.dueDate,
          extraScreens: initial.extraScreens,
          extraScreenEmail1: initial.extraScreenEmail1 ?? "",
          extraScreenEmail2: initial.extraScreenEmail2 ?? "",
          paymentMethod: initial.paymentMethod,
          planType: initial.planType ?? "padrao",
          status: initial.status,
          notes: initial.notes,
        });
        setPriceText(initial.priceCents ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : "");
      } else {
        setForm(empty(defaultService ?? "netflix"));
        setPriceText("");
      }
      setShowPw(false);
    }
  }, [open, initial, defaultService]);

  const set = <K extends keyof AccountInput>(k: K, v: AccountInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar conta" : "Adicionar conta"}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={submitting || !form.dueDate}
          >
            {submitting ? "Salvando…" : initial ? "Salvar" : "Adicionar"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className={fieldClass}>
          <Label>Serviço</Label>
          <select className={selectClass} value={form.service} onChange={(e) => set("service", e.target.value)}>
            {(services ?? []).map((s) => (
              <option key={s.slug} value={s.slug} className="bg-card">
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldClass}>
          <Label>Cliente</Label>
          <ClientSelect
            value={form.clientId ?? null}
            onChange={(c) =>
              setForm((f) => ({
                ...f,
                clientId: c?.id ?? null,
                clientCode: c?.code ?? null,
                client: c?.name ?? "",
                whatsapp: c?.whatsapp || f.whatsapp,
              }))
            }
          />
        </div>
        <div className={fieldClass}>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
        </div>
        <div className={fieldClass}>
          <Label>Senha</Label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className={fieldClass}>
          <Label>Data de vencimento</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
        <div className={fieldClass}>
          <Label>Tipo de plano</Label>
          <select className={selectClass} value={form.planType} onChange={(e) => set("planType", e.target.value)}>
            {PLAN_TYPES.map((p) => (
              <option key={p.value} value={p.value} className="bg-card">
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className={`${fieldClass} col-span-2`}>
          <Label>Telas extra (emails)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={form.extraScreenEmail1}
              onChange={(e) => set("extraScreenEmail1", e.target.value)}
              placeholder="Email da tela extra 1"
            />
            <Input
              value={form.extraScreenEmail2}
              onChange={(e) => set("extraScreenEmail2", e.target.value)}
              placeholder="Email da tela extra 2"
            />
          </div>
        </div>
        <div className={fieldClass}>
          <Label>Forma de pagamento</Label>
          <Input
            value={form.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value)}
            placeholder="Pix, Cartão, Boleto…"
          />
        </div>
        <div className={fieldClass}>
          <Label>WhatsApp do cliente</Label>
          <Input
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
        </div>
        <div className={fieldClass}>
          <Label>Valor da assinatura</Label>
          <Input
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
              set("priceCents", parsePriceToCents(e.target.value));
            }}
            placeholder="R$ 25,00"
            inputMode="decimal"
          />
          {form.priceCents > 0 && (
            <span className="text-xs text-muted-foreground">{formatPrice(form.priceCents)}</span>
          )}
        </div>
        <div className={fieldClass}>
          <Label>Status</Label>
          <select className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-card">
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className={`${fieldClass} col-span-2`}>
          <Label>Observações</Label>
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" />
        </div>
      </div>
    </Modal>
  );
}
