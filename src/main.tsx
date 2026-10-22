import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreProvider } from "./store";
import { watchInstall } from "./install";
import { applyTheme, getTheme } from "./theme";
import "./styles.css";

applyTheme(getTheme());
watchInstall();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
