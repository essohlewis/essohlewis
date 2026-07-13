/* Jeu 4 — Formes & Couleurs.
   3 sous-jeux : Encastrement (drag+snap), Tri par couleur, Intrus (5 ans).
   L'aimantation (snap) est critique ici — Pointer Events + distance au centre. */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { shape, icon } from "../core/art.js";
import { onTap, makeDraggable } from "../core/input.js";
import { gameHead, prompt, correct, soft, finishRound, shuffle, pick, rand } from "./shell.js";

const SHAPES = [
  { id: "rond", nom: "le rond" }, { id: "carre", nom: "le carré" },
  { id: "triangle", nom: "le triangle" }, { id: "etoile", nom: "l'étoile" },
  { id: "coeur", nom: "le cœur" }, { id: "croissant", nom: "le croissant" }
];
const COLORS = [
  { id: "rouge", nom: "rouges", hex: "#E71D36" }, { id: "vert", nom: "verts", hex: "#2EC4B6" },
  { id: "jaune", nom: "jaunes", hex: "#FFD166" }, { id: "orange", nom: "orange", hex: "#FF9F1C" }
];

export default async function formes(scene, _p, { go }) {
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "petit";

  const ui = gameHead(scene, "🔷 Formes & couleurs", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  const modes = palier === "petit" ? ["encastre", "tri"] : ["encastre", "tri", "intrus"];
  let earned = 0, round = 0;
  const TOTAL = 6;

  function next() {
    if (round >= TOTAL) return finishRound(go, "formes", earned);
    round++;
    stage.querySelectorAll(".prompt-bubble, .forme-board, .forme-tray, .choice-grid").forEach(e => e.remove());
    const mode = modes[(round - 1) % modes.length];
    ({ encastre, tri, intrus })[mode](stage, palier, () => { earned++; ui.addStar(); setTimeout(next, 900); });
  }
  next();
}

/* ---- Encastrement : glisser chaque forme dans son trou (snap 40 px) ---- */
function encastre(stage, palier, onWin) {
  const kinds = pick(SHAPES, palier === "petit" ? 2 : 3);
  prompt(stage, "Range chaque forme dans son trou.");

  const board = document.createElement("div"); board.className = "forme-board";
  const holes = document.createElement("div"); holes.style.cssText = "display:flex;gap:24px;flex-wrap:wrap;justify-content:center";
  const tray = document.createElement("div"); tray.className = "forme-tray";
  board.append(holes); stage.append(board, tray);

  const targets = [];
  kinds.forEach(k => {
    const hole = document.createElement("div"); hole.className = "hole";
    const s = shape(k.id, "rgba(0,0,0,.18)"); hole.appendChild(s);
    hole.dataset.id = k.id; holes.appendChild(hole);
    targets.push({ el: hole, id: k.id });
  });

  let placed = 0;
  shuffle(kinds).forEach(k => {
    const piece = document.createElement("div"); piece.className = "forme-piece";
    piece.appendChild(shape(k.id, rand(COLORS).hex));
    piece.style.transform = "translate(0,0)";
    tray.appendChild(piece);
    makeDraggable(piece, {
      targets, snapRadius: 55,   // aimantation généreuse pour les 2 ans
      onDrop(hot) {
        if (hot && hot.id === k.id) {
          const hole = hot.el;
          const hr = hole.getBoundingClientRect(), pr = piece.getBoundingClientRect();
          piece.style.transition = "transform .18s";
          const t = getTr(piece);
          piece.style.transform = `translate(${t.x + (hr.left - pr.left)}px, ${t.y + (hr.top - pr.top)}px)`;
          piece.style.pointerEvents = "none";
          correct(piece, k.nom);
          if (++placed === kinds.length) onWin();
          return true;
        }
        return false; // retourne doucement à sa place, jamais d'erreur
      }
    });
  });
}

/* ---- Tri par couleur ---- */
function tri(stage, palier, onWin) {
  const color = rand(COLORS);
  const others = COLORS.filter(c => c.id !== color.id);
  prompt(stage, `Mets tous les objets ${color.nom} dans le panier.`);

  const board = document.createElement("div"); board.className = "forme-board";
  const basket = document.createElement("div"); basket.className = "drop-zone";
  basket.style.cssText = "width:clamp(120px,26vw,200px);aspect-ratio:1;color:" + color.hex;
  basket.appendChild(icon("basket"));
  const tray = document.createElement("div"); tray.className = "forme-tray";
  board.append(tray, basket); stage.append(board);

  const targets = [{ el: basket, id: "basket" }];
  const good = 3, items = [];
  for (let i = 0; i < good; i++) items.push({ c: color, ok: true });
  for (let i = 0; i < good; i++) items.push({ c: rand(others), ok: false });

  let done = 0;
  shuffle(items).forEach(it => {
    const piece = document.createElement("div"); piece.className = "forme-piece";
    piece.appendChild(shape(rand(SHAPES).id, it.c.hex));
    piece.style.transform = "translate(0,0)";
    tray.appendChild(piece);
    makeDraggable(piece, {
      targets, snapRadius: 80,
      onDrop(hot) {
        if (hot && it.ok) {
          piece.style.transition = "transform .2s, opacity .2s";
          piece.style.opacity = "0"; piece.style.pointerEvents = "none";
          correct(piece);
          if (++done === good) onWin();
          return true;
        }
        return false;
      }
    });
  });
}

/* ---- Intrus : 4 objets, 3 partagent une propriété (5 ans) ---- */
function intrus(stage, palier, onWin) {
  const base = rand(SHAPES), odd = rand(SHAPES.filter(s => s.id !== base.id));
  const color = rand(COLORS);
  prompt(stage, "Touche l'objet différent.");
  const grid = document.createElement("div"); grid.className = "choice-grid"; grid.dataset.n = 4;
  stage.appendChild(grid);
  const cells = [
    { k: base, odd: false }, { k: base, odd: false }, { k: base, odd: false }, { k: odd, odd: true }
  ];
  let answered = false;
  shuffle(cells).forEach(c => {
    const card = document.createElement("button"); card.className = "card";
    card.appendChild(shape(c.k.id, color.hex));
    onTap(card, () => {
      if (answered) return;
      if (c.odd) { answered = true; correct(card, "Bravo !"); onWin(); }
      else soft(card);
    });
    grid.appendChild(card);
  });
}

function getTr(el) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42 };
}
