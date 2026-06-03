import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { useCasinoStore } from "@/store/casinoStore";
import "@/index.css";

// Hydrate persisted state from the repository before first paint of guarded routes.
// AppShell shows a loader until `hydrated` flips true.
void useCasinoStore.getState().hydrate();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
