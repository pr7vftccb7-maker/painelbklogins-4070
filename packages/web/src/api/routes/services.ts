import { Hono } from "hono";
import { db } from "../database";
import { services } from "../database/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function nextOrder(): Promise<number> {
  const [row] = await db
    .select({ m: sql<number>`COALESCE(MAX(${services.sortOrder}), -1)` })
    .from(services);
  return (row?.m ?? -1) + 1;
}

export const servicesRoute = new Hono()
  .use("*", requireAuth)
  // Lista serviços ordenados
  .get("/", async (c) => {
    const rows = await db.select().from(services).orderBy(services.sortOrder);
    return c.json({ services: rows }, 200);
  })
  // Cria serviço (card)
  .post("/", async (c) => {
    const body = await c.req.json();
    const name = (body.name ?? "").trim();
    if (!name) return c.json({ message: "Nome obrigatório" }, 400);

    let slug = (body.slug ? String(body.slug) : slugify(name)).trim();
    if (!slug) slug = slugify(name) || `servico-${Date.now()}`;
    // garante slug único
    const existing = await db.select().from(services).where(eq(services.slug, slug));
    if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

    const short = (body.short ?? name.slice(0, 3)).toString().trim().slice(0, 4);
    const color = (body.color ?? "#e11d48").toString();
    const logo = (body.logo ?? "").toString();

    const [row] = await db
      .insert(services)
      .values({ slug, name, color, short, logo, sortOrder: await nextOrder() })
      .returning();
    return c.json({ service: row }, 201);
  })
  // Atualiza serviço (nome, cor, short, logo). Slug NÃO muda (mantém vínculo das contas).
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const [cur] = await db.select().from(services).where(eq(services.id, id));
    if (!cur) return c.json({ message: "Serviço não encontrado" }, 404);

    const name = body.name != null ? String(body.name).trim() : cur.name;
    if (!name) return c.json({ message: "Nome obrigatório" }, 400);
    const color = body.color != null ? String(body.color) : cur.color;
    const short = body.short != null ? String(body.short).trim().slice(0, 4) : cur.short;
    const logo = body.logo != null ? String(body.logo) : cur.logo;

    const [row] = await db
      .update(services)
      .set({ name, color, short, logo })
      .where(eq(services.id, id))
      .returning();
    return c.json({ service: row }, 200);
  })
  // Deleta serviço (card). Não apaga contas; elas apenas ficam sem metadados.
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(services).where(eq(services.id, id));
    return c.json({ ok: true }, 200);
  });
