import { Hono } from "hono";
import { db } from "../database";
import { user } from "../database/auth-schema";
import { accounts, shopOrders } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { auth } from "../auth";

const app = new Hono();

// Rota pública: cadastro de cliente
app.post("/register", async (c) => {
  try {
    const { name, email, password } = await c.req.json<{
      name: string;
      email: string;
      password: string;
    }>();

    if (!email || !password || !name) {
      return c.json({ error: "Nome, email e senha são obrigatórios." }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);
    }

    // Verifica se já existe
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      return c.json({ error: "Este email já está cadastrado." }, 409);
    }

    // Cria o usuário como customer via Better Auth
    const ctx = await auth.api.signUpEmail({
      body: {
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
      },
    });

    // Atualiza role para customer
    if (ctx?.user?.id) {
      await db.update(user).set({ role: "customer" }).where(eq(user.id, ctx.user.id));
    }

    return c.json({ ok: true, message: "Conta criada com sucesso! Faça login." });
  } catch (err) {
    console.error("customer register error:", err);
    return c.json({ error: "Erro ao criar conta." }, 500);
  }
});

// Rota pública: login de cliente (retorna token)
app.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json<{
      email: string;
      password: string;
    }>();

    if (!email || !password) {
      return c.json({ error: "Email e senha são obrigatórios." }, 400);
    }

    const ctx = await auth.api.signInEmail({
      body: {
        email: email.toLowerCase().trim(),
        password,
      },
    });

    // Verifica se é customer
    const u = await db.select({ role: user.role, id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, email.toLowerCase().trim()))
      .limit(1);

    if (u.length === 0 || u[0].role !== "customer") {
      return c.json({ error: "Acesso não autorizado. Use o portal do cliente." }, 403);
    }

    const token = ctx?.token;
    return c.json({
      ok: true,
      token,
      user: { id: u[0].id, name: u[0].name, email: u[0].email },
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Email ou senha inválidos." }, 401);
  }
});

// Rota autenticada: minhas contas (cliente logado vê suas contas compradas)
app.get("/my-accounts", authMiddleware, async (c) => {
  try {
    const session = c.get("session");
    const u = c.get("user");
    if (!session || !u) return c.json({ error: "Não autenticado." }, 401);

    // Busca pedidos aprovados deste cliente (pelo email)
    const orders = await db
      .select({
        id: shopOrders.id,
        service: shopOrders.service,
        deliveredEmail: shopOrders.deliveredEmail,
        deliveredPassword: shopOrders.deliveredPassword,
        deliveredAt: shopOrders.deliveredAt,
        status: shopOrders.status,
        createdAt: shopOrders.createdAt,
      })
      .from(shopOrders)
      .where(
        and(
          eq(shopOrders.customerEmail, u.email.toLowerCase().trim()),
          eq(shopOrders.status, "approved"),
        )
      )
      .orderBy(shopOrders.createdAt);

    // Também busca contas associadas diretamente na tabela accounts via email do cliente
    const directAccounts = await db
      .select({
        id: accounts.id,
        service: accounts.service,
        email: accounts.email,
        password: accounts.password,
        dueDate: accounts.dueDate,
        status: accounts.status,
      })
      .from(accounts)
      .where(eq(accounts.email, u.email.toLowerCase().trim()));

    // Junta os dois resultados
    const result = [
      ...orders.map((o) => ({
        id: o.id,
        service: o.service,
        email: o.deliveredEmail ?? "",
        password: o.deliveredPassword ?? "",
        dueDate: "",
        status: "ativa",
        deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : null,
      })),
      ...directAccounts,
    ];

    return c.json(result);
  } catch (err) {
    console.error("my-accounts error:", err);
    return c.json({ error: "Erro ao buscar contas." }, 500);
  }
});

// Rota admin: listar todos os clientes cadastrados
app.get("/admin/list", authMiddleware, async (c) => {
  const customers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.role, "customer"))
    .orderBy(user.createdAt);

  return c.json(customers);
});

// Rota admin: ver detalhes de um cliente
app.get("/admin/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const u = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "customer")))
    .limit(1);

  if (u.length === 0) return c.json({ error: "Cliente não encontrado." }, 404);
  return c.json(u[0]);
});

export default app;
