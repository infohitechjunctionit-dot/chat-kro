import cors from "cors";
import type { RequestHandler } from "express";

// Completely open CORS for widget - works on any domain with any widget ID
const applyCors = cors({
  origin: true, // Allow all origins
  credentials: false, // No credentials needed
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Public-Widget-Id", "Authorization"],
  maxAge: 600
});

export const widgetCors: RequestHandler = (request, response, next) => {
  // Apply permissive CORS to all widget requests
  applyCors(request, response, next);
};
