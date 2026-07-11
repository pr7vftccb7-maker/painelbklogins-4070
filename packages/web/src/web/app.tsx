import { Route, Switch } from "wouter";
import Index from "./pages/index";
import ServicePage from "./pages/service";
import OverduePage from "./pages/overdue";
import StockPage from "./pages/stock";
import WalletPage from "./pages/wallet";
import ClientsPage from "./pages/clients";
import SettingsPage from "./pages/settings";
import ShopPage from "./pages/shop";
import ShopOrdersPage from "./pages/shop-orders";
import SignIn from "./pages/sign-in";
import CustomerPortal from "./pages/customer-portal";
import RegisteredCustomers from "./pages/registered-customers";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        {/* Portal do Cliente (link separado, público) */}
        <Route path="/portal" component={CustomerPortal} />
        <Route path="/portal/*" component={CustomerPortal} />

        {/* Login do admin */}
        <Route path="/sign-in" component={SignIn} />

        {/* Painel Admin */}
        <Route path="/" component={Index} />
        <Route path="/servico/:slug" component={ServicePage} />
        <Route path="/vencidas" component={OverduePage} />
        <Route path="/estoque" component={StockPage} />
        <Route path="/carteira" component={WalletPage} />
        <Route path="/clientes" component={ClientsPage} />
        <Route path="/configuracoes" component={SettingsPage} />
        <Route path="/pedidos" component={ShopOrdersPage} />
        <Route path="/clientes-cadastrados" component={RegisteredCustomers} />

        {/* Rotas da loja (vitrine pública) */}
        <Route path="/loja" component={ShopPage} />
        <Route path="/loja/checkout/:id" component={ShopPage} />
        <Route path="/loja/sucesso/:id" component={ShopPage} />
      </Switch>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
