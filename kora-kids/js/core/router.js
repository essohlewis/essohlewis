/* router.js — Routeur de scènes (sans hash, état interne).
   Max 2 niveaux de profondeur : Accueil → Carte → Jeu.
   Gère aussi le minuteur de session et le bouton son global. */

import Audio from "./audio.js";
import Store from "./storage.js";
import { icon } from "./art.js";
import { onTap } from "./input.js";
import { announce } from "./a11y.js";

const app = () => document.getElementById("app");
const routes = new Map();
let current = null;
let currentCleanup = null;

/* Minuteur de session */
let sessionStart = Date.now();
let sessionTimer = null;

export function register(name, factory) { routes.set(name, factory); }

export async function go(name, params = {}) {
  const factory = routes.get(name);
  if (!factory) { console.warn("route inconnue", name); return; }

  Audio.stopAll();

  // Nettoie la scène précédente.
  if (currentCleanup) { try { currentCleanup(); } catch (_) {} currentCleanup = null; }
  const old = app().querySelector(".scene.is-active");
  if (old) { old.classList.remove("is-active"); setTimeout(() => old.remove(), 240); }

  // Construit la nouvelle scène.
  const scene = document.createElement("section");
  scene.className = "scene";
  scene.dataset.route = name;
  app().appendChild(scene);

  const result = await factory(scene, params, { go, back }) || {};
  currentCleanup = result.cleanup || null;

  // Transition d'entrée.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scene.classList.add("is-active"));
  });
  Audio.play("transition");
  current = { name, params };
}

/* Retour contextuel (un seul niveau : les jeux reviennent à la carte). */
export function back() {
  if (!current) return go("home");
  if (current.name === "map" || current.name === "home") return go("home");
  return go("map");
}

/* ---------- En-tête réutilisable (retour + titre + étoiles + son) ---------- */
export function buildHead(scene, { title = "", back: showBack = true, stars = null, onBack } = {}) {
  const head = document.createElement("div");
  head.className = "scene-head";

  if (showBack) {
    const b = document.createElement("button");
    b.className = "btn-round"; b.setAttribute("aria-label", "Retour");
    b.appendChild(icon("back"));
    onTap(b, () => { Audio.play("tap"); (onBack || back)(); });
    head.appendChild(b);
  }

  if (title) {
    const h = document.createElement("h1");
    h.className = "scene-title"; h.textContent = title;
    head.appendChild(h);
  }

  const spacer = document.createElement("div");
  spacer.className = "spacer"; head.appendChild(spacer);

  if (stars != null) {
    const sc = document.createElement("div");
    sc.className = "star-count";
    sc.appendChild(icon("star"));
    const n = document.createElement("span"); n.textContent = stars;
    sc.appendChild(n);
    sc.dataset.role = "starcount";
    head.appendChild(sc);
  }

  head.appendChild(soundToggle());
  scene.appendChild(head);
  return head;
}

/* Bouton son global (coupe tout — classe, bus, sieste). */
export function soundToggle() {
  const b = document.createElement("button");
  b.className = "btn-round small";
  const render = () => {
    b.innerHTML = "";
    b.appendChild(icon(Audio.isMuted() ? "mute" : "sound"));
    b.setAttribute("aria-label", Audio.isMuted() ? "Activer le son" : "Couper le son");
  };
  render();
  onTap(b, () => {
    const nowMuted = !Audio.isMuted();
    Audio.setMuted(nowMuted);
    Store.setSettings({ muted: nowMuted });
    if (!nowMuted) Audio.play("tap");
    render();
  });
  return b;
}

/* ---------- Minuteur de session ---------- */
export function startSessionTimer() {
  stopSessionTimer();
  sessionStart = Date.now();
  const limit = (Store.getSettings().minuteur || 30) * 60 * 1000;
  sessionTimer = setInterval(() => {
    if (Date.now() - sessionStart >= limit) {
      endSession();
    }
  }, 15000);
}
export function stopSessionTimer() { if (sessionTimer) clearInterval(sessionTimer); sessionTimer = null; }

export function flushSessionMinutes() {
  const mins = Math.round((Date.now() - sessionStart) / 60000);
  if (mins > 0) { Store.logSession(mins); sessionStart = Date.now(); }
}

function endSession() {
  stopSessionTimer();
  flushSessionMinutes();
  Audio.stopAll();
  const el = document.getElementById("sessionEnd");
  el.classList.remove("hide");
  announce("C'est fini pour aujourd'hui");
}

export default { register, go, back, buildHead, startSessionTimer, stopSessionTimer, flushSessionMinutes };
