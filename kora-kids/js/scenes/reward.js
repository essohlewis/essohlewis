/* reward.js — Écran de récompense : étoiles qui tombent, avatar qui danse.
   2 boutons uniquement : Rejouer (flèche) et Retour (maison). */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { avatar, icon, starSVG } from "../core/art.js";
import { onTap } from "../core/input.js";
import { reducedMotion } from "../core/a11y.js";
import { accFromProfile } from "./home.js";

export default function reward(scene, params, { go }) {
  scene.classList.add("reward");
  const { earned = 0, gameId, replay } = params;

  const profile = Store.getActive();
  const idx = Math.max(0, Store.getProfiles().findIndex(p => p.id === (profile && profile.id)));

  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  // Avatar qui danse.
  const dancer = document.createElement("div"); dancer.className = "dancer bob";
  dancer.appendChild(avatar(idx, profile ? accFromProfile(profile) : {}));
  stage.appendChild(dancer);

  // Compteur d'étoiles gagnées.
  const earnedEl = document.createElement("div"); earnedEl.className = "earned";
  earnedEl.appendChild(starSVG());
  const num = document.createElement("span"); num.textContent = "0"; earnedEl.appendChild(num);
  stage.appendChild(earnedEl);

  // Boutons.
  const actions = document.createElement("div"); actions.className = "actions";
  const replayBtn = bigRound("replay", "Rejouer", () => { Audio.play("tap"); go("game", { gameId }); });
  const homeBtn = bigRound("home", "Retour au village", () => { Audio.play("tap"); go("map"); });
  actions.append(replayBtn, homeBtn);
  stage.appendChild(actions);

  // Animation d'étoiles qui tombent + décompte.
  Audio.play("win");
  Audio.speak(earned > 0 ? bravo(earned) : "Bien joué !");
  let shown = 0;
  const rain = () => {
    if (shown >= earned) return;
    shown++;
    num.textContent = shown;
    Audio.play("star");
    if (!reducedMotion) dropStar(scene);
    setTimeout(rain, 260);
  };
  setTimeout(rain, 400);

  // Info déblocage d'accessoire.
  const next = Store.nextUnlock(profile);
  if (next) {
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:18px;color:var(--ink-soft);font-weight:700";
    hint.textContent = `Encore ${next.need - next.have} ⭐ pour un nouvel accessoire !`;
    stage.appendChild(hint);
  }
}

function bravo(n) {
  const mots = ["Bravo !", "Super !", "Génial !", "Magnifique !", "Bien joué !"];
  return mots[Math.min(n, mots.length) - 1] + " Tu as gagné " + n + (n > 1 ? " étoiles !" : " étoile !");
}

function bigRound(ic, label, fn) {
  const b = document.createElement("button");
  b.className = "btn-round primary big";
  b.setAttribute("aria-label", label);
  b.appendChild(icon(ic));
  onTap(b, fn);
  return b;
}

function dropStar(scene) {
  const s = document.createElement("div");
  s.className = "falling-star";
  s.style.left = (10 + Math.random() * 80) + "%";
  s.style.animationDuration = (1.4 + Math.random() * 1.2) + "s";
  s.appendChild(starSVG());
  scene.appendChild(s);
  setTimeout(() => s.remove(), 2800);
}
