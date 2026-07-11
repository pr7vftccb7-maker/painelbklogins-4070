import { useState } from "react";
import { motion } from "motion/react";
import { Users, Mail, Calendar, Loader2, Search } from "lucide-react";
import { Layout } from "../components/layout";
import { Input } from "../components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

type Customer = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

function fmtDateTime(ts: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function RegisteredCustomers() {
  const [search, setSearch] = useState("");

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers/admin/list", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("painel_bearer_token") ?? ""}`,
        },
      });
      if (!res.ok) throw new Error("erro");
      return await res.json();
    },
  });

  const filtered = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <Layout>
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold"
        >
          Clientes Cadastrados
        </motion.h1>
        <p className="mt-1 text-muted-foreground">
          Clientes que criaram conta no portal. Eles compram na vitrine e acessam suas contas pelo /portal.
        </p>
      </div>

      {/* Busca */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center rounded-2xl border border-border bg-card p-12 text-center"
        >
          <Users className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Quando alguém criar conta no portal do cliente (/portal), aparecerá aqui.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Cards no mobile */}
          <div className="grid gap-4 sm:hidden">
            {filtered.map((customer, i) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  Cadastrado em {fmtDateTime(customer.createdAt)}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tabela no desktop */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden sm:block overflow-hidden rounded-2xl border border-border bg-card"
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cadastro
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer, i) => (
                  <tr
                    key={customer.id}
                    className={`border-b border-border/50 transition-colors hover:bg-secondary/20 ${
                      i % 2 === 0 ? "bg-card" : "bg-secondary/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xs">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="size-3.5" />
                        {customer.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="size-3.5" />
                        {fmtDateTime(customer.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Contador */}
          <div className="mt-4 text-sm text-muted-foreground">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} cadastrado{filtered.length !== 1 ? "s" : ""}
            {search && ` (filtrado de ${customers?.length ?? 0})`}
          </div>
        </>
      )}
    </Layout>
  );
}
