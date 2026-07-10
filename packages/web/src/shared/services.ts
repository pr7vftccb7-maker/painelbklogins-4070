/** Metadados dos serviços de streaming — compartilhado entre API e frontend. */
export interface ServiceMeta {
  slug: string;
  name: string;
  color: string;
  short: string;
  logo: string;
}

export const SERVICES: ServiceMeta[] = [
  { slug: "netflix", name: "Netflix", color: "#E50914", short: "N", logo: "/logos/netflix.png" },
  { slug: "disney", name: "Disney+", color: "#113CCF", short: "D+", logo: "/logos/disney.png" },
  { slug: "hbomax", name: "HBO Max", color: "#7B2FF7", short: "HBO", logo: "/logos/hbomax.png" },
  { slug: "prime", name: "Prime Video", color: "#00A8E1", short: "PV", logo: "/logos/prime.png" },
  { slug: "spotify", name: "Spotify", color: "#1DB954", short: "S", logo: "/logos/spotify.png" },
  { slug: "globoplay", name: "Globoplay + Telecine + Premiere", color: "#FF4C00", short: "GTP", logo: "/logos/globoplay.png" },
  { slug: "globoplay-telecine", name: "Globoplay + Telecine", color: "#E8113C", short: "GT", logo: "/logos/globoplay-telecine.png" },
  { slug: "youtube", name: "Youtube Premium", color: "#FF0000", short: "YT", logo: "/logos/youtube.png" },
  { slug: "paramount", name: "Paramount+", color: "#0064FF", short: "P+", logo: "/logos/paramount.png" },
];

export const SERVICE_MAP: Record<string, ServiceMeta> = Object.fromEntries(
  SERVICES.map((s) => [s.slug, s]),
);

export type StatusValue =
  | "ativa"
  | "caida"
  | "atualizar_pagamento"
  | "vencida"
  | "cancelada";

export interface StatusMeta {
  value: StatusValue;
  label: string;
  color: string;
}

export const STATUSES: StatusMeta[] = [
  { value: "ativa", label: "Ativa", color: "#2FBF71" },
  { value: "caida", label: "Caída", color: "#F0484B" },
  { value: "atualizar_pagamento", label: "Atualizar Pagamento", color: "#F5A524" },
  { value: "vencida", label: "Vencida", color: "#FF6B35" },
  { value: "cancelada", label: "Cancelada", color: "#6B7280" },
];

export const STATUS_MAP: Record<string, StatusMeta> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s]),
);

export type PlanTypeValue = "premium" | "padrao" | "anuncios";

export interface PlanTypeMeta {
  value: PlanTypeValue;
  label: string;
  color: string;
}

export const PLAN_TYPES: PlanTypeMeta[] = [
  { value: "premium", label: "Premium", color: "#F5A524" },
  { value: "padrao", label: "Padrão", color: "#6D5EF6" },
  { value: "anuncios", label: "Com anúncios", color: "#6B7280" },
];

export const PLAN_TYPE_MAP: Record<string, PlanTypeMeta> = Object.fromEntries(
  PLAN_TYPES.map((p) => [p.value, p]),
);
