/* Jeu 3 — Alphabet Kora. 2 modes :
   Découverte (grille libre, essentiel pour les 4 ans) et Chasse (« trouve la lettre »). */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { resolveArt, icon } from "../core/art.js";
import { voixManifest, imageFor } from "../core/assets.js";
import { onTap } from "../core/input.js";
import { gameHead, prompt, correct, soft, finishRound, shuffle, pick, rand, choiceCount } from "./shell.js";

const ROUND = 8;

export default async function alphabet(scene, _p, { go }) {
  const data = await fetch("js/data/alphabet.json").then(r => r.json());
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "moyen";

  // Précharge la voix des lettres DÉCLARÉES (sinon TTS en repli).
  voixManifest(data.map(e => "lettre-" + e.lettre)).then(m => Audio.load(m));

  const ui = gameHead(scene, "🔤 Alphabet Kora", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  // Sélecteur de mode.
  const modeBar = document.createElement("div"); modeBar.className = "seg";
  modeBar.style.marginBottom = "6px";
  const bDec = modeBtn("🔍 Découverte"), bCha = modeBtn("🎯 Chasse");
  modeBar.append(bDec, bCha); stage.appendChild(modeBar);

  const area = document.createElement("div");
  area.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;width:100%;min-height:0;overflow:auto";
  stage.appendChild(area);

  function setMode(m) {
    bDec.classList.toggle("on", m === "dec");
    bCha.classList.toggle("on", m === "chasse");
    area.innerHTML = "";
    m === "dec" ? decouverte() : chasse();
  }
  onTap(bDec, () => setMode("dec"));
  onTap(bCha, () => setMode("chasse"));
  setMode("dec");

  // ---- Mode Découverte : grille de 26 lettres ----
  function decouverte() {
    const grid = document.createElement("div"); grid.className = "alpha-grid";
    const reveal = document.createElement("div"); reveal.className = "alpha-reveal";
    reveal.style.minHeight = "0";
    area.append(reveal, grid);
    data.forEach(entry => {
      const cell = document.createElement("button"); cell.className = "alpha-cell";
      cell.textContent = entry.lettre; cell.setAttribute("aria-label", entry.lettre);
      onTap(cell, () => {
        Audio.play("tap");
        // Son de la lettre puis mot (fichier voix si présent, sinon TTS).
        Audio.speak(`${entry.son || entry.lettre}… comme ${entry.mot}`, { id: "lettre-" + entry.lettre });
        reveal.innerHTML = "";
        const big = document.createElement("div"); big.className = "big-letter"; big.textContent = entry.lettre;
        const art = imageFor(entry, "alphabet") || resolveArt(entry.art);
        const word = document.createElement("div"); word.className = "word"; word.textContent = entry.mot;
        reveal.append(big, art, word);
        reveal.style.minHeight = "auto";
      });
      grid.appendChild(cell);
    });
  }

  // ---- Mode Chasse : trouve la bonne lettre ----
  function chasse() {
    const n = choiceCount(palier, 6);
    let q = 0, earned = 0, target = null, answered = false;
    const bubble = document.createElement("div"); bubble.className = "prompt-bubble";
    const grid = document.createElement("div"); grid.className = "choice-grid";
    area.append(bubble, grid);

    function ask() {
      answered = false; grid.innerHTML = "";
      const choices = pick(data, n); target = rand(choices);
      grid.dataset.n = n;
      bubble.innerHTML = "";
      const sb = document.createElement("button"); sb.className = "speak-btn";
      sb.appendChild(icon("sound"));
      onTap(sb, () => Audio.speak(`Trouve la lettre ${target.lettre}`));
      const t = document.createElement("span");
      t.innerHTML = `Trouve la lettre <b style="font-size:1.4em;color:var(--primary)">${target.lettre}</b>`;
      bubble.append(sb, t);
      Audio.speak(`Trouve la lettre ${target.lettre}`);

      shuffle(choices).forEach(entry => {
        const card = document.createElement("button"); card.className = "card";
        card.style.fontSize = "clamp(40px,10vw,90px)"; card.style.fontWeight = "900";
        card.textContent = entry.lettre; card.setAttribute("aria-label", entry.lettre);
        onTap(card, () => {
          if (answered) return;
          if (entry.lettre === target.lettre) {
            answered = true; correct(card, `${target.lettre} comme ${target.mot}`, { id: "lettre-" + target.lettre });
            earned++; ui.addStar();
            grid.querySelectorAll(".card").forEach(c => { if (c !== card) c.classList.add("dim"); });
            q++;
            setTimeout(() => q >= ROUND ? finishRound(go, "alphabet", earned) : ask(), 1100);
          } else soft(card);
        });
        grid.appendChild(card);
      });
    }
    ask();
  }
}

function modeBtn(txt) { const b = document.createElement("button"); b.textContent = txt; return b; }
