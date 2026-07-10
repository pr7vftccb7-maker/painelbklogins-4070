import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware, require2fa } from "./middleware/auth";
import { accountsRoute } from "./routes/accounts";
import { settingsRoute } from "./routes/settings";
import { stockRoute } from "./routes/stock";
import { clientsRoute } from "./routes/clients";
import { servicesRoute } from "./routes/services";
import { walletRoute } from "./routes/wallet";
import { backupRoute } from "./routes/backup";
import { twofaRoute } from "./routes/twofa";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const app = new Hono<{ Variables: Variables }>()
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  // 2FA: acessível logo após o login, ANTES de liberar as rotas de dados.
  .route("/twofa", twofaRoute)
  // Rotas de dados: exigem que o 2FA já tenha sido validado neste dispositivo.
  .use("/accounts/*", require2fa)
  .use("/stock/*", require2fa)
  .use("/clients/*", require2fa)
  .use("/services/*", require2fa)
  .use("/wallet/*", require2fa)
  .use("/backup/*", require2fa)
  .use("/settings/*", require2fa)
  .route("/accounts", accountsRoute)
  .route("/stock", stockRoute)
  .route("/clients", clientsRoute)
  .route("/services", servicesRoute)
  .route("/wallet", walletRoute)
  .route("/backup", backupRoute)
  .route("/settings", settingsRoute);

export type AppType = typeof app;
export default app;
