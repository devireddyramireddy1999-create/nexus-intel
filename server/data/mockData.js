const series = (base, moves) =>
  moves.map((move, index) => ({
    time: `${index + 7}:00`,
    value: Number((base + move).toFixed(2)),
  }));

export const marketAssets = [
  {
    symbol: "SPX",
    name: "S&P 500",
    value: "6,048.22",
    change: 0.38,
    category: "Index",
    note: "Breadth improving across industrials and software.",
    series: series(6040, [-22, -12, 4, 16, 11, 24, 8, 18]),
  },
  {
    symbol: "NDX",
    name: "Nasdaq",
    value: "19,740.16",
    change: 0.71,
    category: "Index",
    note: "Mega-cap AI infrastructure demand remains the driver.",
    series: series(19720, [-36, -20, 8, 30, 18, 52, 42, 64]),
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    value: "$104,820",
    change: 1.84,
    category: "Crypto",
    note: "Spot demand is firm while leverage stays contained.",
    series: series(104.2, [-1.5, -0.8, 0.3, 0.9, 1.2, 2.1, 1.8, 2.9]),
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    value: "$4,028",
    change: 1.12,
    category: "Crypto",
    note: "Layer-2 throughput and staking flows remain constructive.",
    series: series(4.0, [-0.08, -0.03, 0.01, 0.04, 0.02, 0.08, 0.07, 0.11]),
  },
  {
    symbol: "SOL",
    name: "Solana",
    value: "$218.40",
    change: -0.42,
    category: "Crypto",
    note: "App revenue is strong; short-term positioning is crowded.",
    series: series(219, [2.5, 1.8, 1.2, 0.6, -0.4, -1.1, -0.6, -0.9]),
  },
  {
    symbol: "XAU",
    name: "Gold",
    value: "$3,142",
    change: 0.27,
    category: "Commodity",
    note: "Real-rate sensitivity is offset by reserve diversification.",
    series: series(3138, [-6, -2, 3, 8, 6, 10, 5, 9]),
  },
  {
    symbol: "WTI",
    name: "Oil",
    value: "$78.10",
    change: -1.08,
    category: "Commodity",
    note: "Inventory builds are pressuring the front month.",
    series: series(79, [1.1, 0.7, 0.2, -0.4, -0.8, -1.2, -0.9, -1.0]),
  },
  {
    symbol: "USDINR",
    name: "USD/INR",
    value: "83.42",
    change: 0.09,
    category: "FX",
    note: "Rupee stability persists as carry remains attractive.",
    series: series(83.35, [-0.03, -0.01, 0.02, 0.04, 0.01, 0.06, 0.03, 0.07]),
  },
];

export const topStories = [
  {
    id: "world-1",
    section: "World",
    title: "Global policy desks prepare for a heavier central-bank week",
    summary: "Rates, inflation prints, and treasury issuance are converging into a tighter macro window.",
    impact: "Watch dollar liquidity, equity duration risk, and gold sensitivity.",
    sentiment: "caution",
    confidence: 83,
  },
  {
    id: "geo-1",
    section: "Geopolitics",
    title: "Shipping lanes remain the market's quiet pressure point",
    summary: "Insurance premiums and rerouting costs are still elevated across critical corridors.",
    impact: "Higher freight costs can reappear in energy, semis, and consumer goods.",
    sentiment: "risk",
    confidence: 79,
  },
  {
    id: "ai-1",
    section: "AI & Tech",
    title: "AI compute capex keeps shifting from pilots to production",
    summary: "Enterprises are moving budget toward inference, private data pipelines, and model governance.",
    impact: "The second-order beneficiaries are power, cooling, networking, and security.",
    sentiment: "bullish",
    confidence: 87,
  },
  {
    id: "crypto-1",
    section: "Crypto",
    title: "Crypto risk appetite improves, but funding stays disciplined",
    summary: "BTC and ETH are bid while alt rotation remains selective and event-driven.",
    impact: "Momentum is healthier when perp funding does not lead spot demand.",
    sentiment: "neutral",
    confidence: 74,
  },
];

