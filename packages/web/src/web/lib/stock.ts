import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface StockAccount {
  id: string;
  service: string;
  email: string;
  password: string;
  notes: string;
  status: string; // disponivel | usada | problema
  problemType?: string | null; // cancelada | caida | atualizar_pagamento
  clientName?: string | null; // cliente que está usando (contas usadas)
  clientCode?: number | null;
  createdAt: string | number;
}

export function useStockSummary() {
  return useQuery({
    queryKey: ["stock-summary"],
    queryFn: async () => {
      const res = await api.stock.summary.$get();
      if (!res.ok) throw new Error("Falha ao carregar estoque");
      return (await res.json()) as {
        byService: Record<string, { total: number; available: number; problem: number; virgin: number }>;
        availableTotal: number;
        problemTotal: number;
        virginTotal: number;
      };
    },
  });
}

export function useStock(service?: string, status?: string) {
  return useQuery({
    queryKey: ["stock", service ?? "all", status ?? "all"],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (service) query.service = service;
      if (status) query.status = status;
      const res = await api.stock.$get({ query });
      if (!res.ok) throw new Error("Falha ao carregar estoque");
      return (await res.json()).stock as StockAccount[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["stock-summary"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  };
}

export function useImportStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      service,
      list,
      clientId,
      virgin,
    }: {
      service: string;
      list: string;
      clientId?: string;
      virgin?: boolean;
    }) => {
      const res = await api.stock.import.$post({
        json: { service, list, clientId: clientId ?? "", virgin: virgin ?? false },
      });
      if (!res.ok) throw new Error("Falha ao importar contas");
      return (await res.json()) as { added: number; skipped: number; total: number; target: string };
    },
    onSuccess: invalidate,
  });
}

export function useAddStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { service: string; email: string; password: string; notes?: string }) => {
      const res = await api.stock.$post({ json: input });
      if (!res.ok) throw new Error("Falha ao adicionar conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useAssignStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      clientId,
      dueDate,
      priceCents,
      paymentMethod,
      extraScreenEmail1,
      extraScreenEmail2,
    }: {
      id: string;
      clientId: string;
      dueDate?: string;
      priceCents?: number;
      paymentMethod?: string;
      extraScreenEmail1?: string;
      extraScreenEmail2?: string;
    }) => {
      const res = await api.stock[":id"].assign.$post({
        param: { id },
        json: { clientId, dueDate, priceCents, paymentMethod, extraScreenEmail1, extraScreenEmail2 },
      });
      if (!res.ok) throw new Error("Falha ao passar conta para o cliente");
      return (await res.json()) as { account: import("./accounts").Account };
    },
    onSuccess: invalidate,
  });
}

export function useSetStockStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      problemType,
    }: {
      id: string;
      status: "disponivel" | "usada" | "problema" | "virgem";
      problemType?: string;
    }) => {
      const res = await api.stock[":id"].status.$patch({
        param: { id },
        json: { status, problemType },
      });
      if (!res.ok) throw new Error("Falha ao mudar status");
      return (await res.json()) as { stock: StockAccount };
    },
    onSuccess: invalidate,
  });
}

export function useActivateStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password?: string }) => {
      const res = await api.stock[":id"].activate.$post({
        param: { id },
        json: { password: password ?? "" },
      });
      if (!res.ok) throw new Error("Falha ao assinar conta");
      return (await res.json()) as { stock: StockAccount };
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.stock[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Falha ao excluir conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useClearUsed() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (service?: string) => {
      const res = await api.stock["clear-used"].$post({ json: service ? { service } : {} });
      if (!res.ok) throw new Error("Falha ao limpar usadas");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}
