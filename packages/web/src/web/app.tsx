import { Route, Switch } from "wouter";
import Index from "./pages/index";
import ServicePage from "./pages/service";
import OverduePage from "./pages/overdue";
import StockPage from "./pages/stock";
import WalletPage from "./pages/wallet";
import ClientsPage from "./pages/clients";
import SettingsPage from "./pages/settings";
import SignIn from "./pages/sign-in";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/sign-in" component={SignIn} />
        <Route path="/" component={Index} />
        <Route path="/servico/:slug" component={ServicePage} />
        <Route path="/vencidas" component={OverduePage} />
        <Route path="/estoque" component={StockPage} />
        <Route path="/carteira" component={WalletPage} />
        <Route path="/clientes" component={ClientsPage} />
        <Route path="/configuracoes" component={SettingsPage} />
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
