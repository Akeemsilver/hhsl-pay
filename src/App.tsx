import { NavProvider, useNav, type Tab } from "./nav";
import { HomeScreen } from "./screens/HomeScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { YearScreen } from "./screens/YearScreen";
import { SettingsHub } from "./screens/SettingsHub";
import { SettingsScreen } from "./screens/SettingsScreen";
import { BackupScreen } from "./screens/BackupScreen";
import { DayEditor } from "./screens/DayEditor";
import { CalendarIcon, ChartIcon, HomeIcon } from "./components/Icons";

const TABS: Array<{ id: Tab; label: string; Icon: () => JSX.Element }> = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "year", label: "Year", Icon: ChartIcon },
];

function Shell() {
  const { loc, selectTab, back } = useNav();
  return (
    <div className="app">
      <main>
        {loc.page === "settings" && <SettingsHub />}
        {loc.page === "rates" && <SettingsScreen />}
        {loc.page === "backup" && <BackupScreen />}
        {!loc.page && loc.tab === "home" && <HomeScreen />}
        {!loc.page && loc.tab === "calendar" && <CalendarScreen />}
        {!loc.page && loc.tab === "year" && <YearScreen />}
      </main>
      {!loc.page && (
        <nav className="tabs" aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={loc.tab === id ? "active" : ""} onClick={() => selectTab(id)} aria-current={loc.tab === id ? "page" : undefined}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      )}
      {loc.day && <DayEditor date={loc.day} onClose={back} />}
    </div>
  );
}

export function App() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}
