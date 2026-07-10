import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cache-buster fixo para assets estáticos servidos de /public (ex: /logos/*.png).
// Alguns proxies/CDNs de operadoras no Brasil guardam cópias corrompidas de imagens
// nesses caminhos "puros" (sem query string). Adicionar um parâmetro de versão faz
// o cliente pedir uma URL que o cache intermediário nunca viu, evitando servir a
// versão quebrada. Só se aplica a URLs locais (que começam com "/"); URLs externas
// (http/https completas) passam sem alteração.
const ASSET_CACHE_VERSION = "3";

export function logoUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (!src.startsWith("/")) return src;
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}v=${ASSET_CACHE_VERSION}`;
}
