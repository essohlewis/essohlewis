/* Jeu 1 — Sons & Animaux : association cri ↔ image.
   Manche de 8 questions. N images = 2/4/6 selon le palier. Aucune pénalité. */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { animal } from "../core/art.js";
import { onTap } from "../core/input.js";
import { gameHead, prompt, correct, soft, finishRound, choiceCount, pick, rand, shuffle } from "./shell.js";

const ROUND = 8;

export default async function animaux(scene, _p, { go }) {
  const data = await fetch("js/data/animaux.json").then(r => r.json());
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "petit";
  const n = choiceCount(palier, 6);
  const pool = data.filter(a => a.palier.includes(palier));
  const bank = pool.length >= n ? pool : data;

  const ui = gameHead(scene, "🐘 Les animaux", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  const bubble = document.createElement("div"); bubble.className = "prompt-bubble";
  stage.appendChild(bubble);
  const grid = document.createElement("div"); grid.className = "choice-grid";
  stage.appendChild(grid);

  let q = 0, earned = 0, target = null, answered = false;

  function ask() {
    answered = false;
    grid.innerHTML = "";
    const choices = shuffle([ ...pick(bank.filter(a => a), n) ]);
    target = rand(choices);

    // Consigne : on écoute le cri (icône = haut-parleur → rejoue le cri).
    bubble.innerHTML = "";
    const say = document.createElement("button");
    say.className = "speak-btn"; say.setAttribute("aria-label", "Écouter le cri");
    say.innerHTML = `<svg viewBox="0 0 100 100" style="width:28px;height:28px"><path d="M20 40h14l18-16v52L34 60H20z" fill="currentColor"/><path d="M64 38a14 14 0 0 1 0 24" fill="none" stroke="currentColor" stroke-width="7"/></svg>`;
    onTap(say, () => Audio.play("cri-" + target.id));
    const label = document.createElement("span");
    label.textContent = "Quel animal fait ce cri ?";
    bubble.append(say, label);
    grid.dataset.n = n;

    setTimeout(() => Audio.play("cri-" + target.id), 300);

    choices.forEach(a => {
      const card = document.createElement("button");
      card.className = "card"; card.setAttribute("aria-label", a.nom);
      card.appendChild(animal(a.art));
      onTap(card, () => choose(a, card));
      grid.appendChild(card);
    });
  }

  function choose(a, card) {
    if (answered) return;
    if (a.id === target.id) {
      answered = true;
      correct(card, a.nom);
      earned++; ui.addStar();
      grid.querySelectorAll(".card").forEach(c => { if (c !== card) c.classList.add("dim"); });
      q++;
      setTimeout(() => { q >= ROUND ? finishRound(go, "animaux", earned) : ask(); }, 1100);
    } else {
      soft(card);
      setTimeout(() => Audio.play("cri-" + target.id), 200); // on rejoue le cri
    }
  }

  ask();
}