export const riskSignals = [
  {
    label: "Global Risk",
    value: 64,
    posture: "elevated",
    description: "Macro catalysts and shipping pressure keep the risk surface active.",
  },
  {
    label: "Liquidity",
    value: 58,
    posture: "guarded",
    description: "Dollar funding is stable, but treasury supply can tighten conditions fast.",
  },
  {
    label: "Conflict",
    value: 71,
    posture: "elevated",
    description: "Regional flashpoints carry higher headline and commodity sensitivity.",
  },
  {
    label: "Cyber",
    value: 67,
    posture: "elevated",
    description: "AI-assisted phishing and supply-chain compromise attempts are rising.",
  },
];

export const geopoliticalWatch = [
  {
    region: "Indo-Pacific",
    title: "Naval signaling and export-control enforcement",
    signal: "Semiconductor supply chains should keep redundancy plans active.",
    severity: "High",
  },
  {
    region: "Middle East",
    title: "Energy corridors and maritime insurance",
    signal: "Risk premium can return quickly if transit data deteriorates.",
    severity: "High",
  },
  {
    region: "Europe",
    title: "Defense budgets and power-grid resilience",
    signal: "Procurement cycles favor cyber, drones, sensors, and grid hardware.",
    severity: "Medium",
  },
  {
    region: "South Asia",
    title: "FX stability and technology services demand",
    signal: "Watch USD/INR range, oil imports, and cross-border IT spending.",
    severity: "Medium",
  },
];

export const techSignals = [
  {
    label: "Compute",
    title: "Inference optimization becomes the real battleground",
    detail: "Latency, memory bandwidth, and energy use matter more as AI workloads leave demos.",
    velocity: 92,
  },
  {
    label: "Agents",
    title: "Enterprise agents move into workflow ownership",
    detail: "Procurement, support, finance ops, and dev tooling are adopting narrower but deeper agents.",
    velocity: 86,
  },
  {
    label: "Security",
    title: "Model risk governance is becoming budgeted infrastructure",
    detail: "Audit trails, retrieval controls, and human review layers are now board-level concerns.",
    velocity: 81,
  },
];

export const cryptoRadar = [
  {
    asset: "BTC",
    thesis: "Digital reserve bid stays intact above key moving averages.",
    flow: "ETF-style spot demand positive; leverage moderate.",
    risk: "Macro dollar spike would pressure duration-like crypto exposure.",
    score: 83,
  },
  {
    asset: "ETH",
    thesis: "Staking yield plus L2 activity supports relative strength.",
    flow: "Exchange reserves drifting lower; app fees improving.",
    risk: "Upgrade delays or regulatory headlines could cap upside.",
    score: 78,
  },
  {
    asset: "SOL",
    thesis: "Consumer crypto and high-throughput app activity remain the bull case.",
    flow: "On-chain revenues strong, but positioning is less clean.",
    risk: "Crowded longs and outage headlines remain reflexive risks.",
    score: 69,
  },
];

export const priorities = [
  {
    title: "Strategy Review",
    focus: "Refine the weekly decision log into three capital-allocation choices.",
    nextAction: "Draft the memo outline before the noon review window.",
    energy: 84,
    due: "Today",
  },
  {
    title: "AI Workflow",
    focus: "Turn repeated research prompts into a reusable briefing template.",
    nextAction: "Capture the inputs, scoring rubric, and output format.",
    energy: 76,
    due: "Today",
  },
  {
    title: "Health Baseline",
    focus: "Protect deep-work energy with a clean morning block.",
    nextAction: "Lock notifications and schedule the first movement break.",
    energy: 68,
    due: "Morning",
  },
];

export const sectorHeat = [
  { name: "AI Infrastructure", value: 91 },
  { name: "Semiconductors", value: 84 },
  { name: "Cybersecurity", value: 78 },
  { name: "Defense Tech", value: 74 },
  { name: "Energy", value: 57 },
  { name: "Banks", value: 52 },
  { name: "Consumer", value: 46 },
];

export const macroTimeline = [
  { name: "Asia", risk: 62, liquidity: 68, growth: 74 },
  { name: "Europe", risk: 66, liquidity: 57, growth: 58 },
  { name: "US", risk: 59, liquidity: 61, growth: 76 },
  { name: "Crypto", risk: 72, liquidity: 70, growth: 82 },
];
