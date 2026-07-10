import { useEffect, useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { LayoutGrid, AlertTriangle, Settings, LogOut, Loader2, Menu, X, Boxes, Users, Wallet } from "lucide-react";
import { authClient } from "../lib/auth";
import { useSummary } from "../lib/accounts";
import { api } from "../lib/api";
import { TwoFactorGate } from "./two-factor-gate";
import brandIcon from "../assets/bklogins-icon_1783171873307.png";

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="size-[18px]" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-[#ff6b35] px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: session, isPending } = authClient.useSession();
  const { data: summary } = useSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // fecha o drawer ao navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  const [verified, setVerified] = useState(false);

  // ao logar E passar no 2FA, checa vencimentos e dispara notificação do telegram (1x)
  useEffect(() => {
    if (session && verified) {
      api.settings["check-due"].$post().catch(() => {});
    }
  }, [session, verified]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Redirect to="/sign-in" />;

  const dueTotal = summary?.dueTotal ?? 0;

  async function signOut() {
    await authClient.signOut();
    navigate("/sign-in");
  }

  const sidebarContent = (
    <>
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <img src={brandIcon} alt="Bklogins" className="size-10 rounded-lg shadow-[0_0_18px_rgba(225,29,72,0.4)]" />
        <div className="leading-tight">
          <div className="font-brand text-base font-extrabold text-glow-red">BKLOGINS</div>
          <div className="text-xs text-muted-foreground">Assinaturas</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <NavItem href="/" icon={LayoutGrid} label="Início" active={location === "/"} />
        <NavItem
          href="/vencidas"
          icon={AlertTriangle}
          label="Contas Vencidas"
          active={location === "/vencidas"}
          badge={dueTotal}
        />
        <NavItem href="/clientes" icon={Users} label="Clientes" active={location === "/clientes"} />
        <NavItem href="/estoque" icon={Boxes} label="Estoque" active={location === "/estoque"} />
        <NavItem href="/carteira" icon={Wallet} label="Carteira" active={location === "/carteira"} />
        <NavItem
          href="/configuracoes"
          icon={Settings}
          label="Configurações"
          active={location === "/configuracoes"}
        />
      </nav>

      <div className="mt-auto">
        <div className="mb-2 truncate px-3 text-xs text-muted-foreground">{session.user.email}</div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-[18px]" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <TwoFactorGate onVerified={() => setVerified(true)}>
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        {sidebarContent}
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-border bg-sidebar px-4 py-6">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        {/* Header mobile */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={brandIcon} alt="Bklogins" className="size-8 rounded-md shadow-[0_0_14px_rgba(225,29,72,0.4)]" />
            <span className="font-brand text-sm font-extrabold text-glow-red">BKLOGINS</span>
          </div>
          {dueTotal > 0 && (
            <Link
              href="/vencidas"
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#ff6b35]/15 px-2.5 py-1 text-xs font-semibold text-[#ff6b35]"
            >
              <AlertTriangle className="size-3.5" />
              {dueTotal}
            </Link>
          )}
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
    </TwoFactorGate>
  );
}
