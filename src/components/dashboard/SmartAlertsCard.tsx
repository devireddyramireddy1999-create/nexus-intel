import { useEffect, useMemo, useState, type ElementType } from "react";
import { AlertTriangle, BellRing, ChevronDown, ChevronUp, History, Radar, Trash2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalTime } from "@/lib/utils";
import {
  getCachedCryptoData,
  getCachedMarketsData,
  getCachedNewsData,
  getCryptoData,
  getMarketsData,
  getNewsData,
} from "@/services/backendApi";
import {
  clearSmartAlertHistory,
  evaluateSmartAlerts,
  getMuteLowAlerts,
  getSmartAlertHistory,
  setMuteLowAlerts,
} from "@/services/alertEngineService";
import { buildNexusJudgment } from "@/services/judgmentService";
import { getPersonalContext, PERSONAL_CONTEXT_EVENT } from "@/services/personalContextService";
import type {
  ChangeInsight,
  IntelligenceStory,
  MarketAsset,
  PersonalContext,
  RiskSignal,
  SmartAlert,
  SmartAlertSeverity,
} from "@/types/intel";

type SmartAlertsCardProps = {
  changeInsights?: ChangeInsight[];
};

type AlertInputs = {
  cryptoAssets: MarketAsset[];
  marketAssets: MarketAsset[];
  riskSignals: RiskSignal[];
  stories: IntelligenceStory[];
};

