/* Jeu 6 — Puzzle Progressif. Approche <div> + background-position (accessible, animable CSS).
   Image complète en filigrane sous le plateau (opacité 20 %). Aimantation forte (< 50 px). */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { sceneImg, toDataURL } from "../core/art.js";
import { makeDraggable, setTranslate } from "../core/input.js";
import { gameHead, prompt, correct, finishRound, shuffle, rand } from "./shell.js";

const SCENES = ["village", "savane", "marche", "lagune"];

export default async function puzzle(scene, _p, { go }) {
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "petit";
  const gridN = palier === "grand" ? 4 : (palier === "moyen" ? 3 : 2);   // 4/9/16 pièces

  const ui = gameHead(scene, "🧩 Puzzle", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);
  prompt(stage, "Remets l'image en glissant les pièces.");

  const kind = rand(SCENES);
  const url = toDataURL(sceneImg(kind));

  const wrap = document.createElement("div"); wrap.className = "puzzle-wrap";
  const board = document.createElement("div"); board.className = "puzzle-board";
  const tray = document.createElement("div"); tray.className = "puzzle-tray";
  wrap.append(board, tray); stage.appendChild(wrap);

  // Taille du plateau : mesurée sur l'espace réellement disponible pour que
  // le plateau ET le bac à pièces tiennent à l'écran (paysage = côte à côte).
  const sr = stage.getBoundingClientRect();
  const promptH = (stage.querySelector(".prompt-bubble")?.offsetHeight || 0) + 24;
  const availW = sr.width, availH = sr.height - promptH;
  const landscape = availW >= availH;
  wrap.style.flexDirection = landscape ? "row" : "column";

  // Le plateau doit laisser de la place au bac. On borne la taille de cellule
  // pour que board + bac tiennent, et on plafonne pour rester manipulable.
  let cell = landscape
    ? Math.min(availW / (gridN + 1.4), availH / gridN, 140)
    : Math.min(availW / gridN, availH / (gridN + 1.4), 140);
  cell = Math.max(46, Math.floor(cell));
  board.style.cssText = `width:${cell * gridN}px;height:${cell * gridN}px`;

  // Vignettes du bac : plus petites que les cellules → jamais de chevauchement.
  const thumb = Math.min(cell, landscape ? 88 : 76);
  if (landscape) { tray.style.flexDirection = "row"; tray.style.flexWrap = "wrap";
    tray.style.maxWidth = Math.max(thumb + 16, availW - cell * gridN - 24) + "px";
    tray.style.maxHeight = availH + "px"; tray.style.overflow = "auto"; }
  else { tray.style.maxWidth = availW + "px"; tray.style.maxHeight = (availH - cell * gridN - 12) + "px"; tray.style.overflow = "auto"; }

  // Filigrane (image complète, opacité 20 %).
  const ghost = document.createElement("div");
  ghost.className = "puzzle-ghost";
  ghost.style.backgroundImage = `url("${url}")`;
  board.appendChild(ghost);

  // Crée slots.
  const slots = [];
  for (let r = 0; r < gridN; r++) {
    for (let c = 0; c < gridN; c++) {
      const slot = document.createElement("div");
      slot.className = "puzzle-slot";
      slot.style.cssText = `left:${c * cell}px;top:${r * cell}px;width:${cell}px;height:${cell}px`;
      slot.dataset.pos = r + "-" + c;
      board.appendChild(slot);
      slots.push({ el: slot, id: r + "-" + c, r, c });
    }
  }

  const targets = slots.map(s => ({ el: s.el, id: s.id }));
  const full = cell * gridN;
  let placed = 0;

  const sliceStyle = (size, c, r) =>
    `width:${size}px;height:${size}px;background-image:url("${url}");` +
    `background-size:${size * gridN}px ${size * gridN}px;background-position:-${c * size}px -${r * size}px`;

  shuffle(slots.slice()).forEach((s) => {
    const piece = document.createElement("div");
    piece.className = "puzzle-piece draggable";
    piece.style.cssText = sliceStyle(thumb, s.c, s.r) + ";position:relative";
    piece.style.transform = "translate(0,0)";
    piece.dataset.target = s.id;
    tray.appendChild(piece);

    makeDraggable(piece, {
      targets, snapRadius: Math.max(48, cell * 0.5),   // aimantation forte (< ~ demi-cellule)
      onDrop(hot) {
        if (hot && hot.id === s.id) {
          // Verrouille la pièce à sa place, à la taille pleine de la cellule.
          board.appendChild(piece);
          piece.style.cssText = sliceStyle(cell, s.c, s.r) +
            `;position:absolute;left:${s.c * cell}px;top:${s.r * cell}px;transform:translate(0,0);pointer-events:none;box-shadow:none;border-radius:0`;
          correct(piece);
          if (++placed === slots.length) {
            Audio.speak("Bravo ! L'image est complète !");
            finishRound(go, "puzzle", slots.length);
          }
          return true;
        }
        return false;   // retour doux au bac, jamais d'erreur
      }
    });
  });
}
