import { STATUS_MAP, PLAN_TYPE_MAP } from "../../shared/services";

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_MAP[status] ?? { label: status, color: "#8a92a6" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

export function PlanTypeBadge({ planType }: { planType: string }) {
  const meta = PLAN_TYPE_MAP[planType] ?? { label: planType || "Padrão", color: "#8a92a6" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}