export function SmartAlertsCard({ changeInsights = [] }: SmartAlertsCardProps) {
  const [inputs, setInputs] = useState<AlertInputs>(() => getCachedAlertInputs());
  const [context, setContext] = useState<PersonalContext>(() => getPersonalContext());
  const [activeAlerts, setActiveAlerts] = useState<SmartAlert[]>([]);
  const [history, setHistory] = useState<SmartAlert[]>(() => getSmartAlertHistory());
  const [loading, setLoading] = useState(true);
  const [mutedLow, setMutedLow] = useState(() => getMuteLowAlerts());
  const [showHistory, setShowHistory] = useState(false);
  const judgment = useMemo(
    () => buildNexusJudgment({ ...inputs, changeInsights }),
    [changeInsights, inputs],
  );

  useEffect(() => {
    const handlePersonalContext = () => setContext(getPersonalContext());

    window.addEventListener(PERSONAL_CONTEXT_EVENT, handlePersonalContext);
    return () => window.removeEventListener(PERSONAL_CONTEXT_EVENT, handlePersonalContext);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([getMarketsData(), getCryptoData(), getNewsData()])
      .then(([marketResponse, cryptoResponse, newsResponse]) => {
        if (!active) return;

        setInputs({
          cryptoAssets: cryptoResponse.data.assets,
          marketAssets: marketResponse.data.assets,
          riskSignals: newsResponse.data.riskSignals,
          stories: newsResponse.data.stories,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const result = evaluateSmartAlerts({
      ...inputs,
      changeInsights,
      judgment,
      personalContext: context,
    });

    setActiveAlerts(result.activeAlerts);
    setHistory(result.history);
    setMutedLow(result.mutedLow);
  }, [changeInsights, context, inputs, judgment, mutedLow]);

  const toggleMuteLow = () => {
    const nextValue = !mutedLow;
    setMuteLowAlerts(nextValue);
    setMutedLow(nextValue);
  };

  const clearAlerts = () => {
    clearSmartAlertHistory();
    setActiveAlerts([]);
    setHistory([]);
  };

  const visibleAlerts = activeAlerts.slice(0, 3);
  const hasMoreActive = activeAlerts.length > visibleAlerts.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <BellRing className="size-4" />
              Smart Alerts
            </div>
            <CardTitle>Alert Engine V1</CardTitle>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant={loading ? "secondary" : getSummaryBadgeVariant(activeAlerts)}>
              {loading ? "Watching" : activeAlerts.length ? `${activeAlerts.length} active` : "No urgent alert"}
            </Badge>
            {mutedLow ? <Badge variant="secondary">Low muted</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-3">
          {visibleAlerts.length ? (
            visibleAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          ) : (
            <div className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Radar className="size-4 text-nexus-champagne" />
                No urgent alerts
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Nothing needs immediate action. Watch triggers, keep the read directional, and focus on execution.
              </p>
            </div>
          )}

          {hasMoreActive ? (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {activeAlerts.length - visibleAlerts.length} more active alert{activeAlerts.length - visibleAlerts.length === 1 ? "" : "s"} in history.
            </p>
          ) : null}

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowHistory((value) => !value)}>
                <History />
                History
                {showHistory ? <ChevronUp /> : <ChevronDown />}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={toggleMuteLow}>
                <VolumeX />
                {mutedLow ? "Show Low" : "Mute Low"}
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAlerts}>
              <Trash2 />
              Clear Alerts
            </Button>
          </div>

          {showHistory ? (
            <div className="grid min-w-0 gap-2 rounded-lg border border-primary/[0.12] bg-[#080808]/70 p-3">
              {history.length ? (
                history.slice(0, 6).map((alert) => <HistoryRow key={alert.id} alert={alert} />)
              ) : (
                <p className="text-sm text-muted-foreground">No alert history yet.</p>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: SmartAlert }) {
  return (
    <div className="min-w-0 rounded-lg border border-primary/[0.16] bg-[#0a0a0a]/75 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <AlertIcon severity={alert.severity} />
            <p className="break-words text-sm font-semibold text-foreground">{alert.title}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{alert.type}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={getSeverityBadgeVariant(alert.severity)}>{alert.severity}</Badge>
          <span className="text-xs text-muted-foreground">{formatLocalTime(alert.createdAt)}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">
        <AlertDetail label="Why" value={alert.why} />
        <AlertDetail label="Meaning" value={alert.meaning} />
        <AlertDetail label="Action" value={alert.action} strong />
      </div>
    </div>
  );
}

function AlertDetail({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={strong ? "break-words text-sm font-semibold text-foreground" : "break-words text-sm text-muted-foreground"}>{value}</p>
    </div>
  );
}

function HistoryRow({ alert }: { alert: SmartAlert }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-primary/[0.1] bg-[#050505]/80 px-3 py-2">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-foreground">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{formatLocalTime(alert.createdAt)} / {alert.type}</p>
      </div>
      <Badge variant={getSeverityBadgeVariant(alert.severity)}>{alert.severity}</Badge>
    </div>
  );
}

function AlertIcon({ severity }: { severity: SmartAlertSeverity }) {
  const Icon: ElementType = severity === "Critical" || severity === "High" ? AlertTriangle : BellRing;

  return <Icon className="size-4 shrink-0 text-nexus-champagne" />;
}

function getSummaryBadgeVariant(alerts: SmartAlert[]) {
  const topSeverity = alerts.map((alert) => alert.severity).sort((a, b) => getSeverityRank(b) - getSeverityRank(a))[0];
  return topSeverity ? getSeverityBadgeVariant(topSeverity) : "success";
}

function getSeverityBadgeVariant(severity: SmartAlertSeverity) {
  if (severity === "Critical" || severity === "High") return "danger";
  if (severity === "Medium") return "warning";
  if (severity === "Low") return "secondary";
  return "default";
}

function getSeverityRank(severity: SmartAlertSeverity) {
  if (severity === "Critical") return 4;
  if (severity === "High") return 3;
  if (severity === "Medium") return 2;
  return 1;
}

function getCachedAlertInputs(): AlertInputs {
  const marketResponse = getCachedMarketsData();
  const cryptoResponse = getCachedCryptoData();
  const newsResponse = getCachedNewsData();

  return {
    cryptoAssets: cryptoResponse?.data.assets ?? [],
    marketAssets: marketResponse?.data.assets ?? [],
    riskSignals: newsResponse?.data.riskSignals ?? [],
    stories: newsResponse?.data.stories ?? [],
  };
}
