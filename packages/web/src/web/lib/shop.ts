import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface CatalogProduct {
  id: string;
  service: string;
  serviceName: string;
  serviceColor: string;
  serviceLogo: string;
  serviceShort: string;
  priceCents: number;
  priceFormatted: string;
}

export interface ShopOrder {
  id: string;
  stockAccountId: string;
  service: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  priceCents: number;
  status: string;
  mercadoPagoPaymentId?: string | null;
  mercadoPagoPreferenceId?: string | null;
  deliveredEmail?: string | null;
  deliveredPassword?: string | null;
  deliveredAt?: string | number | null;
  notes: string;
  createdAt: string | number;
}

export function useCatalog(service?: string) {
  return useQuery({
    queryKey: ["catalog", service ?? "all"],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (service) query.service = service;
      const res = await api.shop.catalog.$get({ query });
      if (!res.ok) throw new Error("Falha ao carregar catálogo");
      return (await res.json()).catalog as CatalogProduct[];
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await api.shop.product[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Produto não encontrado");
      return (await res.json()).product as CatalogProduct;
    },
    enabled: !!id,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      customerName?: string;
      customerEmail?: string;
      customerWhatsapp?: string;
    }) => {
      const res = await api.shop.checkout.$post({ json: input });
      if (!res.ok) throw new Error("Falha ao criar pedido");
      return await res.json();
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await api.shop.order[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Pedido não encontrado");
      return (await res.json()).order as {
        id: string;
        status: string;
        priceCents: number;
        priceFormatted: string;
        service: string;
        createdAt: string | number;
      };
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "pending") return 5000;
      return false;
    },
  });
}

// ─── Admin hooks ─────────────────────────────────────────────────────────────

export function useAdminOrders(status?: string) {
  return useQuery({
    queryKey: ["shop-orders", status ?? "all"],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (status) query.status = status;
      const res = await api.shop.admin.orders.$get({ query });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      return (await res.json()).orders as ShopOrder[];
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.shop.admin.orders[":id"].$patch({
        param: { id },
        json: { status },
      });
      if (!res.ok) throw new Error("Falha ao atualizar pedido");
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-orders"] });
    },
  });
}

export function useToggleSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      forSale,
      salePriceCents,
    }: {
      id: string;
      forSale: boolean;
      salePriceCents?: number;
    }) => {
      const res = await api.shop.admin.stock[":id"]["toggle-sale"].$put({
        param: { id },
        json: { forSale, salePriceCents },
      });
      if (!res.ok) throw new Error("Falha ao alterar disponibilidade");
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
    },
  });
}
