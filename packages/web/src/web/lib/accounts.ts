import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface Account {
  id: string;
  service: string;
  email: string;
  password: string;
  client: string;
  clientId: string | null;
  clientCode: number | null;
  whatsapp: string;
  priceCents: number;
  dueDate: string;
  extraScreens: number;
  extraScreenEmail1: string;
  extraScreenEmail2: string;
  paymentMethod: string;
  planType: string;
  status: string;
  notes: string;
  notifiedDueAt: string | null;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface AccountInput {
  service: string;
  email: string;
  password: string;
  client: string;
  clientId?: string | null;
  clientCode?: number | null;
  whatsapp: string;
  priceCents: number;
  dueDate: string;
  extraScreens: number;
  extraScreenEmail1: string;
  extraScreenEmail2: string;
  paymentMethod: string;
  planType: string;
  status: string;
  notes: string;
}

export function usePixInfo() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.settings.$get();
      if (!res.ok) throw new Error("Falha ao carregar configurações");
      const data = await res.json();
      return { pixKey: data.pixKey ?? "", pixName: data.pixName ?? "" };
    },
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: async () => {
      const res = await api.accounts.summary.$get();
      if (!res.ok) throw new Error("Falha ao carregar resumo");
      return (await res.json()) as { byService: Record<string, { total: number; due: number }>; dueTotal: number };
    },
  });
}

export function useServiceAccounts(service: string) {
  return useQuery({
    queryKey: ["accounts", service],
    queryFn: async () => {
      const res = await api.accounts.$get({ query: { service } });
      if (!res.ok) throw new Error("Falha ao carregar contas");
      return (await res.json()).accounts as Account[];
    },
  });
}

export function useOverdue() {
  return useQuery({
    queryKey: ["overdue"],
    queryFn: async () => {
      const res = await api.accounts.overdue.$get();
      if (!res.ok) throw new Error("Falha ao carregar vencidas");
      return (await res.json()).accounts as Account[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["overdue"] });
    // status cancelada/caída/atualizar_pagamento move a conta pro estoque
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["stock-summary"] });
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const res = await api.accounts.$post({ json: input });
      if (!res.ok) throw new Error("Falha ao criar conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AccountInput }) => {
      const res = await api.accounts[":id"].$put({ param: { id }, json: input });
      if (!res.ok) throw new Error("Falha ao atualizar conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useRenewAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].renew.$post({ param: { id } });
      if (!res.ok) throw new Error("Falha ao renovar conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useUpdateStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.accounts[":id"].status.$patch({ param: { id }, json: { status } });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Falha ao excluir conta");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}
