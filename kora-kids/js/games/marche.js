/* Jeu 2 — Le Marché (FCFA). 3 niveaux progressifs.
   Le panier affiche TOUJOURS le total en gros ET le lit à voix haute (cœur de l'apprentissage). */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { produce, money, icon } from "../core/art.js";
import { voixManifest, imageFor } from "../core/assets.js";
import { onTap, makeDraggable } from "../core/input.js";
import { gameHead, prompt, correct, soft, finishRound, shuffle, pick, rand } from "./shell.js";

export default async function marche(scene, _p, { go }) {
  const data = await fetch("js/data/marche.json").then(r => r.json());
  const profile = Store.getActive();
  const palier = (profile && profile.palier) || "moyen";

  // Précharge voix des produits + nombres (fichiers si déclarés, sinon TTS).
  const nombres = Array.from({ length: 11 }, (_, i) => "nombre-" + i);
  voixManifest([...data.produits.map(p => p.id), ...nombres]).then(m => Audio.load(m));

  const ui = gameHead(scene, "🛒 Le marché", go);
  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  const tasks = buildTasks(palier);
  let idx = 0, earned = 0;

  function next() {
    if (idx >= tasks.length) return finishRound(go, "marche", earned);
    const lvl = tasks[idx++];
    stage.querySelectorAll(".prompt-bubble,.marche-layout").forEach(e => e.remove());
    ({ 1: niveau1, 2: niveau2, 3: niveau3 })[lvl](stage, data, () => { earned++; ui.addStar(); setTimeout(next, 1000); });
  }
  next();
}

function buildTasks(palier) {
  if (palier === "grand") return [1, 2, 3, 2, 3, 1];      // les 3 niveaux
  return [1, 1, 1, 1, 1];                                 // petit/moyen : comptage
}

/* ---- Niveau 1 : « Mets N fruits dans le panier » (comptage à voix haute) ---- */
function niveau1(stage, data, onWin) {
  const prod = rand(data.produits);
  const target = 2 + Math.floor(Math.random() * 3);        // 2 à 4
  prompt(stage, `Mets ${target} fois ${prod.nom} dans le panier.`);

  const layout = document.createElement("div"); layout.className = "marche-layout";
  const etal = document.createElement("div"); etal.className = "etal";
  const basket = document.createElement("div"); basket.className = "drop-zone panier";
  basket.appendChild(icon("basket"));
  const total = document.createElement("div"); total.className = "total-display"; total.textContent = "0";
  basket.appendChild(total);                       // le total s'affiche dans le panier
  layout.append(basket, etal); stage.appendChild(layout);

  const targets = [{ el: basket, id: "b" }];
  let count = 0;
  for (let i = 0; i < target + 2; i++) {                    // quelques fruits en trop, sans pénalité
    const p = document.createElement("div"); p.className = "produit draggable";
    p.appendChild(imageFor(prod, "marche") || produce(prod.art)); p.style.transform = "translate(0,0)";
    etal.appendChild(p);
    makeDraggable(p, {
      targets, snapRadius: 90,
      onDrop(hot) {
        if (hot && count < target) {
          count++;
          p.style.transition = "transform .2s, opacity .2s"; p.style.opacity = ".0"; p.style.pointerEvents = "none";
          total.textContent = count; Audio.play("star");
          Audio.speak(String(count), { id: "nombre-" + count });   // comptage à voix haute
          if (count === target) { correct(basket); Audio.speak(`Bravo ! ${target} !`, { id: "nombre-" + target }); onWin(); }
          return true;
        }
        return false;
      }
    });
  }
}

/* ---- Niveau 2 : « X coûte P F. Combien pour N ? » 3 réponses ---- */
function niveau2(stage, data, onWin) {
  const prod = rand(data.produits);
  const qte = 2 + Math.floor(Math.random() * 2);            // 2 ou 3
  const correctVal = prod.prix * qte;
  prompt(stage, `${cap(prod.nom)} coûte ${prod.prix} F. Combien pour ${qte} ?`);

  const layout = document.createElement("div"); layout.className = "marche-layout";
  const show = document.createElement("div"); show.style.cssText = "display:flex;gap:12px;justify-content:center;flex-wrap:wrap";
  for (let i = 0; i < qte; i++) { const d = document.createElement("div"); d.className = "produit"; d.appendChild(imageFor(prod, "marche") || produce(prod.art)); show.appendChild(d); }
  const grid = document.createElement("div"); grid.className = "choice-grid"; grid.dataset.n = 3;
  layout.append(show, grid); stage.appendChild(layout);

  const wrongs = new Set([correctVal]);
  while (wrongs.size < 3) wrongs.add(prod.prix * (1 + Math.floor(Math.random() * 4)));
  let answered = false;
  shuffle([...wrongs]).forEach(val => {
    const card = document.createElement("button"); card.className = "card";
    card.style.fontSize = "clamp(24px,5vw,40px)"; card.style.fontWeight = "900";
    card.textContent = val + " F";
    onTap(card, () => {
      if (answered) return;
      if (val === correctVal) { answered = true; correct(card, `Oui ! ${correctVal} francs.`); onWin(); }
      else soft(card);
    });
    grid.appendChild(card);
  });
}

/* ---- Niveau 3 : « Tu as A F, tu achètes à P F. Combien reste-t-il ? » ---- */
function niveau3(stage, data, onWin) {
  const budgets = [500, 1000];
  const budget = rand(budgets);
  const prod = data.produits.filter(p => p.prix < budget && p.prix >= 100);
  const item = rand(prod.length ? prod : data.produits);
  const reste = budget - item.prix;
  prompt(stage, `Tu as ${budget} F. Tu achètes ${item.nom} à ${item.prix} F. Combien te reste-t-il ?`);

  const layout = document.createElement("div"); layout.className = "marche-layout";
  const caisse = document.createElement("div"); caisse.className = "drop-zone panier";
  caisse.style.minHeight = "clamp(110px,22vh,170px)";
  const cap0 = document.createElement("div"); cap0.className = "total-display"; cap0.textContent = "0"; caisse.appendChild(cap0);
  const bank = document.createElement("div"); bank.className = "etal";
  layout.append(caisse, bank); stage.appendChild(layout);

  const targets = [{ el: caisse, id: "c" }];
  const coins = coinBreakdown(reste, data.coupures);
  let paid = 0;
  const update = () => { cap0.textContent = paid; };
  // Ajoute quelques pièces en plus pour laisser un choix.
  const bankCoins = shuffle([...coins, ...coinBreakdown(reste, data.coupures)]);
  bankCoins.forEach(v => {
    const c = document.createElement("div"); c.className = "coin draggable"; c.appendChild(money(v));
    c.style.transform = "translate(0,0)"; bank.appendChild(c);
    makeDraggable(c, {
      targets, snapRadius: 90,
      onDrop(hot) {
        if (hot && paid + v <= reste) {
          paid += v; update();
          c.style.transition = "transform .2s,opacity .2s"; c.style.opacity = "0"; c.style.pointerEvents = "none";
          Audio.play("star"); Audio.speak(String(paid));
          if (paid === reste) { correct(caisse, `Bravo ! Il reste ${reste} francs.`); onWin(); }
          return true;
        }
        return false;
      }
    });
  });
  Audio.speak(`Compose ${reste} francs.`);
}

function coinBreakdown(amount, coupures) {
  const out = []; let rest = amount;
  [...coupures].sort((a, b) => b - a).forEach(v => { while (rest >= v) { out.push(v); rest -= v; } });
  return out;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
