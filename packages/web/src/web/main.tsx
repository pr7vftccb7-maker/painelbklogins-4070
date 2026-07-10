import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./styles.css";
import App from "./app.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<Router>
				<App />
			</Router>
			<Toaster theme="dark" position="top-center" richColors />
		</QueryClientProvider>
	</StrictMode>,
);
