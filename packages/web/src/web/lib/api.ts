import { hc } from "hono/client";
import type { AppType } from "../../api";
import { getToken, getTrustToken } from "./auth";

const client = hc<AppType>("/", {
  headers: () => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const trust = getTrustToken();
    if (trust) headers["X-Trust-Token"] = trust;
    return headers;
  },
});

export const api = client.api;
