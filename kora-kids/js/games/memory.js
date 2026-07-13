/* Jeu 5 — Memory Pagne. Dos = motif wax. Pas de chrono, pas de limite de coups. */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { animal, produce, misc, wax } from "../core/art.js";
import { onTap } from "../core/input.js";
import { gameHead, correct, shuffle } from "./shell.js";
import { finishRound } from "./shell.js";

/* Symboles à apparier (animaux, fruits, instruments, motifs). */
const SYMBOLS = [
  () => animal("lion"), () => animal("elephant"), () => animal("tortue"), () => animal("perroquet"),
  () => produce("mangue"), () => produce("banane"), () => produce("piment"), () => produce("attieke"),
  () => misc("tam"), () => misc("pagne"), () => animal("coq"), () => animal("poisson")
];

export default async function memory(scene, _p, { go }) {
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "moyen";
  const pairs = palier === "grand" ? 6 : (palier === "moyen" ? 3 : 3);
  const cols = pairs <= 3 ? 3 : (pairs <= 6 ? 4 : 4);

  const ui = gameHead(scene, "🎴 Memory Pagne", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  const movesEl = document.createElement("div"); movesEl.className = "moves"; movesEl.textContent = "Coups : 0";
  stage.appendChild(movesEl);

  const grid = document.createElement("div"); grid.className = "memory-grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(60px, 110px))`;
  stage.appendChild(grid);

  // Prépare les paires.
  const chosen = shuffle(SYMBOLS).slice(0, pairs);
  const deck = shuffle(chosen.flatMap((make, i) => [{ i, make }, { i, make }]));

  let flipped = [], moves = 0, matched = 0, lock = false;

  deck.forEach((c, idx) => {
    const card = document.createElement("div"); card.className = "mem-card";
    card.setAttribute("role", "button"); card.setAttribute("aria-label", "Carte");
    const inner = document.createElement("div"); inner.className = "mem-inner";
    const back = document.createElement("div"); back.className = "mem-face mem-back";
    back.appendChild(wax(c.i + idx));           // dos = motif wax varié
    const front = document.createElement("div"); front.className = "mem-face mem-front";
    front.appendChild(c.make());
    inner.append(back, front); card.appendChild(inner);

    onTap(card, () => {
      if (lock || card.classList.contains("flip") || card.classList.contains("done")) return;
      Audio.play("tap");
      card.classList.add("flip");
      flipped.push({ card, key: c.i });
      if (flipped.length === 2) {
        moves++; movesEl.textContent = "Coups : " + moves;
        lock = true;
        const [a, b] = flipped;
        if (a.key === b.key) {
          setTimeout(() => {
            a.card.classList.add("done"); b.card.classList.add("done");
            correct(a.card);
            flipped = []; lock = false;
            if (++matched === pairs) {
              // 1 étoile par paire trouvée.
              finishRound(go, "memory", pairs);
            }
          }, 350);
        } else {
          setTimeout(() => {
            a.card.classList.remove("flip"); b.card.classList.remove("flip");
            flipped = []; lock = false;
            Audio.play("neutral");
          }, 1200);
        }
      }
    });
    grid.appendChild(card);
  });
}
