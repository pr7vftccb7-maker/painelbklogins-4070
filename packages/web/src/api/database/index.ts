import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Cliente libsql bruto — usado pelo backup/restore para dump/insert sem coerção de tipo.
export { client };

export const db = drizzle(client, { schema });
