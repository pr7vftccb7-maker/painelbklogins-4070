import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Account } from "./accounts";

export type WalletPeriod = 7 | 15 | 30;

export interface WalletOverview {
  period: number;
  today: string;
  monthlyRecurringCents: number;
  soldCount: number;
  paidUp: { count: number; totalCents: number };
  toReceive: { count: number; totalCents: number };
  periodIncome: {
    totalCents: number;
    salesCents: number;
    renewalsCents: number;
    count: number;
  };
}

export interface WalletTransaction {
  id: string;
  kind: string; // venda | renovacao
  accountId: string | null;
  service: string;
  email: string;
  clientId: string | null;
  clientCode: number | null;
  clientName: string;
  amountCents: number;
  paidOn: string;
  notes: string;
  createdAt: string | number;
}

export function useWallet(period: WalletPeriod) {
  return useQuery({
    queryKey: ["wallet", period],
    queryFn: async () => {
      const res = await api.wallet.$get({ query: { period: String(period) } });
      if (!res.ok) throw new Error("Falha ao carregar carteira");
      return (await res.json()) as WalletOverview;
    },
  });
}

export function useWalletAccounts(tab: "paid_up" | "to_receive" | "sold") {
  return useQuery({
    queryKey: ["wallet-accounts", tab],
    queryFn: async () => {
      const res = await api.wallet.accounts.$get({ query: { tab } });
      if (!res.ok) throw new Error("Falha ao carregar contas");
      return (await res.json()).accounts as Account[];
    },
  });
}

export function useWalletTransactions(period: WalletPeriod) {
  return useQuery({
    queryKey: ["wallet-transactions", period],
    queryFn: async () => {
      const res = await api.wallet.transactions.$get({ query: { period: String(period) } });
      if (!res.ok) throw new Error("Falha ao carregar extrato");
      return (await res.json()).transactions as WalletTransaction[];
    },
  });
}
