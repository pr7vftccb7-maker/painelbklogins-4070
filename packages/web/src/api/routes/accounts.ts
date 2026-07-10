import { Hono } from "hono";
import { db } from "../database";
import { accounts, stockAccounts, transactions } from "../database/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { addMonthsKeepDay, isDue, todayISO } from "../lib/dates";

// Status que fazem a conta sair do serviço e voltar pro estoque.
// cancelada -> volta disponível pra reuso. caida/atualizar_pagamento -> card "com problema".
const RETURN_STATUSES = ["cancelada", "caida", "atualizar_pagamento"] as const;
type ReturnStatus = (typeof RETURN_STATUSES)[number];
function isReturnStatus(s: string): s is ReturnStatus {
  return (RETURN_STATUSES as readonly string[]).includes(s);
}

/**
 * Move uma conta do serviço de volta ao estoque, marcando o motivo.
 * - cancelada  -> status "disponivel" (pode ser reusada)
 * - caida / atualizar_pagamento -> status "problema"
 * A conta original é removida do serviço. Retorna o id do registro criado no estoque.
 */
async function returnAccountToStock(accountId: string, reason: ReturnStatus) {
  const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!acc) return null;

  const stockStatus = reason === "cancelada" ? "disponivel" : "problema";
  // evita duplicar o mesmo email/serviço no estoque
  const existing = await db
    .select()
    .from(stockAccounts)
    .where(and(eq(stockAccounts.service, acc.service), eq(stockAccounts.email, acc.email)));

  if (existing.length > 0) {
    await db
      .update(stockAccounts)
      .set({ password: acc.password, status: stockStatus, problemType: reason, notes: acc.notes })
      .where(eq(stockAccounts.id, existing[0].id));
  } else {
    await db.insert(stockAccounts).values({
      service: acc.service,
      email: acc.email,
      password: acc.password,
      notes: acc.notes,
      status: stockStatus,
      problemType: reason,
    });
  }
  await db.delete(accounts).where(eq(accounts.id, accountId));
  return true;
}

export const accountsRoute = new Hono()
  .use("*", requireAuth)
  // Lista todas as contas (opcional: filtrar por serviço via ?service=)
  .get("/", async (c) => {
    const service = c.req.query("service");
    const rows = service
      ? await db.select().from(accounts).where(eq(accounts.service, service)).orderBy(desc(accounts.createdAt))
      : await db.select().from(accounts).orderBy(desc(accounts.createdAt));
    return c.json({ accounts: rows }, 200);
  })
  // Resumo: contagem por serviço e contagem de vencidas
  .get("/summary", async (c) => {
    const rows = await db.select().from(accounts);
    const byService: Record<string, { total: number; due: number }> = {};
    let dueTotal = 0;
    for (const r of rows) {
      if (!byService[r.service]) byService[r.service] = { total: 0, due: 0 };
      byService[r.service].total++;
      const due = r.status !== "cancelada" && isDue(r.dueDate);
      if (due) {
        byService[r.service].due++;
        dueTotal++;
      }
    }
    return c.json({ byService, dueTotal }, 200);
  })
  // Lista contas vencidas (dueDate <= hoje e não cancelada)
  .get("/overdue", async (c) => {
    const rows = await db.select().from(accounts).orderBy(desc(accounts.dueDate));
    const overdue = rows.filter((r) => r.status !== "cancelada" && isDue(r.dueDate));
    return c.json({ accounts: overdue }, 200);
  })
  // Cria conta
  .post("/", async (c) => {
    const body = await c.req.json();
    const extraScreenEmail1 = (body.extraScreenEmail1 ?? "").toString().trim();
    const extraScreenEmail2 = (body.extraScreenEmail2 ?? "").toString().trim();
    const extraScreens = [extraScreenEmail1, extraScreenEmail2].filter(Boolean).length;
    const [row] = await db
      .insert(accounts)
      .values({
        service: body.service,
        email: body.email ?? "",
        password: body.password ?? "",
        client: body.client ?? "",
        clientId: body.clientId ?? null,
        clientCode: body.clientCode ?? null,
        whatsapp: body.whatsapp ?? "",
        priceCents: body.priceCents ?? 0,
        dueDate: body.dueDate,
        extraScreens,
        extraScreenEmail1,
        extraScreenEmail2,
        paymentMethod: body.paymentMethod ?? "",
        planType: body.planType ?? "padrao",
        status: body.status ?? "ativa",
        notes: body.notes ?? "",
      })
      .returning();
    return c.json({ account: row }, 201);
  })
  // Atualiza conta
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    // Se o status mudou pra cancelada/caída/atualizar_pagamento, a conta volta pro estoque.
    if (isReturnStatus(body.status)) {
      // grava eventual alteração de senha/notes antes de mover
      await db
        .update(accounts)
        .set({ password: body.password, notes: body.notes, updatedAt: new Date() })
        .where(eq(accounts.id, id));
      const moved = await returnAccountToStock(id, body.status);
      if (!moved) return c.json({ message: "Conta não encontrada" }, 404);
      return c.json({ returnedToStock: true, reason: body.status }, 200);
    }
    const extraScreenEmail1 = (body.extraScreenEmail1 ?? "").toString().trim();
    const extraScreenEmail2 = (body.extraScreenEmail2 ?? "").toString().trim();
    const extraScreens = [extraScreenEmail1, extraScreenEmail2].filter(Boolean).length;
    const [row] = await db
      .update(accounts)
      .set({
        service: body.service,
        email: body.email,
        password: body.password,
        client: body.client,
        clientId: body.clientId ?? null,
        clientCode: body.clientCode ?? null,
        whatsapp: body.whatsapp,
        priceCents: body.priceCents,
        dueDate: body.dueDate,
        extraScreens,
        extraScreenEmail1,
        extraScreenEmail2,
        paymentMethod: body.paymentMethod,
        planType: body.planType ?? "padrao",
        status: body.status,
        notes: body.notes,
        notifiedDueAt: null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))
      .returning();
    return c.json({ account: row }, 200);
  })
  // Renova: avança 1 mês mantendo o dia, status volta pra ativa
  .post("/:id/renew", async (c) => {
    const id = c.req.param("id");
    const [current] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!current) return c.json({ message: "Conta não encontrada" }, 404);
    const newDue = addMonthsKeepDay(current.dueDate, 1);
    const [row] = await db
      .update(accounts)
      .set({ dueDate: newDue, status: "ativa", notifiedDueAt: null, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();

    // Registra a entrada de dinheiro (renovação) na carteira, se houve valor.
    if ((row.priceCents ?? 0) > 0) {
      await db.insert(transactions).values({
        kind: "renovacao",
        accountId: row.id,
        service: row.service,
        email: row.email,
        clientId: row.clientId ?? null,
        clientCode: row.clientCode ?? null,
        clientName: row.client ?? "",
        amountCents: row.priceCents ?? 0,
        paidOn: todayISO(),
      });
    }

    return c.json({ account: row }, 200);
  })
  // Atualiza somente o status
  .patch("/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    if (isReturnStatus(body.status)) {
      const moved = await returnAccountToStock(id, body.status);
      if (!moved) return c.json({ message: "Conta não encontrada" }, 404);
      return c.json({ returnedToStock: true, reason: body.status }, 200);
    }
    const [row] = await db
      .update(accounts)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return c.json({ account: row }, 200);
  })
  // Deleta conta
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(accounts).where(eq(accounts.id, id));
    return c.json({ ok: true }, 200);
  });
