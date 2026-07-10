import { createAuthClient } from "better-auth/react";

const TOKEN_KEY = "painel_bearer_token";
const TRUST_KEY = "painel_trust_token";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Token de dispositivo confiável do 2FA (válido por 24h no servidor). */
export function getTrustToken(): string {
  try {
    return localStorage.getItem(TRUST_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setTrustToken(token: string) {
  try {
    localStorage.setItem(TRUST_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearTrustToken() {
  try {
    localStorage.removeItem(TRUST_KEY);
  } catch {
    /* ignore */
  }
}

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => getToken(),
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) setToken(token);
    },
  },
});
