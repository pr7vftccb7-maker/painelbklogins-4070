/**
 * Utilitários de data no formato YYYY-MM-DD, sem depender de timezone.
 */

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Avança a data de vencimento em N meses mantendo o mesmo dia do mês.
 * Ex: 2026-06-30 -> 2026-07-30. Se o mês seguinte não tiver o dia
 * (ex: 31/01 -> fevereiro), usa o último dia do mês (clamp).
 */
export function addMonthsKeepDay(iso: string, months = 1): string {
  const [y, m, d] = iso.split("-").map(Number);
  // mês base 0-index
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // último dia do mês alvo
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** true se a data já venceu ou vence hoje (dueDate <= hoje) */
export function isDue(dueDate: string): boolean {
  return dueDate <= todayISO();
}
