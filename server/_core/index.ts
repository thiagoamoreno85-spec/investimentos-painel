import "dotenv/config";
import express from "express";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { MAX_BODY_SIZE } from "../../shared/constants";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { newsRefreshHandler } from "../scheduled/newsRefreshHandler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

  // Rate limiting
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
  });
  app.use(globalLimiter);

  const externalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Limite de consultas externas atingido. Aguarde 1 minuto." },
  });
  // portfolio.refreshPrices é o procedure real de atualização de cotações
  app.use("/api/trpc/portfolio.refreshPrices", externalApiLimiter);
  app.use("/api/trpc/market.getMarketData", externalApiLimiter);
  app.use("/api/trpc/market.getGlobalIndices", externalApiLimiter);

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Limite de análises IA atingido. Aguarde 1 minuto." },
  });
  app.use("/api/trpc/buyAdvisor", aiLimiter);
  app.use("/api/trpc/news.analyzeNews", aiLimiter);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Scheduled Heartbeat endpoints (must be before Vite/static fallthrough)
  app.post("/api/scheduled/news-refresh", newsRefreshHandler);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
