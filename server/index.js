import "./lib/env.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { getAccessStatus, issueAccessToken, requireAppAccess } from "./lib/accessGate.js";
import { withCache } from "./lib/cache.js";
import { generateBriefing } from "./services/briefingProvider.js";
import { getCryptoData } from "./services/cryptoProvider.js";
import { getMarkets } from "./services/marketProvider.js";
import { getNews } from "./services/newsProvider.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? (isProduction ? "0.0.0.0" : "localhost");
const corsOrigin = process.env.CORS_ORIGIN ?? (isProduction ? "" : "http://localhost:5173");
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistPath = path.resolve(currentDir, "../dist");
const clientIndexPath = path.join(clientDistPath, "index.html");

app.use(express.json());
app.use((request, response, next) => {
  if (corsOrigin) {
    response.setHeader("Access-Control-Allow-Origin", corsOrigin);
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-NEXUS-ACCESS");
  }

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

app.get("/api/access/status", (request, response) => {
  response.json(getAccessStatus(request));
});

app.post("/api/access", (request, response) => {
  try {
    const status = getAccessStatus(request);

    if (!status.required) {
      response.json({
        authorized: true,
        required: false,
        token: null,
      });
      return;
    }

    const token = issueAccessToken(String(request.body?.code ?? ""));

    response.json({
      authorized: true,
      required: true,
      token,
    });
  } catch {
    response.status(401).json({
      authorized: false,
      error: {
        message: "Invalid access code.",
      },
      required: true,
    });
  }
});

app.use("/api", requireAppAccess);

app.get("/api/markets", async (_request, response, next) => {
  try {
    response.json(await withCache("markets", 60_000, getMarkets));
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

app.get("/api/crypto", async (_request, response, next) => {
  try {
    response.json(await withCache("crypto", 60_000, getCryptoData));
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

app.use("/api", (request, response) => {
  response.status(404).json({
    error: {
      message: `API route not found: ${request.path}`,
    },
  });
});

if (isProduction && existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(clientIndexPath);
  });
}

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
