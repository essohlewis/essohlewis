/* Jeu 5 — Memory Pagne. Dos = motif wax. Pas de chrono, pas de limite de coups. */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { animal, produce, misc, wax } from "../core/art.js";
import { voixManifest } from "../core/assets.js";
import { onTap } from "../core/input.js";
import { gameHead, correct, shuffle } from "./shell.js";
import { finishRound } from "./shell.js";

/* Symboles à apparier (animaux, fruits, instruments, motifs).
   id partagé avec les autres jeux → une seule voix "voix-<id>.mp3" suffit. */
const SYMBOLS = [
  { id: "lion", nom: "le lion", make: () => animal("lion") },
  { id: "elephant", nom: "l'éléphant", make: () => animal("elephant") },
  { id: "tortue", nom: "la tortue", make: () => animal("tortue") },
  { id: "perroquet", nom: "le perroquet", make: () => animal("perroquet") },
  { id: "mangue", nom: "la mangue", make: () => produce("mangue") },
  { id: "banane", nom: "la banane", make: () => produce("banane") },
  { id: "piment", nom: "le piment", make: () => produce("piment") },
  { id: "attieke", nom: "l'attiéké", make: () => produce("attieke") },
  { id: "tam", nom: "le tam-tam", make: () => misc("tam") },
  { id: "pagne", nom: "le pagne", make: () => misc("pagne") },
  { id: "coq", nom: "le coq", make: () => animal("coq") },
  { id: "poisson", nom: "le poisson", make: () => animal("poisson") }
];

export default async function memory(scene, _p, { go }) {
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "moyen";
  const pairs = palier === "grand" ? 6 : (palier === "moyen" ? 3 : 3);
  const cols = pairs <= 3 ? 3 : (pairs <= 6 ? 4 : 4);

  // Précharge la voix des symboles (nommés à chaque paire trouvée).
  voixManifest(SYMBOLS.map(s => s.id)).then(m => Audio.load(m));

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
  const deck = shuffle(chosen.flatMap((sym, i) => [{ i, sym }, { i, sym }]));

  let flipped = [], moves = 0, matched = 0, lock = false;

  deck.forEach((c, idx) => {
    const card = document.createElement("div"); card.className = "mem-card";
    card.setAttribute("role", "button"); card.setAttribute("aria-label", "Carte");
    const inner = document.createElement("div"); inner.className = "mem-inner";
    const back = document.createElement("div"); back.className = "mem-face mem-back";
    back.appendChild(wax(c.i + idx));           // dos = motif wax varié
    const front = document.createElement("div"); front.className = "mem-face mem-front";
    front.appendChild(c.sym.make());
    inner.append(back, front); card.appendChild(inner);

    onTap(card, () => {
      if (lock || card.classList.contains("flip") || card.classList.contains("done")) return;
      Audio.play("tap");
      card.classList.add("flip");
      flipped.push({ card, key: c.i, sym: c.sym });
      if (flipped.length === 2) {
        moves++; movesEl.textContent = "Coups : " + moves;
        lock = true;
        const [a, b] = flipped;
        if (a.key === b.key) {
          setTimeout(() => {
            a.card.classList.add("done"); b.card.classList.add("done");
            correct(a.card, a.sym.nom, { id: a.sym.id });   // nomme la paire trouvée
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
