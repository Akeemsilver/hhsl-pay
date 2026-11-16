import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreProvider } from "./store";
import { watchInstall } from "./install";
import { applyTheme, getTheme } from "./theme";
import { initHideMoney } from "./hideMoney";
import "./styles.css";

applyTheme(getTheme());
initHideMoney();
watchInstall();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
