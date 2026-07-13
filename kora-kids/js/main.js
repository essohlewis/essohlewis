/* main.js — Point d'entrée : bootstrap, enregistrement des scènes, PWA, minuteur. */

import Router from "./core/router.js";
import Audio from "./core/audio.js";
import Store from "./core/storage.js";
import { applyTapSize } from "./core/a11y.js";
import { sfxManifest, SFX } from "./core/assets.js";

import home from "./scenes/home.js";
import map from "./scenes/map.js";
import parent from "./scenes/parent.js";
import reward from "./scenes/reward.js";
import avatarScene from "./scenes/avatar.js";

// Modules de jeux (chargés statiquement — tout est en cache hors-ligne).
import animaux from "./games/animaux.js";
import formes from "./games/formes.js";
import puzzle from "./games/puzzle.js";
import alphabet from "./games/alphabet.js";
import memory from "./games/memory.js";
import marche from "./games/marche.js";

const GAMES = { animaux, formes, puzzle, alphabet, memory, marche };

/* ---------- Enregistrement des scènes ---------- */
Router.register("home", home);
Router.register("map", map);
Router.register("parent", parent);
Router.register("reward", reward);
Router.register("avatar", avatarScene);

// Route générique "game" : dispatche vers le bon mini-jeu.
Router.register("game", (scene, params, ctx) => {
  const g = GAMES[params.gameId];
  if (!g) return ctx.go("map");
  return g(scene, params, ctx);
});

/* ---------- Réglages initiaux ---------- */
function applySettings() {
  const s = Store.getSettings();
  document.documentElement.dataset.theme = s.sombre ? "sombre" : "";
  Audio.setVolumes({ voix: s.volumeVoix, sfx: s.volumeSfx });
  if (s.muted) Audio.setMuted(true);
  const active = Store.getActive();
  applyTapSize(active ? active.palier : "petit");
}

/* ---------- Débloque l'audio au premier tap (iOS/Android) ---------- */
function armAudioUnlock() {
  const unlock = () => {
    Audio.unlock();
    sfxManifest(SFX).then(m => Audio.load(m));   // vrais effets .mp3 si déclarés, sinon synthèse
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: false });
}

/* ---------- Minuteur de session : flush au masquage ---------- */
function armSessionTracking() {
  Router.startSessionTimer();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Router.flushSessionMinutes();
  });
  window.addEventListener("pagehide", () => Router.flushSessionMinutes());
}

/* ---------- Service Worker (cache-first) + écran d'installation ---------- */
async function registerSW() {
  const loader = document.getElementById("loader");
  const fill = document.getElementById("loaderFill");
  const txt = document.getElementById("loaderTxt");

  const hide = () => { loader.classList.add("hide"); setTimeout(() => loader.remove(), 500); };

  if (!("serviceWorker" in navigator)) {
    // Pas de SW (ex. ouverture via file://) — on démarre quand même.
    fill.style.width = "100%"; txt.textContent = "Prêt !"; setTimeout(hide, 300);
    return;
  }
  try {
    // Petite animation de progression pendant l'installation.
    let p = 0;
    const tick = setInterval(() => { p = Math.min(90, p + 12); fill.style.width = p + "%"; txt.textContent = `Installation… ${p} %`; }, 120);
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    clearInterval(tick);
    fill.style.width = "100%"; txt.textContent = "Prêt !";
    setTimeout(hide, 400);
  } catch (e) {
    fill.style.width = "100%"; txt.textContent = "Prêt !"; setTimeout(hide, 400);
  }
}

/* ---------- Démarrage ---------- */
applySettings();
armAudioUnlock();
armSessionTracking();
Router.go("home");
registerSW();
