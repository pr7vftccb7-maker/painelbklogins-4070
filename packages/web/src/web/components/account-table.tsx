import { useState } from "react";
import { Eye, EyeOff, Copy, RefreshCw, Pencil, Trash2, Check, Monitor, CreditCard, MessageCircle } from "lucide-react";
import { StatusBadge, PlanTypeBadge } from "./status-badge";
import { formatDate, isDue, daysUntil } from "../lib/format";
import { SERVICE_MAP } from "../../shared/services";
import { useServiceMap } from "../lib/services";
import { logoUrl } from "../lib/utils";
import type { Account } from "../lib/accounts";
import { buildWhatsappLink, buildChargeMessage, type PixInfo } from "../lib/charge";
import { toast } from "sonner";

function ChargeButton({ a, pix }: { a: Account; pix: PixInfo }) {
  const hasPhone = Boolean((a.whatsapp || "").replace(/\D/g, ""));
  return (
    <button
      onClick={() => {
        const link = buildWhatsappLink(a, pix);
        if (!link) {
          toast.error("Cadastre o WhatsApp do cliente para cobrar.");
          return;
        }
        window.open(link, "_blank", "noopener");
      }}
      title={hasPhone ? "Cobrar no WhatsApp" : "Sem WhatsApp cadastrado"}
      className="flex items-center gap-1 rounded-md bg-[#25D366]/15 px-2 py-1.5 text-xs font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/25 disabled:opacity-40"
      disabled={!hasPhone}
    >
      <MessageCircle className="size-3.5" />
      Cobrar
    </button>
  );
}

