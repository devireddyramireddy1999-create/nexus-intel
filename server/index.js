import "./lib/env.js";
import express from "express";
import { withCache } from "./lib/cache.js";
import { generateBriefing } from "./services/briefingProvider.js";
import { getCryptoData } from "./services/cryptoProvider.js";
import { getMarkets } from "./services/marketProvider.js";
import { getNews } from "./services/newsProvider.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "localhost";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(express.json());
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", corsOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "nexus-intel-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/api/markets", async (_request, response, next) => {
  try {
    response.json(await withCache("markets", 60_000, getMarkets));
  } catch (error) {
    next(error);
  }
});

app.get("/api/crypto", async (_request, response, next) => {
  try {
    response.json(await withCache("crypto", 60_000, getCryptoData));
  } catch (error) {
    next(error);
  }
});

app.get("/api/news", async (_request, response, next) => {
  try {
    response.json(await withCache("news", 300_000, getNews));
  } catch (error) {
    next(error);
  }
});

app.post("/api/briefing", async (request, response, next) => {
  try {
    const mode = request.body?.mode ?? "standard";
    const command = request.body?.command ?? "Good morning";
    response.json(await withCache(`briefing:${mode}:${command.trim().toLowerCase()}`, 30_000, () => generateBriefing({ command, mode })));
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  response.status(500).json({
    error: {
      message: error instanceof Error ? error.message : "Unexpected backend error.",
    },
  });
});

const server = app.listen(port, host, () => {
  console.log(`NEXUS Intel backend listening on http://${host}:${port}`);
});

server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
