import { Hono } from "hono";
import { db } from "../database";
import { stockAccounts, services, shopOrders, accounts, clients } from "../database/schema";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { addMonthsKeepDay } from "../lib/dates";

// ─── Rotas PÚBLICAS (vitrine) ───────────────────────────────────────────────

export const shopRoute = new Hono()
  // Catálogo público: lista todas as contas liberadas pra venda
  .get("/catalog", async (c) => {
    const service = c.req.query("service");

    const conds = [eq(stockAccounts.forSale, true), eq(stockAccounts.status, "disponivel")];
    if (service) conds.push(eq(stockAccounts.service, service));

    const rows = await db
      .select({
        id: stockAccounts.id,
        service: stockAccounts.service,
        salePriceCents: stockAccounts.salePriceCents,
        createdAt: stockAccounts.createdAt,
      })
      .from(stockAccounts)
      .where(conds.length > 1 ? and(...conds) : conds[0])
      .orderBy(desc(stockAccounts.createdAt));

    // Enriquece com nome/logo dos serviços
    const svcRows = await db.select().from(services);
    const svcMap = new Map(svcRows.map((s) => [s.slug, s]));

    const catalog = rows.map((r) => {
      const svc = svcMap.get(r.service);
      return {
        id: r.id,
        service: r.service,
        serviceName: svc?.name ?? r.service,
        serviceColor: svc?.color ?? "#e11d48",
        serviceLogo: svc?.logo ?? "",
        serviceShort: svc?.short ?? "",
        priceCents: r.salePriceCents,
        priceFormatted: `R$ ${(r.salePriceCents / 100).toFixed(2).replace(".", ",")}`,
      };
    });

    return c.json({ catalog }, 200);
  })
  // Detalhe de um produto específico
  .get("/product/:id", async (c) => {
    const id = c.req.param("id");

    const [row] = await db
      .select()
      .from(stockAccounts)
      .where(and(eq(stockAccounts.id, id), eq(stockAccounts.forSale, true)));

    if (!row) return c.json({ message: "Produto não encontrado" }, 404);

    const svcRows = await db.select().from(services);
    const svc = svcRows.find((s) => s.slug === row.service);

    return c.json(
      {
        product: {
          id: row.id,
          service: row.service,
          serviceName: svc?.name ?? row.service,
          serviceColor: svc?.color ?? "#e11d48",
          serviceLogo: svc?.logo ?? "",
          serviceShort: svc?.short ?? "",
          priceCents: row.salePriceCents,
          priceFormatted: `R$ ${(row.salePriceCents / 100).toFixed(2).replace(".", ",")}`,
        },
      },
      200,
    );
  })
  // Checkout: cria pedido e retorna link/pix do Mercado Pago
  .post("/checkout", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const productId: string = body.productId;
    const customerName: string = body.customerName ?? "";
    const customerEmail: string = body.customerEmail ?? "";
    const customerWhatsapp: string = body.customerWhatsapp ?? "";

    if (!productId) return c.json({ message: "Produto obrigatório" }, 400);

    // Verifica se o produto ainda está disponível
    const [product] = await db
      .select()
      .from(stockAccounts)
      .where(and(eq(stockAccounts.id, productId), eq(stockAccounts.forSale, true), eq(stockAccounts.status, "disponivel")));

    if (!product)
      return c.json({ message: "Produto não disponível para venda" }, 400);

    const priceCents = product.salePriceCents;
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

    let mercadoPagoId: string | null = null;
    let mercadoPagoPreferenceId: string | null = null;
    let paymentUrl: string | null = null;
    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;

    // Tenta criar pagamento no Mercado Pago
    if (mpToken) {
      try {
        const price = Number((priceCents / 100).toFixed(2));
        const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                id: productId,
                title: `Assinatura ${product.service}`,
                description: `Conta de ${product.service}`,
                quantity: 1,
                currency_id: "BRL",
                unit_price: price,
              },
            ],
            payer: {
              name: customerName || "Cliente",
              email: customerEmail || undefined,
            },
            payment_methods: {
              excluded_payment_types: [{ id: "ticket" }],
              installments: 1,
            },
            back_urls: {
              success: `${process.env.WEBSITE_URL ?? ""}/pedido/sucesso`,
              failure: `${process.env.WEBSITE_URL ?? ""}/pedido/erro`,
              pending: `${process.env.WEBSITE_URL ?? ""}/pedido/pendente`,
            },
            auto_return: "approved",
            notification_url: `${process.env.WEBSITE_URL ?? ""}/api/shop/webhook`,
          }),
        });

        const mpData = (await mpResp.json()) as {
          id?: string;
          init_point?: string;
          sandbox_init_point?: string;
        };

        if (mpResp.ok && mpData.id) {
          mercadoPagoPreferenceId = mpData.id;
          paymentUrl = mpData.sandbox_init_point ?? mpData.init_point ?? null;
        }
      } catch {
        // Se falhar, segue com pagamento offline (admin aprova manualmente)
      }
    }

    // Cria o pedido no banco
    const [order] = await db
      .insert(shopOrders)
      .values({
        stockAccountId: productId,
        service: product.service,
        customerName,
        customerEmail,
        customerWhatsapp,
        priceCents,
        status: "pending",
        mercadoPagoPreferenceId,
      })
      .returning();

    return c.json(
      {
        order: {
          id: order.id,
          status: order.status,
          priceCents: order.priceCents,
          priceFormatted: `R$ ${(order.priceCents / 100).toFixed(2).replace(".", ",")}`,
        },
        paymentUrl,
        pixQrCode,
        pixCopyPaste,
      },
      201,
    );
  })
  // Consulta status de um pedido (público)
  .get("/order/:id", async (c) => {
    const id = c.req.param("id");

    const [order] = await db.select().from(shopOrders).where(eq(shopOrders.id, id));
    if (!order) return c.json({ message: "Pedido não encontrado" }, 404);

    return c.json(
      {
        order: {
          id: order.id,
          status: order.status,
          priceCents: order.priceCents,
          priceFormatted: `R$ ${(order.priceCents / 100).toFixed(2).replace(".", ",")}`,
          service: order.service,
          createdAt: order.createdAt,
        },
      },
      200,
    );
  })
  // Webhook do Mercado Pago
  .post("/webhook", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = body.type ?? body.action ?? "";
    const paymentId = body.data?.id ?? body.id ?? "";

    if (!paymentId) return c.json({ ok: true }, 200);

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken) return c.json({ ok: true }, 200);

    try {
      // Busca detalhes do pagamento no MP
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });

      if (!mpResp.ok) return c.json({ ok: true }, 200);

      const payment = (await mpResp.json()) as {
        id?: string;
        status?: string;
        external_reference?: string;
        metadata?: { order_id?: string };
      };

      const mpStatus = payment.status ?? "";
      // Procura o pedido pela preferência ou metadata
      const orders = await db.select().from(shopOrders);
      let targetOrder = orders.find(
        (o) => o.mercadoPagoPaymentId === String(payment.id),
      );

      if (!targetOrder && payment.metadata?.order_id) {
        targetOrder = orders.find((o) => o.id === payment.metadata!.order_id);
      }

      if (!targetOrder) {
        // Se não achar, registra o paymentId no primeiro pedido pending com mesmo valor? Não seguro.
        return c.json({ ok: true }, 200);
      }

      let newStatus: string = targetOrder.status;
      if (mpStatus === "approved") {
        newStatus = "approved";
      } else if (["rejected", "cancelled", "refunded"].includes(mpStatus)) {
        newStatus = mpStatus;
      }

      // Entrega a conta se aprovado
      let deliveredEmail: string | null = null;
      let deliveredPassword: string | null = null;
      let deliveredAt: Date | null = null;

      if (newStatus === "approved" && targetOrder.status !== "approved") {
        const [stock] = await db
          .select()
          .from(stockAccounts)
          .where(eq(stockAccounts.id, targetOrder.stockAccountId));

        if (stock) {
          deliveredEmail = stock.email;
          deliveredPassword = stock.password;
          deliveredAt = new Date();

          // Marca estoque como usado
          await db
            .update(stockAccounts)
            .set({ status: "usada", forSale: false })
            .where(eq(stockAccounts.id, targetOrder.stockAccountId));
        }
      }

      await db
        .update(shopOrders)
        .set({
          status: newStatus,
          mercadoPagoPaymentId: String(payment.id),
          deliveredEmail,
          deliveredPassword,
          deliveredAt,
        })
        .where(eq(shopOrders.id, targetOrder.id));
    } catch {
      // Ignora erros no webhook
    }

    return c.json({ ok: true }, 200);
  });

