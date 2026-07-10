import { Hono } from "hono";
import { db } from "../database";
import { clients, accounts } from "../database/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

async function nextCode(): Promise<number> {
  const [row] = await db.select({ m: sql<number>`COALESCE(MAX(${clients.code}), 0)` }).from(clients);
  return (row?.m ?? 0) + 1;
}

export const clientsRoute = new Hono()
  .use("*", requireAuth)
  // Lista clientes com contagem de contas
  .get("/", async (c) => {
    const rows = await db.select().from(clients).orderBy(clients.code);
    const accs = await db.select().from(accounts);
    const counts: Record<string, number> = {};
    for (const a of accs) {
      if (a.clientId) counts[a.clientId] = (counts[a.clientId] ?? 0) + 1;
    }
    const withCounts = rows.map((r) => ({ ...r, accountsCount: counts[r.id] ?? 0 }));
    return c.json({ clients: withCounts }, 200);
  })
  // Cria cliente (code automático, editável depois)
  .post("/", async (c) => {
    const body = await c.req.json();
    const name = (body.name ?? "").trim();
    if (!name) return c.json({ message: "Nome obrigatório" }, 400);
    let code = body.code != null && body.code !== "" ? Number(body.code) : await nextCode();
    // se code informado já existir, cai pro próximo livre
    const existing = await db.select().from(clients).where(eq(clients.code, code));
    if (existing.length > 0) code = await nextCode();
    const [row] = await db
      .insert(clients)
      .values({ code, name, whatsapp: body.whatsapp ?? "", notes: body.notes ?? "" })
      .returning();
    return c.json({ client: row }, 201);
  })
  // Atualiza cliente (nome, code, whatsapp). Propaga nome/whatsapp/code às contas.
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const [cur] = await db.select().from(clients).where(eq(clients.id, id));
    if (!cur) return c.json({ message: "Cliente não encontrado" }, 404);

    let code = cur.code;
    if (body.code != null && body.code !== "" && Number(body.code) !== cur.code) {
      const wanted = Number(body.code);
      const dup = await db.select().from(clients).where(eq(clients.code, wanted));
      if (dup.length > 0) return c.json({ message: "Código já usado por outro cliente" }, 409);
      code = wanted;
    }
    const name = body.name != null ? String(body.name).trim() : cur.name;
    const whatsapp = body.whatsapp != null ? body.whatsapp : cur.whatsapp;

    const [row] = await db
      .update(clients)
      .set({ code, name, whatsapp, notes: body.notes ?? cur.notes })
      .where(eq(clients.id, id))
      .returning();

    // propaga dados cacheados nas contas do cliente
    await db.update(accounts).set({ client: name, clientCode: code }).where(eq(accounts.clientId, id));
    return c.json({ client: row }, 200);
  })
  // Deleta cliente. As contas ficam sem cliente (clientId/Code null, nome limpo).
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.update(accounts).set({ clientId: null, clientCode: null }).where(eq(accounts.clientId, id));
    await db.delete(clients).where(eq(clients.id, id));
    return c.json({ ok: true }, 200);
  });
