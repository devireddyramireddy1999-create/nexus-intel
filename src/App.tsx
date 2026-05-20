import { useMemo, useState } from "react";
import { Activity, BrainCircuit, ChartCandlestick, Globe2, Home, Landmark, Settings, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AITechPage } from "@/pages/AITechPage";
import { CryptoPage } from "@/pages/CryptoPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { GeopoliticsPage } from "@/pages/GeopoliticsPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { PrioritiesPage } from "@/pages/PrioritiesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { NavItem, PageKey } from "@/types/intel";

const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "markets", label: "Markets", icon: ChartCandlestick },
  { key: "geopolitics", label: "Geopolitics", icon: Globe2 },
  { key: "crypto", label: "Crypto", icon: Activity },
  { key: "ai-tech", label: "AI & Tech", icon: BrainCircuit },
  { key: "priorities", label: "Priorities", icon: Target },
  { key: "settings", label: "Settings", icon: Settings },
];

function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");

  const page = useMemo(() => {
    switch (activePage) {
      case "markets":
        return <MarketsPage />;
      case "geopolitics":
        return <GeopoliticsPage />;
      case "crypto":
        return <CryptoPage />;
      case "ai-tech":
        return <AITechPage />;
      case "priorities":
        return <PrioritiesPage />;
      case "settings":
        return <SettingsPage />;
      case "dashboard":
      default:
        return <DashboardPage />;
    }
  }, [activePage]);

  return (
    <AppShell
      activePage={activePage}
      navItems={navItems}
      onNavigate={setActivePage}
      statusIcon={Landmark}
    >
      {page}
    </AppShell>
  );
}

export default App;