// ─── Rotas ADMIN (protegidas) ────────────────────────────────────────────────

export const shopAdminRoute = new Hono()
  .use("*", requireAuth)
  // Lista todos os pedidos
  .get("/orders", async (c) => {
    const status = c.req.query("status");
    const conds = [];
    if (status) conds.push(eq(shopOrders.status, status));
    const rows = conds.length
      ? await db
          .select()
          .from(shopOrders)
          .where(conds.length === 1 ? conds[0] : and(...conds))
          .orderBy(desc(shopOrders.createdAt))
      : await db.select().from(shopOrders).orderBy(desc(shopOrders.createdAt));

    return c.json({ orders: rows }, 200);
  })
  // Atualiza status de um pedido manualmente
  .patch("/orders/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const status = body.status as string;
    if (!["approved", "rejected", "cancelled", "refunded"].includes(status)) {
      return c.json({ message: "Status inválido" }, 400);
    }

    const [current] = await db.select().from(shopOrders).where(eq(shopOrders.id, id));
    if (!current) return c.json({ message: "Pedido não encontrado" }, 404);

    let deliveredEmail: string | null = current.deliveredEmail;
    let deliveredPassword: string | null = current.deliveredPassword;
    let deliveredAt: Date | null = current.deliveredAt;

    // Se está aprovando agora, entrega a conta
    if (status === "approved" && current.status !== "approved") {
      const [stock] = await db
        .select()
        .from(stockAccounts)
        .where(eq(stockAccounts.id, current.stockAccountId));

      if (stock) {
        deliveredEmail = stock.email;
        deliveredPassword = stock.password;
        deliveredAt = new Date();

        await db
          .update(stockAccounts)
          .set({ status: "usada", forSale: false })
          .where(eq(stockAccounts.id, current.stockAccountId));
      }
    }

    // Se está rejeitando/cancelando, libera o estoque de volta
    if (["rejected", "cancelled"].includes(status) && current.status !== status) {
      await db
        .update(stockAccounts)
        .set({ status: "disponivel", forSale: true })
        .where(eq(stockAccounts.id, current.stockAccountId));
    }

    const [order] = await db
      .update(shopOrders)
      .set({ status, deliveredEmail, deliveredPassword, deliveredAt })
      .where(eq(shopOrders.id, id))
      .returning();

    return c.json({ order }, 200);
  })
  // Alterna forSale de um item do estoque
  .put("/stock/:id/toggle-sale", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const [stock] = await db.select().from(stockAccounts).where(eq(stockAccounts.id, id));
    if (!stock) return c.json({ message: "Conta não encontrada" }, 404);

    const forSale = body.forSale ?? !stock.forSale;
    const salePriceCents = body.salePriceCents ?? stock.salePriceCents;

    const [row] = await db
      .update(stockAccounts)
      .set({ forSale, salePriceCents })
      .where(eq(stockAccounts.id, id))
      .returning();

    return c.json({ stock: row }, 200);
  });
