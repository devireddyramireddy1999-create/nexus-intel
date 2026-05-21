import { AnimatePresence, motion } from "framer-motion";
import { Menu, Power, RotateCcw, Signal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatTime } from "@/lib/utils";
import type { NavItem, PageKey } from "@/types/intel";

type AppShellProps = {
  activePage: PageKey;
  children: React.ReactNode;
  navItems: NavItem[];
  onNavigate: (page: PageKey) => void;
  statusIcon: React.ElementType;
};

export function AppShell({ activePage, children, navItems, onNavigate, statusIcon: StatusIcon }: AppShellProps) {
  const [open, setOpen] = useState(false);

  const navigate = (page: PageKey) => {
    onNavigate(page);
    setOpen(false);
  };

  return (
    <div className="nexus-shell min-h-screen min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-black/45 backdrop-blur-xl lg:block">
        <Sidebar activePage={activePage} navItems={navItems} onNavigate={navigate} statusIcon={StatusIcon} />
      </aside>

      <header className="mobile-safe-top sticky top-0 z-30 border-b border-white/10 bg-background/72 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand statusIcon={StatusIcon} compact />
          <Button variant="secondary" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              className="h-full w-[min(88vw,20rem)] border-r border-white/10 bg-[#050a12] shadow-panel"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
            >
              <div className="flex h-16 items-center justify-between px-4">
                <Brand statusIcon={StatusIcon} compact />
                <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpen(false)}>
                  <X />
                </Button>
              </div>
              <Sidebar activePage={activePage} navItems={navItems} onNavigate={navigate} statusIcon={StatusIcon} mobile />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="nexus-app-main min-w-0 overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-72">
        <div className="mx-auto flex min-h-screen min-h-dvh w-full min-w-0 max-w-[1560px] flex-col px-3 py-4 sm:px-6 lg:px-8 lg:py-7">
          <TopStatus />
          {children}
          <InstallHint />
        </div>
      </main>

      <MobileBottomNav activePage={activePage} navItems={navItems} onNavigate={navigate} />
      <PhoneLandscapeGuard />
    </div>
  );
}

type SidebarProps = {
  activePage: PageKey;
  navItems: NavItem[];
  onNavigate: (page: PageKey) => void;
  statusIcon: React.ElementType;
  mobile?: boolean;
};

function Sidebar({ activePage, navItems, onNavigate, statusIcon: StatusIcon, mobile = false }: SidebarProps) {
  return (
    <div className={cn("flex h-full flex-col px-4 py-5", mobile && "h-[calc(100%-4rem)] py-3")}>
      {!mobile ? <Brand statusIcon={StatusIcon} /> : null}

      <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-muted-foreground">
          <span>System</span>
          <span className="flex items-center gap-1 text-nexus-good">
            <Signal className="size-3" />
            Live
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <p className="text-muted-foreground">Latency</p>
            <p className="font-semibold text-foreground">18 ms</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <p className="text-muted-foreground">Sources</p>
            <p className="font-semibold text-foreground">Mixed</p>
          </div>
        </div>
      </div>

      <nav className="mt-7 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activePage;
          return (
            <button
              key={item.key}
              className={cn(
                "group flex h-11 min-w-0 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition",
                "hover:bg-white/[0.07] hover:text-foreground",
                active && "bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_rgba(32,246,255,0.24)]",
              )}
              onClick={() => onNavigate(item.key)}
            >
              <Icon className={cn("size-4", active && "text-primary")} />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Separator className="mb-4" />
        <div className="rounded-lg border border-nexus-cyan/20 bg-nexus-cyan/5 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-nexus-cyan">
            <Power className="size-3" />
            Briefing Core
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Daily intelligence synthesis armed for live feeds.</p>
        </div>
      </div>
    </div>
  );
}

function Brand({ statusIcon: StatusIcon, compact = false }: { statusIcon: React.ElementType; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg border border-nexus-cyan/40 bg-nexus-cyan/10 text-nexus-cyan shadow-glow">
        <StatusIcon className="size-5" />
      </div>
      <div>
        <p className={cn("font-semibold tracking-[0.24em] text-foreground", compact ? "text-sm" : "text-base")}>NEXUS</p>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Intel</p>
      </div>
    </div>
  );
}

function TopStatus() {
  return (
    <div className="mb-5 hidden items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-nexus-good shadow-[0_0_12px_rgba(75,244,168,0.7)]" />
        Autonomous briefing node online
      </div>
      <div className="flex items-center gap-5 text-muted-foreground">
        <span>Live intelligence</span>
        <span>{formatTime()}</span>
      </div>
    </div>
  );
}

function InstallHint() {
  return (
    <p className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
      Install from Safari: Share → Add to Home Screen
    </p>
  );
}

function MobileBottomNav({ activePage, navItems, onNavigate }: Pick<AppShellProps, "activePage" | "navItems" | "onNavigate">) {
  const mobileItems = navItems.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#030711]/92 px-2 pb-[env(safe-area-inset-bottom)] shadow-panel backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activePage;

          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-medium leading-none text-muted-foreground transition",
                "hover:bg-white/[0.07] hover:text-foreground",
                active && "bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_rgba(32,246,255,0.18)]",
              )}
              onClick={() => onNavigate(item.key)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" />
              <span className="max-w-full truncate text-[0.68rem]">{getMobileLabel(item.label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PhoneLandscapeGuard() {
  return (
    <div className="phone-landscape-guard" role="status" aria-live="polite">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-nexus-cyan/35 bg-nexus-cyan/10 text-nexus-cyan shadow-glow">
          <RotateCcw className="size-6" />
        </div>
        <p className="text-xs uppercase tracking-[0.28em] text-nexus-cyan">Portrait Mode</p>
        <p className="mt-3 text-lg font-semibold text-foreground">Rotate your phone to portrait to use NEXUS Intel.</p>
      </div>
    </div>
  );
}

function getMobileLabel(label: string) {
  if (label === "Geopolitics") return "Geo";
  if (label === "AI & Tech") return "AI";
  return label;
}
