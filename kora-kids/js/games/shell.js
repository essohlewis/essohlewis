/* shell.js — Utilitaires partagés par les mini-jeux :
   en-tête, bulle de consigne (icône + voix), suivi d'étoiles, fin de manche. */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { icon } from "../core/art.js";
import { onTap } from "../core/input.js";
import Router from "../core/router.js";
import { announce } from "../core/a11y.js";

export function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export const pick = (a, n) => shuffle(a).slice(0, n);
export const rand = (a) => a[Math.floor(Math.random() * a.length)];

/* En-tête standard d'un mini-jeu avec compteur d'étoiles vivant. */
export function gameHead(scene, title, go) {
  const head = Router.buildHead(scene, { title, onBack: () => go("map"), stars: 0 });
  const counter = head.querySelector('[data-role="starcount"] span');
  let stars = 0;
  return {
    head,
    addStar(n = 1) { stars += n; counter.textContent = stars; },
    get stars() { return stars; }
  };
}

/* Bulle de consigne : icône haut-parleur (rejoue la voix) + texte.
   Toujours insérée en tête du conteneur pour être visible au-dessus du jeu. */
export function prompt(container, text, { speak = true, icon: showSpeaker = true } = {}) {
  let bubble = container.querySelector(".prompt-bubble");
  if (!bubble) {
    bubble = document.createElement("div"); bubble.className = "prompt-bubble";
    if (showSpeaker) {
      const sb = document.createElement("button");
      sb.className = "speak-btn"; sb.setAttribute("aria-label", "Écouter la consigne");
      sb.appendChild(icon("sound"));
      onTap(sb, () => Audio.speak(bubble.dataset.say || text));
      bubble.appendChild(sb);
    }
    const span = document.createElement("span"); span.className = "ptxt"; bubble.appendChild(span);
    container.insertBefore(bubble, container.firstChild);
  }
  bubble.dataset.say = text;
  bubble.querySelector(".ptxt").textContent = text;
  if (speak) Audio.speak(text);
  announce(text);
  return bubble;
}

/* Retour standard : bonne réponse. */
export function correct(el, name) {
  el.classList.add("correct");
  Audio.play("success");
  if (name) Audio.speak(name);
  Store.getActive() && Audio.play("star");
}

/* Retour standard : réponse à revoir (jamais punitif). */
export function soft(el) {
  el.classList.add("wrong");
  Audio.play("neutral");
  setTimeout(() => el.classList.remove("wrong"), 500);
}

/* Termine une manche : enregistre les étoiles puis va à l'écran de récompense. */
export function finishRound(go, gameId, earned) {
  if (earned > 0) Store.addStars(gameId, earned);
  setTimeout(() => go("reward", { earned, gameId }), 700);
}

/* Nombre de choix à l'écran selon le palier. */
export function choiceCount(palier, cap) {
  const map = { petit: 2, moyen: 4, grand: 6 };
  return Math.min(cap || 6, map[palier] || 2);
}
