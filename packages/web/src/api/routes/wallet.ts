import { Hono } from "hono";
import { db } from "../database";
import { accounts, transactions } from "../database/schema";
import { desc, gte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { isDue, todayISO } from "../lib/dates";

/** Retorna a data ISO (YYYY-MM-DD) de N dias atrás a partir de hoje. */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const walletRoute = new Hono()
  .use("*", requireAuth)
  // Visão geral da carteira.
  // ?period=7|15|30 (dias) para o total de entradas do período. Default 30.
  .get("/", async (c) => {
    const periodRaw = Number(c.req.query("period") ?? "30");
    const period = [7, 15, 30].includes(periodRaw) ? periodRaw : 30;

    const allAccounts = await db.select().from(accounts);
    // contas "vendidas" = atribuídas a um cliente e não canceladas
    const sold = allAccounts.filter((a) => a.status !== "cancelada" && a.clientId);

    // Faturamento mensal recorrente: soma do valor de todas as contas vendidas ativas.
    const monthlyRecurringCents = sold.reduce((s, a) => s + (a.priceCents ?? 0), 0);

    // Aba "Em dia / renovadas": contas vendidas cujo vencimento ainda não passou.
    const paidUp = sold.filter((a) => !isDue(a.dueDate));
    const paidUpCents = paidUp.reduce((s, a) => s + (a.priceCents ?? 0), 0);

    // Aba "A receber": contas vencidas (dueDate <= hoje) — dinheiro pendente.
    const toReceive = sold.filter((a) => isDue(a.dueDate));
    const toReceiveCents = toReceive.reduce((s, a) => s + (a.priceCents ?? 0), 0);

    // Entradas reais (livro de transações) do período selecionado.
    const since = daysAgoISO(period - 1); // inclui hoje
    const periodTx = await db
      .select()
      .from(transactions)
      .where(gte(transactions.paidOn, since))
      .orderBy(desc(transactions.paidOn));
    const periodIncomeCents = periodTx.reduce((s, t) => s + (t.amountCents ?? 0), 0);
    const periodSalesCents = periodTx
      .filter((t) => t.kind === "venda")
      .reduce((s, t) => s + (t.amountCents ?? 0), 0);
    const periodRenewalsCents = periodTx
      .filter((t) => t.kind === "renovacao")
      .reduce((s, t) => s + (t.amountCents ?? 0), 0);

    return c.json(
      {
        period,
        today: todayISO(),
        monthlyRecurringCents,
        soldCount: sold.length,
        paidUp: { count: paidUp.length, totalCents: paidUpCents },
        toReceive: { count: toReceive.length, totalCents: toReceiveCents },
        periodIncome: {
          totalCents: periodIncomeCents,
          salesCents: periodSalesCents,
          renewalsCents: periodRenewalsCents,
          count: periodTx.length,
        },
      },
      200,
    );
  })
  // Lista as contas por aba: ?tab=paid_up | to_receive | sold
  .get("/accounts", async (c) => {
    const tab = c.req.query("tab") ?? "sold";
    const allAccounts = await db.select().from(accounts).orderBy(desc(accounts.dueDate));
    const sold = allAccounts.filter((a) => a.status !== "cancelada" && a.clientId);
    let rows = sold;
    if (tab === "paid_up") rows = sold.filter((a) => !isDue(a.dueDate));
    else if (tab === "to_receive") rows = sold.filter((a) => isDue(a.dueDate));
    return c.json({ accounts: rows }, 200);
  })
  // Extrato de transações do período: ?period=7|15|30
  .get("/transactions", async (c) => {
    const periodRaw = Number(c.req.query("period") ?? "30");
    const period = [7, 15, 30].includes(periodRaw) ? periodRaw : 30;
    const since = daysAgoISO(period - 1);
    const rows = await db
      .select()
      .from(transactions)
      .where(gte(transactions.paidOn, since))
      .orderBy(desc(transactions.paidOn));
    return c.json({ transactions: rows, period }, 200);
  });
