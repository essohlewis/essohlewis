/* Atelier — Mon Pagne 🎨 : coloriage de motifs africains (wax, masque, animaux).
   Un seul geste : tap. Choisis une couleur, touche une zone pour la remplir.
   Aucun échec possible. « Terminé » enregistre l'œuvre dans la galerie. */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { icon } from "../core/art.js";
import { onTap } from "../core/input.js";
import { gameHead, prompt, finishRound, rand } from "./shell.js";

const NS = "http://www.w3.org/2000/svg";

/* Palette de coloriage. */
const PALETTE = ["#E71D36", "#FF9F1C", "#FFD166", "#2EC4B6", "#6A4C93", "#1B2432", "#FDFCF7", "#8d5a34"];

/* Modèles : chaque zone est un <path>/<shape> remplissable indépendamment. */
const MODELES = {
  pagne: () => {
    // Grille de motifs wax 4×4 : 16 zones.
    const cells = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * 25, y = r * 25;
      const kind = (r + c) % 3;
      if (kind === 0) cells.push(`<circle class="z" cx="${x + 12.5}" cy="${y + 12.5}" r="10"/>`);
      else if (kind === 1) cells.push(`<rect class="z" x="${x + 3}" y="${y + 3}" width="19" height="19" rx="3"/>`);
      else cells.push(`<path class="z" d="M${x + 12.5} ${y + 3}L${x + 22} ${y + 12.5}L${x + 12.5} ${y + 22}L${x + 3} ${y + 12.5}Z"/>`);
    }
    return `<rect x="0" y="0" width="100" height="100" fill="#FDFCF7"/>${cells.join("")}`;
  },
  masque: () => `
    <rect width="100" height="100" fill="#FDFCF7"/>
    <path class="z" d="M50 6c22 0 30 20 30 44s-12 44-30 44S20 74 20 50 28 6 50 6z"/>
    <path class="z" d="M32 40q8-8 16 0"/><path class="z" d="M52 40q8-8 16 0"/>
    <ellipse class="z" cx="40" cy="46" rx="6" ry="8"/><ellipse class="z" cx="60" cy="46" rx="6" ry="8"/>
    <path class="z" d="M46 56h8v18h-8z"/>
    <path class="z" d="M40 80q10 8 20 0"/>
    <circle class="z" cx="50" cy="16" r="6"/>`,
  soleil: () => {
    const rays = [];
    for (let a = 0; a < 12; a++) { const ang = a * 30 * Math.PI / 180; const x1 = 50 + 30 * Math.cos(ang), y1 = 50 + 30 * Math.sin(ang), x2 = 50 + 46 * Math.cos(ang), y2 = 50 + 46 * Math.sin(ang); rays.push(`<path class="z" d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="7" stroke="#ddd"/>`); }
    return `<rect width="100" height="100" fill="#FDFCF7"/>${rays.join("")}<circle class="z" cx="50" cy="50" r="28"/>`;
  },
  tortue: () => `
    <rect width="100" height="100" fill="#FDFCF7"/>
    <ellipse class="z" cx="50" cy="54" rx="34" ry="26"/>
    <circle class="z" cx="84" cy="48" r="9"/>
    <path class="z" d="M22 74l-8 8"/><path class="z" d="M78 74l8 8"/>
    <path class="z" d="M50 30v48M28 54h44M36 38l28 32M64 38 36 70"/>
    <circle class="z" cx="42" cy="48" r="6"/><circle class="z" cx="58" cy="48" r="6"/>
    <circle class="z" cx="42" cy="62" r="6"/><circle class="z" cx="58" cy="62" r="6"/>`
};
const MODELE_NOMS = { pagne: "un pagne", masque: "un masque", soleil: "un soleil", tortue: "une tortue" };

export default function coloriage(scene, params, { go }) {
  const ui = gameHead(scene, "🎨 Mon pagne", go);
  const stage = document.createElement("div"); stage.className = "stage coloriage-stage";
  scene.appendChild(stage);

  const modelKey = params.modele || rand(Object.keys(MODELES));
  prompt(stage, `Colorie ${MODELE_NOMS[modelKey]} ! Choisis une couleur, touche une zone.`);

  const board = document.createElement("div"); board.className = "colo-board";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100"); svg.innerHTML = MODELES[modelKey]();
  board.appendChild(svg); stage.appendChild(board);

  let current = PALETTE[0], filled = 0;
  const zones = [...svg.querySelectorAll(".z")];
  zones.forEach(z => {
    if (!z.getAttribute("stroke")) { z.setAttribute("fill", "#e7e2d6"); }
    z.setAttribute("stroke", z.getAttribute("stroke") || "#cfc7b5");
    z.setAttribute("stroke-width", z.getAttribute("stroke-width") || "1.2");
    z.style.cursor = "pointer";
    onTap(z, () => {
      const hadColor = z.dataset.painted === "1";
      if (z.getAttribute("stroke") && z.getAttribute("fill") === "none") z.setAttribute("stroke", current);
      z.setAttribute("fill", current);
      z.dataset.painted = "1";
      Audio.play("tap");
      if (!hadColor) { filled++; if (filled === 3) Audio.speak("C'est joli !"); }
    });
  });

  // Palette.
  const pal = document.createElement("div"); pal.className = "palette";
  PALETTE.forEach((col, i) => {
    const sw = document.createElement("button"); sw.className = "swatch"; sw.style.background = col;
    if (i === 0) sw.classList.add("on");
    sw.setAttribute("aria-label", "Couleur");
    onTap(sw, () => { current = col; pal.querySelectorAll(".swatch").forEach(s => s.classList.remove("on")); sw.classList.add("on"); Audio.play("tap"); });
    pal.appendChild(sw);
  });
  stage.appendChild(pal);

  // Actions : nouveau modèle + terminé.
  const actions = document.createElement("div"); actions.className = "colo-actions";
  const shuffle = document.createElement("button"); shuffle.className = "btn-pill ghost"; shuffle.textContent = "🔄 Autre dessin";
  onTap(shuffle, () => { Audio.play("tap"); go("game", { gameId: "coloriage", modele: rand(Object.keys(MODELES).filter(k => k !== modelKey)) }); });
  const done = document.createElement("button"); done.className = "btn-pill"; done.textContent = "✅ Terminé";
  onTap(done, () => {
    if (filled === 0) { Audio.speak("Colorie d'abord une zone !"); return; }
    saveArtwork(svg);
    Audio.play("win");
    finishRound(go, "coloriage", Math.min(8, Math.max(3, filled)));   // étoiles selon l'effort
  });
  actions.append(shuffle, done); stage.appendChild(actions);

  Audio.speak(`Colorie ${MODELE_NOMS[modelKey]} !`);
}

/* Enregistre une vignette de l'œuvre dans la galerie du profil (localStorage). */
function saveArtwork(svg) {
  try {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", NS);
    const data = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const p = Store.getActive(); if (!p) return;
    p.galerie = p.galerie || [];
    p.galerie.unshift({ date: new Date().toISOString().slice(0, 10), img: data });
    p.galerie = p.galerie.slice(0, 12);           // garde les 12 dernières
    Store.updateProfile(p.id, { galerie: p.galerie });
  } catch (_) {}
}
