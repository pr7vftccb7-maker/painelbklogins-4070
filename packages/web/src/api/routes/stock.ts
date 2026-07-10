import { Hono } from "hono";
import { db } from "../database";
import { stockAccounts, accounts, clients, transactions } from "../database/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { addMonthsKeepDay } from "../lib/dates";

/**
 * Faz o parse de uma lista colada de contas.
 * Aceita separadores por linha: email:senha, email;senha, email senha, email,senha ou tab.
 * Ignora linhas vazias e cabeçalhos óbvios.
 */
function parseList(raw: string): { email: string; password: string }[] {
  const out: { email: string; password: string }[] = [];
  const lines = (raw || "").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // separadores mais comuns primeiro
    const parts = t.split(/\s*[:;,\t|]\s*|\s{2,}|\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    const email = parts[0].trim();
    const password = (parts[1] ?? "").trim();
    if (!email.includes("@")) continue; // precisa ser um email válido básico
    out.push({ email, password });
  }
  return out;
}

export const stockRoute = new Hono()
  .use("*", requireAuth)
  // Lista o estoque (opcional: ?service= e ?status=)
  .get("/", async (c) => {
    const service = c.req.query("service");
    const status = c.req.query("status");
    const conds = [];
    if (service) conds.push(eq(stockAccounts.service, service));
    if (status) conds.push(eq(stockAccounts.status, status));
    const rows = conds.length
      ? await db
          .select()
          .from(stockAccounts)
          .where(conds.length === 1 ? conds[0] : and(...conds))
          .orderBy(desc(stockAccounts.createdAt))
      : await db.select().from(stockAccounts).orderBy(desc(stockAccounts.createdAt));

    // Descobre qual cliente está usando cada conta "usada" cruzando por serviço + email
    // com as contas reais (subscription_accounts).
    const usedRows = rows.filter((r) => r.status === "usada");
    let enriched = rows as (typeof rows[number] & { clientName?: string | null; clientCode?: number | null })[];
    if (usedRows.length > 0) {
      const real = await db.select().from(accounts);
      const map = new Map<string, { name: string; code: number | null }>();
      for (const a of real) {
        map.set(`${a.service}::${a.email.toLowerCase()}`, { name: a.client, code: a.clientCode });
      }
      enriched = rows.map((r) => {
        if (r.status !== "usada") return r;
        const hit = map.get(`${r.service}::${r.email.toLowerCase()}`);
        return { ...r, clientName: hit?.name ?? null, clientCode: hit?.code ?? null };
      });
    }
    return c.json({ stock: enriched }, 200);
  })
  // Resumo: contagem de disponíveis, com problema e virgens por serviço
  .get("/summary", async (c) => {
    const rows = await db.select().from(stockAccounts);
    const byService: Record<string, { total: number; available: number; problem: number; virgin: number }> = {};
    let availableTotal = 0;
    let problemTotal = 0;
    let virginTotal = 0;
    for (const r of rows) {
      if (!byService[r.service]) byService[r.service] = { total: 0, available: 0, problem: 0, virgin: 0 };
      byService[r.service].total++;
      if (r.status === "disponivel") {
        byService[r.service].available++;
        availableTotal++;
      } else if (r.status === "problema") {
        byService[r.service].problem++;
        problemTotal++;
      } else if (r.status === "virgem") {
        byService[r.service].virgin++;
        virginTotal++;
      }
    }
    return c.json({ byService, availableTotal, problemTotal, virginTotal }, 200);
  })
  // Importação em massa: { service, list, clientId?, virgin? }
  // -> se clientId informado, cria contas reais vinculadas ao cliente (aparecem no serviço)
  // -> se virgin, entra no estoque como "virgem" (email sem assinatura ainda)
  // -> senão, entra no estoque como disponível
  .post("/import", async (c) => {
    const body = await c.req.json();
    const service: string = body.service;
    if (!service) return c.json({ message: "Serviço obrigatório" }, 400);
    const clientId: string = (body.clientId ?? "").trim();
    const virgin: boolean = Boolean(body.virgin);
    const parsed = parseList(body.list ?? "");
    if (parsed.length === 0) return c.json({ message: "Nenhuma conta válida encontrada", added: 0, skipped: 0 }, 200);

    // Com cliente: cria contas reais no serviço.
    if (clientId) {
      const [cli] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!cli) return c.json({ message: "Cliente não encontrado" }, 404);
      const today = new Date().toISOString().slice(0, 10);
      const dueDate = addMonthsKeepDay(today, 1);
      const rows = parsed.map((p) => ({
        service,
        email: p.email,
        password: p.password,
        client: cli.name,
        clientId: cli.id,
        clientCode: cli.code,
        whatsapp: cli.whatsapp,
        dueDate,
        status: "ativa" as const,
      }));
      await db.insert(accounts).values(rows);
      return c.json({ added: rows.length, skipped: 0, total: parsed.length, target: "accounts" }, 201);
    }

    // Sem cliente: entra no estoque (evita duplicar por email no mesmo serviço)
    const existing = await db.select().from(stockAccounts).where(eq(stockAccounts.service, service));
    const seen = new Set(existing.map((e) => e.email.toLowerCase()));

    const toInsert: { service: string; email: string; password: string; status: string }[] = [];
    let skipped = 0;
    for (const p of parsed) {
      const key = p.email.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      toInsert.push({ service, email: p.email, password: p.password, status: virgin ? "virgem" : "disponivel" });
    }

    if (toInsert.length > 0) {
      await db.insert(stockAccounts).values(toInsert);
    }
    return c.json({ added: toInsert.length, skipped, total: parsed.length, target: virgin ? "virgin" : "stock" }, 201);
  })
  // Adiciona uma conta manual ao estoque
  .post("/", async (c) => {
    const body = await c.req.json();
    if (!body.service || !body.email) return c.json({ message: "Serviço e email obrigatórios" }, 400);
    const [row] = await db
      .insert(stockAccounts)
      .values({
        service: body.service,
        email: body.email,
        password: body.password ?? "",
        notes: body.notes ?? "",
      })
      .returning();
    return c.json({ stock: row }, 201);
  })
  // Atualiza uma conta do estoque
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const [row] = await db
      .update(stockAccounts)
      .set({
        service: body.service,
        email: body.email,
        password: body.password,
        notes: body.notes,
        status: body.status,
      })
      .where(eq(stockAccounts.id, id))
      .returning();
    return c.json({ stock: row }, 200);
  })
  // Marca um email virgem como assinado: vira "disponivel" no estoque normal.
  // Opcionalmente atualiza a senha (ex: senha definida na hora de assinar).
  .post("/:id/activate", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const [current] = await db.select().from(stockAccounts).where(eq(stockAccounts.id, id));
    if (!current) return c.json({ message: "Conta não encontrada" }, 404);
    if (current.status !== "virgem") {
      return c.json({ message: "Esta conta não está marcada como virgem" }, 400);
    }
    const password = (body.password ?? "").toString().trim();
    const [row] = await db
      .update(stockAccounts)
      .set({ status: "disponivel", password: password || current.password, problemType: null })
      .where(eq(stockAccounts.id, id))
      .returning();
    return c.json({ stock: row }, 200);
  })
  // Muda apenas o status de uma conta do estoque.
  // status: disponivel | usada | problema | virgem. Quando "problema", requer problemType.
  // Ao voltar pra disponivel/usada, limpa o motivo.
  .patch("/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const status: string = body.status;
    if (!["disponivel", "usada", "problema", "virgem"].includes(status)) {
      return c.json({ message: "Status inválido" }, 400);
    }
    let problemType: string | null = null;
    if (status === "problema") {
      const pt: string = body.problemType ?? "";
      if (!["cancelada", "caida", "atualizar_pagamento"].includes(pt)) {
        return c.json({ message: "Motivo do problema inválido" }, 400);
      }
      problemType = pt;
    }
    // Pega a conta do estoque antes de mudar (para saber serviço/email).
    const [current] = await db.select().from(stockAccounts).where(eq(stockAccounts.id, id));
    if (!current) return c.json({ message: "Conta não encontrada" }, 404);

    const [row] = await db
      .update(stockAccounts)
      .set({ status, problemType })
      .where(eq(stockAccounts.id, id))
      .returning();
    if (!row) return c.json({ message: "Conta não encontrada" }, 404);

    // Ao voltar pra "disponivel", desvincula do cliente: remove a conta real
    // (mesmo serviço + email) que estava no nome de algum cliente.
    let unlinked = 0;
    if (status === "disponivel") {
      const deleted = await db
        .delete(accounts)
        .where(and(eq(accounts.service, current.service), eq(accounts.email, current.email)))
        .returning();
      unlinked = deleted.length;
    }

    return c.json({ stock: row, unlinked }, 200);
  })
  // Converte uma conta do estoque em conta de cliente ativa.
  // Marca a do estoque como "usada".
  .post("/:id/assign", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const [stock] = await db.select().from(stockAccounts).where(eq(stockAccounts.id, id));
    if (!stock) return c.json({ message: "Conta não encontrada no estoque" }, 404);

    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    const dueDate = body.dueDate ?? addMonthsKeepDay(iso, 1);

    let cli = null;
    if (body.clientId) {
      [cli] = await db.select().from(clients).where(eq(clients.id, body.clientId));
    }

    const extraScreenEmail1 = (body.extraScreenEmail1 ?? "").toString().trim();
    const extraScreenEmail2 = (body.extraScreenEmail2 ?? "").toString().trim();
    const extraScreens = [extraScreenEmail1, extraScreenEmail2].filter(Boolean).length;

    const [account] = await db
      .insert(accounts)
      .values({
        service: stock.service,
        email: stock.email,
        password: stock.password,
        client: cli?.name ?? body.client ?? "",
        clientId: cli?.id ?? null,
        clientCode: cli?.code ?? null,
        whatsapp: cli?.whatsapp ?? body.whatsapp ?? "",
        priceCents: body.priceCents ?? 0,
        dueDate,
        extraScreens,
        extraScreenEmail1,
        extraScreenEmail2,
        paymentMethod: body.paymentMethod ?? "",
        planType: body.planType ?? "padrao",
        status: "ativa",
        notes: stock.notes,
      })
      .returning();

    await db.update(stockAccounts).set({ status: "usada" }).where(eq(stockAccounts.id, id));

    // Registra a entrada de dinheiro (venda) na carteira, se houve valor.
    if ((account.priceCents ?? 0) > 0) {
      await db.insert(transactions).values({
        kind: "venda",
        accountId: account.id,
        service: account.service,
        email: account.email,
        clientId: account.clientId ?? null,
        clientCode: account.clientCode ?? null,
        clientName: account.client ?? "",
        amountCents: account.priceCents ?? 0,
        paidOn: iso,
      });
    }

    return c.json({ account }, 201);
  })
  // Deleta uma conta do estoque
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(stockAccounts).where(eq(stockAccounts.id, id));
    return c.json({ ok: true }, 200);
  })
  // Limpa todas as contas usadas de um serviço (ou todas se sem service)
  .post("/clear-used", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.service) {
      await db
        .delete(stockAccounts)
        .where(and(eq(stockAccounts.status, "usada"), eq(stockAccounts.service, body.service)));
    } else {
      await db.delete(stockAccounts).where(eq(stockAccounts.status, "usada"));
    }
    return c.json({ ok: true }, 200);
  });
