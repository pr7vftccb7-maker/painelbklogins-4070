import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface Client {
  id: string;
  code: number;
  name: string;
  whatsapp: string;
  notes: string;
  accountsCount: number;
  createdAt: string | number;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.clients.$get();
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return (await res.json()).clients as Client[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["overdue"] });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { name: string; code?: number | string; whatsapp?: string; notes?: string }) => {
      const res = await api.clients.$post({ json: input });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Falha ao criar cliente");
      return (await res.json()).client as Client;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; code?: number | string; whatsapp?: string; notes?: string };
    }) => {
      const res = await api.clients[":id"].$put({ param: { id }, json: input });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message ?? "Falha ao atualizar cliente";
        throw new Error(msg);
      }
      return await res.json();
    },
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.clients[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Falha ao excluir cliente");
      return await res.json();
    },
    onSuccess: invalidate,
  });
}
