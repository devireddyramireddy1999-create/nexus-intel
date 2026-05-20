import { cryptoRadar, geopoliticalWatch, priorities, riskSignals, techSignals } from "../data/mockData.js";
import { getMarkets } from "./marketProvider.js";
import { getNews } from "./newsProvider.js";

export async function generateBriefing({ command = "Good morning", mode = "standard" }) {
  const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized !== "good morning") {
    throw new Error("Unsupported briefing command.");
  }

  const [news, markets] = await Promise.all([getNews(), getMarkets()]);
  const strongest = [...markets.assets].sort((a, b) => b.change - a.change)[0];
  const weakest = [...markets.assets].sort((a, b) => a.change - b.change)[0];
  const topStory = [...news.newsItems].sort((a, b) => b.importanceScore - a.importanceScore)[0];
  const globalRisk = riskSignals[0];
  const generatedAt = formatTime();

  const sections = [
    {
      title: "Greeting",
      items: ["Good morning. NEXUS Intel is online and your daily briefing is ready."],
    },
    {
      title: "Executive Summary",
      items: [
        `The morning risk posture is ${globalRisk.posture} at ${globalRisk.value}/100. ${topStory.title} is the top intelligence item. ${strongest.name} leads at ${formatSigned(strongest.change)}, while ${weakest.name} is the weakest read at ${formatSigned(weakest.change)}.`,
      ],
    },
    {
      title: "World Situation",
      items: [news.newsItems.filter((item) => item.category === "world").map((item) => `${item.source}: ${item.summary} ${item.marketImpact}`).join(" ")],
    },
    {
      title: "Geopolitical Risk",
      items: [
        `${geopoliticalWatch[0].region}: ${geopoliticalWatch[0].signal}`,
        `${geopoliticalWatch[1].region}: ${geopoliticalWatch[1].signal}`,
      ],
    },
    {
      title: "Market Snapshot",
      items: [
        `${strongest.name} is the positive signal at ${formatSigned(strongest.change)}. ${weakest.name} is the pressure point at ${formatSigned(weakest.change)}. Keep liquidity and positioning on screen before adding risk.`,
      ],
    },
    {
      title: "Crypto Watch",
      items: [
        `${cryptoRadar[0].asset}: ${cryptoRadar[0].flow} ${cryptoRadar[0].risk}`,
        `${cryptoRadar[1].asset}: ${cryptoRadar[1].flow} ${cryptoRadar[1].risk}`,
      ],
    },
    {
      title: "AI & Tech Signals",
      items: techSignals.slice(0, mode === "quick" ? 1 : 3).map((signal) => `${signal.label}: ${signal.detail}`),
    },
    {
      title: "Personal Priority Recommendation",
      items: [`${priorities[0].title}: ${priorities[0].nextAction} Protect the first deep-work block before reacting to markets or headlines.`],
    },
    {
      title: "Action List For The Day",
      items: [
        "Keep position sizing conservative until the risk picture clears.",
        "Draft the strategy review memo before opening new research loops.",
        "Keep liquidity and geopolitics visible while sizing market exposure.",
        "Convert recurring AI research prompts into a reusable briefing template.",
      ],
    },
  ];

  if (mode === "deep") {
    sections.splice(1, 0, {
      title: "Decision Lens",
      items: [
        "Favor signals that combine price confirmation with clean positioning; fade crowded narratives without fresh flow.",
        "Treat geopolitics as a volatility amplifier. Translate each headline into supply, liquidity, or confidence impact.",
        "Keep today's personal system pointed at one memo-quality output before opening new research loops.",
      ],
    });
  }

  return {
    mode,
    generatedAt,
    headline:
      mode === "quick"
        ? "Morning signal: stay constructive, but keep liquidity and geopolitics on the main screen."
        : "Morning signal: AI-led risk appetite is intact, while macro and shipping risk argue for disciplined exposure.",
    sections: mode === "quick" ? sections.slice(0, 5) : sections,
  };
}

function formatSigned(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
