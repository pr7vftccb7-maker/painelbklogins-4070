import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export * from "./auth-schema";

/**
 * Contas de assinatura gerenciadas no painel.
 * Cada linha = uma conta de um serviço de streaming.
 */
export const accounts = sqliteTable("subscription_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // slug do serviço: netflix, disney, hbomax, prime, spotify, globoplay, globoplay-telecine, premiere, youtube, paramount
  service: text("service").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull().default(""),
  client: text("client").notNull().default(""),
  // referência ao cliente (clients.id) e código numérico cacheado para agrupar
  clientId: text("client_id"),
  clientCode: integer("client_code"),
  // WhatsApp do cliente (apenas dígitos, com DDI/DDD, ex: 5511999999999)
  whatsapp: text("whatsapp").notNull().default(""),
  // valor da assinatura em centavos (ex: 2500 = R$ 25,00)
  priceCents: integer("price_cents").notNull().default(0),
  // data de vencimento no formato YYYY-MM-DD
  dueDate: text("due_date").notNull(),
  extraScreens: integer("extra_screens").notNull().default(0),
  // Emails das telas extra (perfis adicionais usados por outras pessoas nesta mesma conta).
  // Até 2 emails; usados na busca do serviço para achar a conta pela tela extra também.
  extraScreenEmail1: text("extra_screen_email_1").notNull().default(""),
  extraScreenEmail2: text("extra_screen_email_2").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default(""),
  // tipo de plano da conta: premium | padrao | anuncios
  planType: text("plan_type").notNull().default("padrao"),
  // status: ativa | caida | atualizar_pagamento | vencida | cancelada
  status: text("status").notNull().default("ativa"),
  notes: text("notes").notNull().default(""),
  // controla se já foi notificado sobre o vencimento (evita spam no telegram)
  notifiedDueAt: text("notified_due_at"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Clientes. Cada cliente tem um código numérico único (sequencial, editável).
 * Contas referenciam o cliente por clientId; o mesmo código = mesmo cliente.
 */
export const clients = sqliteTable("clients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // código numérico único (ex: 1, 2, 3...)
  code: integer("code").notNull(),
  name: text("name").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Estoque de contas ainda não vendidas/atribuídas a um cliente.
 * Importadas em massa (email:senha) por serviço.
 */
export const stockAccounts = sqliteTable("stock_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  service: text("service").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull().default(""),
  notes: text("notes").notNull().default(""),
  // status: disponivel | usada
  status: text("status").notNull().default("disponivel"),
  // motivo do retorno ao estoque: null (importada normal) | cancelada | caida | atualizar_pagamento
  problemType: text("problem_type"),
  // se a conta está liberada pra venda na vitrine pública
  forSale: integer("for_sale", { mode: "boolean" }).notNull().default(false),
  // preço de venda na vitrine em centavos (ex: 2500 = R$ 25,00)
  salePriceCents: integer("sale_price_cents").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Pedidos da loja (vitrine pública).
 */
export const shopOrders = sqliteTable("shop_orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // referência ao stockAccount vendido
  stockAccountId: text("stock_account_id").notNull(),
  service: text("service").notNull(),
  // dados do comprador
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerWhatsapp: text("customer_whatsapp").notNull().default(""),
  // preço pago em centavos
  priceCents: integer("price_cents").notNull().default(0),
  // status do pedido: pending | approved | rejected | cancelled | refunded
  status: text("status").notNull().default("pending"),
  // id do pagamento no Mercado Pago
  mercadoPagoPaymentId: text("mercado_pago_payment_id"),
  // id da preferência no Mercado Pago
  mercadoPagoPreferenceId: text("mercado_pago_preference_id"),
  // conta entregue após pagamento aprovado
  deliveredEmail: text("delivered_email"),
  deliveredPassword: text("delivered_password"),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Configurações do painel (chave/valor). Guarda credenciais do Telegram etc.
 */
export const settings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

/**
 * Serviços (cards) gerenciados dinamicamente pelo usuário.
 * Cada linha = um card de serviço na tela inicial.
 */
export const services = sqliteTable("services", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#e11d48"),
  short: text("short").notNull().default(""),
  logo: text("logo").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Códigos de verificação em duas etapas (2FA) enviados por Telegram.
 * Um código ativo por usuário; o mais recente sobrescreve o anterior.
 */
export const twofaCodes = sqliteTable("twofa_codes", {
  userId: text("user_id").primaryKey(),
  // hash SHA-256 do código de 6 dígitos (nunca guardamos o código em claro)
  codeHash: text("code_hash").notNull(),
  // tentativas erradas restantes antes de invalidar
  attempts: integer("attempts").notNull().default(5),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

/**
 * Dispositivos confiáveis após passar pelo 2FA.
 * Enquanto o token for válido (24h), o painel não pede o código de novo.
 */
export const trustedDevices = sqliteTable("trusted_devices", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull().default(""),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

/**
 * Livro de transações da carteira. Cada linha = uma entrada de dinheiro.
 * kind: "venda" (conta atribuída a cliente) | "renovacao" (renovação mensal).
 * Registrado no momento em que o dinheiro entra, para permitir relatórios por período.
 */
export const transactions = sqliteTable("wallet_transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // tipo da entrada: venda | renovacao
  kind: text("kind").notNull().default("venda"),
  // referência à conta que gerou a entrada (pode ficar órfã se a conta for deletada)
  accountId: text("account_id"),
  service: text("service").notNull().default(""),
  email: text("email").notNull().default(""),
  // cliente no momento da transação (cacheado)
  clientId: text("client_id"),
  clientCode: integer("client_code"),
  clientName: text("client_name").notNull().default(""),
  // valor da entrada em centavos
  amountCents: integer("amount_cents").notNull().default(0),
  // data da entrada YYYY-MM-DD (para agrupar por período sem depender de timezone)
  paidOn: text("paid_on").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
