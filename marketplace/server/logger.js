/**
 * logger.js — Journalisation structurée, sans dépendance.
 *
 * - Niveaux : debug < info < warn < error (filtrés par LOG_LEVEL, défaut info).
 * - Format : JSON une ligne (LOG_FORMAT=json, défaut hors dev) — exploitable par
 *   un agrégateur (Loki, ELK, CloudWatch…) ; ou « pretty » lisible en dev.
 * - Corrélation : un identifiant de requête (requestId) est propagé via
 *   AsyncLocalStorage et injecté automatiquement dans chaque log émis pendant
 *   le traitement d'une requête — on relie ainsi tous les logs d'un même appel.
 *
 * Middlewares fournis :
 *   • requestContext() : attribue/propage X-Request-Id + contexte de corrélation.
 *   • accessLog()      : une ligne par requête HTTP (méthode, route, statut, durée).
 *   • errorHandler()   : réponse d'erreur au format uniforme { ok:false, error, requestId }.
 */
"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("node:crypto");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LEVEL_NAME = { 10: "debug", 20: "info", 30: "warn", 40: "error" };

const store = new AsyncLocalStorage();

function threshold() {
  const l = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[l] || LEVELS.info;
}
function useJson() {
  const f = String(process.env.LOG_FORMAT || "").toLowerCase();
  if (f === "json") return true;
  if (f === "pretty") return false;
  return process.env.NODE_ENV === "production"; // JSON en prod, pretty ailleurs
}

const COLORS = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", reset: "\x1b[0m" };

function emit(levelNum, msg, fields) {
  if (levelNum < threshold()) return;
  const ctx = store.getStore() || {};
  const rec = Object.assign(
    { ts: new Date().toISOString(), level: LEVEL_NAME[levelNum], msg: String(msg) },
    ctx.requestId ? { requestId: ctx.requestId } : {},
    ctx.fields || {},
    fields || {}
  );
  if (useJson()) {
    process.stdout.write(JSON.stringify(rec) + "\n");
  } else {
    const c = COLORS[rec.level] || "";
    const rid = rec.requestId ? ` \x1b[90m[${rec.requestId}]\x1b[0m` : "";
    const extra = {};
    for (const k of Object.keys(rec)) if (!["ts", "level", "msg", "requestId"].includes(k)) extra[k] = rec[k];
    const tail = Object.keys(extra).length ? " " + JSON.stringify(extra) : "";
    process.stdout.write(`${c}${rec.level.toUpperCase().padEnd(5)}${COLORS.reset} ${rec.msg}${rid}${tail}\n`);
  }
}

const logger = {
  debug: (msg, fields) => emit(LEVELS.debug, msg, fields),
  info: (msg, fields) => emit(LEVELS.info, msg, fields),
  warn: (msg, fields) => emit(LEVELS.warn, msg, fields),
  error: (msg, fields) => emit(LEVELS.error, msg, fields),
  /** Exécute `fn` dans un contexte de corrélation (requestId + champs liés). */
  withContext: (context, fn) => store.run(context, fn),
  /** Ajoute des champs au contexte de corrélation courant (s'il existe). */
  bind: (fields) => { const ctx = store.getStore(); if (ctx) ctx.fields = Object.assign({}, ctx.fields, fields); },
  currentRequestId: () => (store.getStore() || {}).requestId || null,
};

/** Middleware : attribue/propage un X-Request-Id et ouvre le contexte de corrélation. */
function requestContext() {
  return (req, res, next) => {
    const incoming = req.get("X-Request-Id");
    const requestId = (incoming && /^[\w.-]{1,128}$/.test(incoming)) ? incoming : crypto.randomUUID();
    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);
    store.run({ requestId, fields: {} }, () => next());
  };
}

/** Middleware : une ligne de log par requête HTTP terminée. */
function accessLog() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durMs = Number(process.hrtime.bigint() - start) / 1e6;
      const level = res.statusCode >= 500 ? LEVELS.error : res.statusCode >= 400 ? LEVELS.warn : LEVELS.info;
      emit(level, "http", {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Math.round(durMs * 10) / 10,
        ip: req.ip,
      });
    });
    next();
  };
}

/** Gestionnaire d'erreurs terminal : réponse uniforme + log corrélé. */
function errorHandler() {
  // 4 arguments obligatoires pour qu'Express le reconnaisse comme error handler.
  return (err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err && (err.status || err.statusCode);
    const httpStatus = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
    logger.error("erreur non gérée", {
      path: req.originalUrl || req.url,
      method: req.method,
      status: httpStatus,
      err: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined,
    });
    if (res.headersSent) return next(err);
    const body = { ok: false, error: httpStatus >= 500 ? "Erreur interne du serveur." : (err.expose ? err.message : "Requête invalide."), requestId: req.id };
    res.status(httpStatus).json(body);
  };
}

module.exports = { logger, requestContext, accessLog, errorHandler, LEVELS };
