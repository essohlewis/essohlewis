/* Atelier — Le Balafon 🎵 : instrument ouest-africain interactif.
   Gamme PENTATONIQUE → aucune fausse note possible, donc aucun échec.
   Mode Libre (jeu libre) + mode Mélodie (« suis la mélodie », comptines). */

import Audio from "../core/audio.js";
import { icon } from "../core/art.js";
import { onTap } from "../core/input.js";
import { gameHead, finishRound, rand } from "./shell.js";

/* Lames pentatoniques (Do majeur) : toujours harmonieuses ensemble. */
const NOTES = [
  { f: 261.63, c: "#E71D36" }, { f: 293.66, c: "#FF9F1C" }, { f: 329.63, c: "#FFD166" },
  { f: 392.00, c: "#2EC4B6" }, { f: 440.00, c: "#6A4C93" }, { f: 523.25, c: "#E71D36" },
  { f: 587.33, c: "#FF9F1C" }, { f: 659.25, c: "#2EC4B6" }
];

const MELODIES = [
  { nom: "Petite étoile", seq: [0, 0, 3, 3, 4, 4, 3] },
  { nom: "La montée",     seq: [0, 1, 2, 3, 4, 5] },
  { nom: "Cloche",        seq: [0, 2, 4, 2, 0] },
  { nom: "Danse",         seq: [5, 4, 3, 4, 5, 5] }
];

export default function balafon(scene, _p, { go }) {
  const ui = gameHead(scene, "🎵 Le balafon", go);
  const stage = document.createElement("div"); stage.className = "stage balafon-stage";
  scene.appendChild(stage);

  // Sélecteur de mode.
  const modeBar = document.createElement("div"); modeBar.className = "seg";
  const bLibre = mbtn("🎶 Libre"), bMel = mbtn("🎯 Suis la mélodie");
  modeBar.append(bLibre, bMel); stage.appendChild(modeBar);

  const consigne = document.createElement("div"); consigne.className = "balafon-consigne"; stage.appendChild(consigne);

  // Instrument : lames + djembés.
  const inst = document.createElement("div"); inst.className = "balafon";
  const bars = [];
  NOTES.forEach((nt, i) => {
    const bar = document.createElement("button");
    bar.className = "bar"; bar.style.setProperty("--bc", nt.c);
    bar.style.height = (100 - i * 7) + "%";       // lames plus courtes vers l'aigu
    bar.setAttribute("aria-label", "Note " + (i + 1));
    onTap(bar, () => hit(i, bar));
    inst.appendChild(bar); bars.push(bar);
  });
  stage.appendChild(inst);

  const drums = document.createElement("div"); drums.className = "djembes";
  ["basse", "aigu"].forEach(kind => {
    const d = document.createElement("button"); d.className = "djembe " + kind;
    d.setAttribute("aria-label", "Djembé " + kind);
    d.innerHTML = `<span>🥁</span>`;
    onTap(d, () => { Audio.drum(kind); bounce(d); });
    drums.appendChild(d);
  });
  stage.appendChild(drums);

  // ---- État ----
  let mode = "libre", melody = null, pos = 0, earned = 0, following = false;

  function hit(i, bar) {
    Audio.note(NOTES[i].f);
    bounce(bar);
    if (mode === "melodie" && following) {
      if (i === melody.seq[pos]) {
        bar.classList.add("good"); setTimeout(() => bar.classList.remove("good"), 250);
        earned++; ui.addStar();
        pos++;
        if (pos >= melody.seq.length) { finishFollow(); }
        else glow(melody.seq[pos]);
      }
      // note différente : elle sonne quand même, aucun reproche, la cible reste allumée.
    }
  }

  function glow(i) {
    bars.forEach(b => b.classList.remove("glow"));
    if (i != null && bars[i]) bars[i].classList.add("glow");
  }

  function playMelody(seq, done) {
    following = false; glow(null);
    let k = 0;
    const step = () => {
      if (k >= seq.length) { done && done(); return; }
      const idx = seq[k++];
      Audio.note(NOTES[idx].f); bounce(bars[idx]); bars[idx].classList.add("glow");
      setTimeout(() => bars[idx].classList.remove("glow"), 380);
      setTimeout(step, 520);
    };
    step();
  }

  function startMelody() {
    melody = rand(MELODIES); pos = 0; earned = 0;
    consigne.innerHTML = "";
    const listen = document.createElement("button"); listen.className = "btn-pill ghost";
    listen.innerHTML = "🔊 Écouter";
    onTap(listen, () => playMelody(melody.seq, () => { following = true; glow(melody.seq[0]); }));
    const label = document.createElement("span"); label.className = "mel-name"; label.textContent = "« " + melody.nom + " »";
    consigne.append(label, listen);
    Audio.speak(`Écoute la mélodie « ${melody.nom} », puis rejoue-la sur le balafon.`);
    setTimeout(() => playMelody(melody.seq, () => { following = true; glow(melody.seq[0]); }), 900);
  }

  function finishFollow() {
    following = false; glow(null);
    bars.forEach(b => b.classList.add("good"));
    Audio.speak("Bravo, quel musicien !");
    finishRound(go, "balafon", earned);
  }

  function setMode(m) {
    mode = m; following = false; glow(null); consigne.innerHTML = "";
    bLibre.classList.toggle("on", m === "libre");
    bMel.classList.toggle("on", m === "melodie");
    if (m === "libre") { consigne.textContent = "🎶 Joue librement !"; Audio.speak("Fais ta musique !"); }
    else startMelody();
  }
  onTap(bLibre, () => setMode("libre"));
  onTap(bMel, () => setMode("melodie"));
  setMode("libre");
}

function bounce(el) {
  el.classList.remove("tapd"); void el.offsetWidth; el.classList.add("tapd");
}
function mbtn(t) { const b = document.createElement("button"); b.textContent = t; return b; }
