import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface Service {
  id: string;
  slug: string;
  name: string;
  color: string;
  short: string;
  logo: string;
  sortOrder: number;
  createdAt: string | number;
}

export interface ServiceInput {
  name: string;
  slug?: string;
  color?: string;
  short?: string;
  logo?: string;
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await api.services.$get();
      if (!res.ok) throw new Error("Falha ao carregar serviços");
      const data = await res.json();
      return (data.services ?? []) as Service[];
    },
  });
}

/** Mapa slug -> Service, para lookup de metadados nos componentes. */
export function useServiceMap() {
  const { data } = useServices();
  const map: Record<string, Service> = {};
  for (const s of data ?? []) map[s.slug] = s;
  return map;
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceInput) => {
      const res = await api.services.$post({ json: input });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro" }));
        throw new Error("message" in err ? err.message : "Erro ao criar serviço");
      }
      return await res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ServiceInput & { id: string }) => {
      const res = await api.services[":id"].$put({ param: { id }, json: input });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro" }));
        throw new Error("message" in err ? err.message : "Erro ao atualizar serviço");
      }
      return await res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.services[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Erro ao remover serviço");
      return await res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}
