import cors from "cors";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { Website } from "../models/index.js";

const applyCors = cors({
  origin: true,
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Public-Widget-Id", "Authorization"],
  maxAge: 600
});

export const widgetCors: RequestHandler = (request, response, next) => {
  const origin = request.get("origin");
  const queryId = request.query.widgetId;
  const widgetId =
    typeof queryId === "string" ? queryId : request.get("x-public-widget-id");

  if (!origin || !widgetId || widgetId.length > 64) {
    next();
    return;
  }
  
  // TEMPORARY: Allow widget on any domain without origin validation
  // TODO: Re-enable origin validation in production
  void Website.findOne({
    publicWidgetId: widgetId,
    status: "active"
    // Origin check disabled - widget works on any domain
  })
    .select("_id")
    .then((website) => {
      if (!website) {
        next();
        return;
      }
      applyCors(request, response, next);
    })
    .catch(next);
}
