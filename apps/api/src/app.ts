import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { widgetCors } from "./middleware/widget-cors.js";
// Rate limiters temporarily disabled
// import {
//   loginRateLimit,
//   messageSubmissionRateLimit,
//   passwordResetRateLimit,
//   emailVerificationRateLimit,
//   registrationRateLimit,
//   widgetInitializationRateLimit
// } from "./security/rate-limits.js";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { workspacesRouter } from "./routes/workspaces.js";
import { widgetRouter } from "./routes/widget.js";

export const app = express();

app.disable("x-powered-by");

// Security headers for non-widget routes only (X-Frame-Options would block embedding)
const securityHeaders: RequestHandler = (request, response, next) => {
  // Skip strict security headers for widget routes (needs to be embedded)
  if (request.path.startsWith('/widget')) {
    next();
    return;
  }
  
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
  if (env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

app.use(securityHeaders);

// Widget CORS must come BEFORE main CORS to handle widget requests
app.use("/widget", widgetCors);

// Widget.js script needs permissive CORS (already has headers in route handler below)

// Main CORS for dashboard/admin routes only (skip widget routes)
app.use((request, response, next) => {
  // Skip main CORS for widget routes - they have their own CORS
  if (request.path.startsWith('/widget') || request.path === '/widget.js') {
    next();
    return;
  }
  
  cors({
    origin: (origin, callback) => {
      if (origin === env.WEB_ORIGIN) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    maxAge: 600
  })(request, response, next);
});

// Rate limiters temporarily disabled for initial deployment
// app.use("/auth/register", registrationRateLimit);
// app.use("/auth/verify-email", emailVerificationRateLimit);
// app.use("/auth/resend-verification", emailVerificationRateLimit);
// app.use("/auth/login", loginRateLimit);
// app.use("/auth/password-reset", passwordResetRateLimit);
// app.use("/widget/init", widgetInitializationRateLimit);
// app.use("/widget/conversation", widgetInitializationRateLimit);
// app.use("/widget/profile", messageSubmissionRateLimit);
// app.use("/widget/:conversationId/messages", messageSubmissionRateLimit);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
// Diagnostic endpoint to check filesystem
app.get("/debug/paths", async (request, response) => {
  try {
    const { readdir, stat } = await import('fs/promises');
    const currentDir = dirname(fileURLToPath(import.meta.url));
    
    const checkPath = async (path: string) => {
      try {
        const stats = await stat(path);
        return { path, exists: true, isDirectory: stats.isDirectory() };
      } catch {
        return { path, exists: false };
      }
    };
    
    const info = {
      __dirname: currentDir,
      cwd: process.cwd(),
      checks: await Promise.all([
        checkPath(resolve(currentDir, "../../../widget")),
        checkPath(resolve(currentDir, "../../../widget/dist")),
        checkPath(resolve(currentDir, "../../../widget/dist/widget.js")),
        checkPath(resolve(currentDir, "../../widget")),
        checkPath(resolve(currentDir, "../../widget/dist")),
        checkPath(resolve(currentDir, "../../widget/dist/widget.js")),
      ])
    };
    
    response.json(info);
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

// Serve widget script with correct MIME type and CORS headers
app.get("/widget.js", async (request, response) => {
  try {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    
    // Import fs dynamically
    const { readFile } = await import('fs/promises');
    const widgetPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../apps/widget/dist/widget.js");
    
    const content = await readFile(widgetPath, 'utf-8');
    response.send(content);
  } catch (error) {
    logger.error({ err: error }, "Failed to serve widget.js");
    response.status(500).send("// Widget file not found");
  }
});
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/workspaces", workspacesRouter);
app.use("/widget", widgetRouter);
app.use(errorHandler);
