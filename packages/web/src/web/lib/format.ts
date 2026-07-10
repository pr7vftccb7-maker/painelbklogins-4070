/** Formata YYYY-MM-DD para DD/MM/YYYY */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDue(dueDate: string): boolean {
  return dueDate <= todayISO();
}

/**
 * Avança a data em N meses mantendo o dia (com clamp no último dia do mês).
 * Ex: 2026-06-30 -> 2026-07-30.
 */
export function addMonthsKeepDay(iso: string, months = 1): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Dias restantes até o vencimento (negativo = vencido há X dias) */
export function daysUntil(dueDate: string): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** Formata centavos para R$ 25,00 */
export function formatPrice(cents: number): string {
  if (!cents) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte "25,00" ou "25.00" ou "25" em centavos */
export function parsePriceToCents(input: string): number {
  if (!input) return 0;
  const normalized = input.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Só dígitos do telefone (para o link wa.me) */
export function sanitizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}
