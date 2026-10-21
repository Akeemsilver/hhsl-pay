import { useState } from "react";
import { MonthScreen } from "./screens/MonthScreen";
import { YearScreen } from "./screens/YearScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { BackupScreen } from "./screens/BackupScreen";

type Tab = "month" | "year" | "settings" | "backup";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "month", label: "Month", icon: "📅" },
  { id: "year", label: "Year", icon: "📊" },
  { id: "settings", label: "Rates", icon: "⚙️" },
  { id: "backup", label: "Backup", icon: "💾" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("month");
  return (
    <div className="app">
      <main>
        {tab === "month" && <MonthScreen goTo={setTab} />}
        {tab === "year" && <YearScreen />}
        {tab === "settings" && <SettingsScreen />}
        {tab === "backup" && <BackupScreen />}
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
