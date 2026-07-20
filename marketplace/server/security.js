/**
 * security.js — Durcissement production (sans dépendance externe).
 *
 * Fournit des middlewares Express :
 *  - securityHeaders : en-têtes de sécurité (CSP, HSTS, X-Frame-Options, …)
 *  - cors            : CORS restreint à une liste d'origines autorisées
 *  - originGuard     : défense anti-CSRF (vérification d'origine sur POST/PUT/…)
 *  - rateLimit       : limitation de débit en mémoire (fenêtre glissante fixe)
 *  - httpsRedirect   : redirection HTTP→HTTPS derrière un proxy TLS
 *
 * Configuration par variables d'environnement :
 *  - ALLOWED_ORIGINS : origines autorisées (séparées par des virgules)
 *  - FORCE_HTTPS     : "1" pour rediriger vers HTTPS (proxy)
 *  - CSP_REPORT_ONLY : "1" pour poser la CSP en mode rapport (sans bloquer)
 */
"use strict";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function hostOf(url) { try { return new URL(url).host; } catch (e) { return ""; } }

/* ------------------------- En-têtes de sécurité -------------------------- */
function securityHeaders() {
  // CSP volontairement compatible avec les pages existantes (styles/scripts en
  // ligne des pages Tailwind). À durcir ensuite avec des nonces si besoin.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  const cspHeader = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  return function (req, res, next) {
    res.setHeader(cspHeader, csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    // HSTS seulement sur connexion sécurisée (évite de bloquer en HTTP local).
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}

/* ------------------------------- CORS ------------------------------------ */
function cors() {
  return function (req, res, next) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token, X-Shop-Token");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204); // préflight
    next();
  };
}

/* -------------------- Anti-CSRF (vérification d'origine) ----------------- */
// L'API s'authentifie par jeton d'en-tête (Bearer / X-Admin-Token), donc n'est
// pas vulnérable au CSRF classique (basé cookie). En défense en profondeur, on
// refuse toute requête mutante dont l'origine est connue mais non autorisée.
function originGuard() {
  const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
  return function (req, res, next) {
    if (SAFE.has(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // pas de navigateur (curl, app mobile, S2S)
    const oHost = hostOf(origin);
    if (oHost && oHost === req.headers.host) return next();      // même origine
    if (ALLOWED_ORIGINS.includes(origin)) return next();          // origine autorisée
    return res.status(403).json({ ok: false, error: "Origine non autorisée." });
  };
}

/* --------------------------- Limitation de débit ------------------------- */
// Fenêtre fixe en mémoire, par IP. Suffisant pour un back-office ; pour un
// cluster, remplacer par un magasin partagé (Redis).
function rateLimit(opts) {
  const windowMs = (opts && opts.windowMs) || 60000;
  const max = (opts && opts.max) || 300;
  const name = (opts && opts.name) || "rl";
  const hits = new Map(); // clé -> { count, resetAt }
  // Purge périodique des entrées expirées.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs);
  if (timer.unref) timer.unref();

  return function (req, res, next) {
    const key = name + ":" + (req.ip || req.connection.remoteAddress || "?");
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.resetAt <= now) { e = { count: 0, resetAt: now + windowMs }; hits.set(key, e); }
    e.count++;
    const remaining = Math.max(0, max - e.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    if (e.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: "Trop de requêtes. Réessayez dans un instant." });
    }
    next();
  };
}

/* ---------------------------- Redirection HTTPS -------------------------- */
function httpsRedirect() {
  return function (req, res, next) {
    if (process.env.FORCE_HTTPS !== "1") return next();
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    return res.redirect(308, "https://" + req.headers.host + req.originalUrl);
  };
}

module.exports = { securityHeaders, cors, originGuard, rateLimit, httpsRedirect, ALLOWED_ORIGINS };