function CopyChargeButton({ a, pix }: { a: Account; pix: PixInfo }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const text = buildChargeMessage(a, pix);
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Mensagem copiada — cole onde quiser enviar");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Não foi possível copiar. Tente novamente.");
        }
      }}
      title="Copiar mensagem de cobrança para enviar manualmente"
      className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
    >
      {copied ? <Check className="size-3.5 text-[#2fbf71]" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function PasswordCell({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs">{show ? value : "••••••••"}</span>
      <button onClick={() => setShow((v) => !v)} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-[#2fbf71]" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function DueLabel({ a }: { a: Account }) {
  if (a.status === "cancelada") return null;
  const due = isDue(a.dueDate);
  const d = daysUntil(a.dueDate);
  return (
    <span className={`text-xs ${due ? "text-[#ff6b35]" : d <= 3 ? "text-[#f5a524]" : "text-muted-foreground"}`}>
      {due ? (d === 0 ? "vence hoje" : `vencida há ${Math.abs(d)}d`) : `em ${d}d`}
    </span>
  );
}

interface Props {
  accounts: Account[];
  showService?: boolean;
  onEdit: (a: Account) => void;
  onRenew: (a: Account) => void;
  onDelete: (a: Account) => void;
  renewingId?: string | null;
  pix?: PixInfo;
}

function RenewButton({ a, onRenew, renewingId }: { a: Account; onRenew: (a: Account) => void; renewingId?: string | null }) {
  return (
    <button
      onClick={() => onRenew(a)}
      disabled={renewingId === a.id}
      title="Renovou — avança 1 mês"
      className="flex items-center gap-1 rounded-md bg-[#2fbf71]/15 px-2 py-1.5 text-xs font-medium text-[#2fbf71] transition-colors hover:bg-[#2fbf71]/25 disabled:opacity-50"
    >
      <RefreshCw className={`size-3.5 ${renewingId === a.id ? "animate-spin" : ""}`} />
      Renovou
    </button>
  );
}

function IconBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 text-muted-foreground transition-colors ${
        danger ? "hover:bg-destructive/15 hover:text-destructive" : "hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ServiceTag({ service }: { service: string }) {
  const dynamicMap = useServiceMap();
  const svc = dynamicMap[service] ?? SERVICE_MAP[service];
  return (
    <span className="inline-flex items-center gap-2">
      {svc?.logo ? (
        <span className="flex size-6 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
          <img src={logoUrl(svc.logo)} alt={svc.name} className="size-full object-contain p-0.5" />
        </span>
      ) : (
        <span
          className="flex size-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ backgroundColor: svc?.color ?? "#666" }}
        >
          {svc?.short}
        </span>
      )}
      <span className="font-medium">{svc?.name ?? service}</span>
    </span>
  );
}

function ExtraScreensCell({ a }: { a: Account }) {
  const emails = [a.extraScreenEmail1, a.extraScreenEmail2].filter(Boolean);
  if (emails.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5" title={emails.join("\n")}>
      <span className="tabular-nums">{emails.length}</span>
      {emails.map((e, i) => (
        <span key={i} className="max-w-[140px] truncate text-[11px] text-muted-foreground">
          {e}
        </span>
      ))}
    </div>
  );
}

export function AccountTable({ accounts, showService, onEdit, onRenew, onDelete, renewingId, pix }: Props) {
  const pixInfo: PixInfo = pix ?? { pixKey: "", pixName: "" };
  return (
    <>
      {/* Desktop / tablet: tabela */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {showService && <th className="px-3 py-3 font-medium">Serviço</th>}
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Senha</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Vencimento</th>
                <th className="px-3 py-3 text-center font-medium">Telas</th>
                <th className="px-3 py-3 font-medium">Pagamento</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-border transition-colors hover:bg-secondary/40">
                  {showService && (
                    <td className="px-3 py-3">
                      <ServiceTag service={a.service} />
                    </td>
                  )}
                  <td className="px-3 py-3">{a.email || "—"}</td>
                  <td className="px-3 py-3">
                    <PasswordCell value={a.password} />
                  </td>
                  <td className="px-3 py-3">{a.client || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="tabular-nums">{formatDate(a.dueDate)}</div>
                    <DueLabel a={a} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ExtraScreensCell a={a} />
                  </td>
                  <td className="px-3 py-3">{a.paymentMethod || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={a.status} />
                      <PlanTypeBadge planType={a.planType} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ChargeButton a={a} pix={pixInfo} />
                      <CopyChargeButton a={a} pix={pixInfo} />
                      <RenewButton a={a} onRenew={onRenew} renewingId={renewingId} />
                      <IconBtn onClick={() => onEdit(a)} title="Editar">
                        <Pencil className="size-4" />
                      </IconBtn>
                      <IconBtn onClick={() => onDelete(a)} title="Excluir" danger>
                        <Trash2 className="size-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                {showService && (
                  <div className="mb-1.5">
                    <ServiceTag service={a.service} />
                  </div>
                )}
                <div className="truncate font-medium">{a.client || "Sem nome"}</div>
                <div className="truncate text-sm text-muted-foreground">{a.email || "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={a.status} />
                <PlanTypeBadge planType={a.planType} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Senha</div>
                <PasswordCell value={a.password} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Vencimento</div>
                <div className="tabular-nums">{formatDate(a.dueDate)}</div>
                <DueLabel a={a} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Pagamento</div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-muted-foreground" />
                  {a.paymentMethod || "—"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Telas extra</div>
                {a.extraScreenEmail1 || a.extraScreenEmail2 ? (
                  <div className="flex flex-col gap-0.5">
                    {[a.extraScreenEmail1, a.extraScreenEmail2].filter(Boolean).map((e, i) => (
                      <div key={i} className="flex items-center gap-1.5 truncate">
                        <Monitor className="size-3.5 shrink-0 text-muted-foreground" />
                        {e}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Monitor className="size-3.5" />—
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <RenewButton a={a} onRenew={onRenew} renewingId={renewingId} />
              <ChargeButton a={a} pix={pixInfo} />
              <CopyChargeButton a={a} pix={pixInfo} />
              <div className="flex-1" />
              <IconBtn onClick={() => onEdit(a)} title="Editar">
                <Pencil className="size-4" />
              </IconBtn>
              <IconBtn onClick={() => onDelete(a)} title="Excluir" danger>
                <Trash2 className="size-4" />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
