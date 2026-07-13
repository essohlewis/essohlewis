/* Atelier — Le Balafon 🎵 : mini-studio de musique ouest-africain.
   Gamme PENTATONIQUE → aucune fausse note, donc aucun échec.
   - 4 instruments (Balafon, Kalimba, Flûte, Kora) au timbre distinct.
   - Mode Libre : jeu libre. Mode Compose : enregistre, écoute en boucle, garde.
     Mode Mélodie : « suis la mélodie » avec partition visuelle.
   - Accompagnement rythmique (groove djembé) pour jouer par-dessus un rythme. */

import Audio from "../core/audio.js";
import Store from "../core/storage.js";
import { onTap } from "../core/input.js";
import { gameHead, finishRound, rand } from "./shell.js";

/* Lames pentatoniques (Do majeur). */
const NOTES = [
  { f: 261.63, c: "#E71D36" }, { f: 293.66, c: "#FF9F1C" }, { f: 329.63, c: "#FFD166" },
  { f: 392.00, c: "#2EC4B6" }, { f: 440.00, c: "#6A4C93" }, { f: 523.25, c: "#E71D36" },
  { f: 587.33, c: "#FF9F1C" }, { f: 659.25, c: "#2EC4B6" }
];

const INSTRUMENTS = [
  { id: "balafon", nom: "Balafon", emoji: "🎼" },
  { id: "kalimba", nom: "Kalimba", emoji: "🎹" },
  { id: "flute",   nom: "Flûte",   emoji: "🪈" },
  { id: "kora",    nom: "Kora",    emoji: "🪕" }
];

const MELODIES = [
  { nom: "Petite étoile", seq: [0, 0, 3, 3, 4, 4, 3] },
  { nom: "La montée",     seq: [0, 1, 2, 3, 4, 5] },
  { nom: "Cloche",        seq: [0, 2, 4, 2, 0] },
  { nom: "Danse",         seq: [5, 4, 3, 4, 5, 5] },
  { nom: "Rivière",       seq: [2, 3, 4, 3, 2, 1, 0] }
];

/* Motif de djembé (2 temps, croches) : B=basse, a=aigu, .=silence. */
const GROOVE = ["B", ".", "a", ".", "B", "a", ".", "a"];

export default function balafon(scene, _p, { go }) {
  const ui = gameHead(scene, "🎵 Le balafon", go);
  const stage = document.createElement("div"); stage.className = "stage balafon-stage";
  scene.appendChild(stage);

  // ---- Barre d'instruments ----
  const instBar = document.createElement("div"); instBar.className = "seg inst-bar";
  let instrument = "balafon";
  INSTRUMENTS.forEach(ins => {
    const b = document.createElement("button"); b.innerHTML = `${ins.emoji} ${ins.nom}`;
    if (ins.id === instrument) b.classList.add("on");
    onTap(b, () => {
      instrument = ins.id;
      instBar.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on");
      Audio.note(NOTES[3].f, { timbre: instrument });
      Audio.speak(ins.nom);
    });
    instBar.appendChild(b);
  });
  stage.appendChild(instBar);

  // ---- Barre de mode ----
  const modeBar = document.createElement("div"); modeBar.className = "seg";
  const bLibre = mbtn("🎶 Libre"), bCompose = mbtn("⏺️ Compose"), bMel = mbtn("🎯 Mélodie");
  modeBar.append(bLibre, bCompose, bMel); stage.appendChild(modeBar);

  const consigne = document.createElement("div"); consigne.className = "balafon-consigne"; stage.appendChild(consigne);
  const scoreRow = document.createElement("div"); scoreRow.className = "score-row"; stage.appendChild(scoreRow);

  // ---- Instrument (lames) ----
  const inst = document.createElement("div"); inst.className = "balafon";
  const bars = [];
  NOTES.forEach((nt, i) => {
    const bar = document.createElement("button");
    bar.className = "bar"; bar.style.setProperty("--bc", nt.c);
    bar.style.height = (100 - i * 7) + "%";
    bar.setAttribute("aria-label", "Note " + (i + 1));
    onTap(bar, () => hit(i, bar));
    inst.appendChild(bar); bars.push(bar);
  });
  stage.appendChild(inst);

  // ---- Djembés + groove ----
  const bottom = document.createElement("div"); bottom.className = "balafon-bottom";
  const drums = document.createElement("div"); drums.className = "djembes";
  ["basse", "aigu"].forEach(kind => {
    const d = document.createElement("button"); d.className = "djembe " + kind;
    d.setAttribute("aria-label", "Djembé " + kind); d.innerHTML = `<span>🥁</span>`;
    onTap(d, () => { Audio.drum(kind); bounce(d); });
    drums.appendChild(d);
  });
  const grooveBtn = document.createElement("button"); grooveBtn.className = "btn-pill ghost groove-btn";
  grooveBtn.innerHTML = "🥁 Rythme";
  onTap(grooveBtn, () => toggleGroove(grooveBtn));
  bottom.append(drums, grooveBtn); stage.appendChild(bottom);

  // ================= État & timers =================
  let mode = "libre";
  let following = false, melody = null, pos = 0, earned = 0;
  let recording = false, recorded = [], recStart = 0, looping = false;
  let grooveTimer = null, grooveStep = 0;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.length = 0; };

  function hit(i, bar) {
    Audio.note(NOTES[i].f, { timbre: instrument });
    bounce(bar); ripple(bar, NOTES[i].c);
    if (mode === "compose" && recording) recorded.push({ i, t: performance.now() - recStart });
    if (mode === "melodie" && following) followHit(i, bar);
  }

  // ---------- Groove (accompagnement) ----------
  function toggleGroove(btn) {
    if (grooveTimer) { clearInterval(grooveTimer); grooveTimer = null; btn.classList.remove("on"); return; }
    btn.classList.add("on"); grooveStep = 0;
    const stepMs = 60000 / 112 / 2;            // croches à 112 BPM
    grooveTimer = setInterval(() => {
      const s = GROOVE[grooveStep % GROOVE.length];
      if (s === "B") Audio.drum("basse"); else if (s === "a") Audio.drum("aigu");
      grooveStep++;
    }, stepMs);
  }

  // ---------- Lecture d'une séquence (indices ou {i,t}) ----------
  function playSeq(seq, { onDone, timed } = {}) {
    if (timed) {
      seq.forEach(ev => later(() => { Audio.note(NOTES[ev.i].f, { timbre: instrument }); bounce(bars[ev.i]); ripple(bars[ev.i], NOTES[ev.i].c); }, ev.t));
      const end = seq.length ? seq[seq.length - 1].t + 600 : 0;
      later(() => onDone && onDone(), end);
    } else {
      let k = 0;
      const step = () => {
        if (k >= seq.length) { onDone && onDone(); return; }
        const idx = seq[k++];
        Audio.note(NOTES[idx].f, { timbre: instrument }); bounce(bars[idx]); flash(bars[idx]);
        later(step, 520);
      };
      step();
    }
  }

  // ---------- Mode Compose ----------
  function buildCompose() {
    consigne.innerHTML = "";
    const rec = pill("⏺️ Enregistrer");
    const play = pill("▶️ Écouter", true);
    const loop = pill("🔁 Boucle", true);
    const save = pill("💾 Garder", true);
    const clr = pill("🗑️ Effacer", true);

    const setEnabled = () => {
      const has = recorded.length > 0;
      [play, loop, save, clr].forEach(b => b.disabled = !has || recording);
      play.style.opacity = loop.style.opacity = save.style.opacity = clr.style.opacity = (recorded.length && !recording) ? 1 : .5;
    };

    onTap(rec, () => {
      if (!recording) {
        recording = true; recorded = []; recStart = performance.now();
        stopLoop(); rec.innerHTML = "⏹️ Stop"; rec.classList.add("on");
        Audio.speak("À toi ! Joue ta musique.");
      } else {
        recording = false; rec.innerHTML = "⏺️ Enregistrer"; rec.classList.remove("on");
        Audio.speak(recorded.length ? "Bravo ! Écoute ta musique." : "Touche les lames pour jouer.");
      }
      setEnabled();
    });
    onTap(play, () => { if (recorded.length && !recording) { stopLoop(); playSeq(recorded, { timed: true }); } });
    onTap(loop, () => {
      if (!recorded.length || recording) return;
      if (looping) { stopLoop(); loop.classList.remove("on"); }
      else { looping = true; loop.classList.add("on"); runLoop(); }
    });
    onTap(save, () => {
      if (!recorded.length || recording) return;
      Store.saveMusique(recorded.map(e => ({ i: e.i, t: Math.round(e.t) })), instrument);
      Audio.play("success"); Audio.speak("Ta musique est gardée !");
      save.innerHTML = "✅ Gardée"; later(() => (save.innerHTML = "💾 Garder"), 1500);
      renderMesMusiques();
    });
    onTap(clr, () => { stopLoop(); recorded = []; Audio.play("tap"); setEnabled(); });

    consigne.append(rec, play, loop, save, clr);
    setEnabled();
    renderMesMusiques();
  }

  function runLoop() {
    if (!looping) return;
    playSeq(recorded, { timed: true, onDone: () => { if (looping) later(runLoop, 200); } });
  }
  function stopLoop() { looping = false; }

  // « Mes musiques » : rejoue une composition sauvegardée.
  function renderMesMusiques() {
    scoreRow.innerHTML = "";
    const list = Store.getMusiques();
    if (mode !== "compose" || !list.length) return;
    const label = document.createElement("span"); label.className = "mm-label"; label.textContent = "🎵 Mes musiques :";
    scoreRow.appendChild(label);
    list.slice(0, 6).forEach((m, i) => {
      const chip = document.createElement("button"); chip.className = "mm-chip"; chip.textContent = "▶ " + (i + 1);
      onTap(chip, () => { const prev = instrument; instrument = m.instrument || instrument; stopLoop(); playSeq(m.seq, { timed: true, onDone: () => (instrument = prev) }); });
      scoreRow.appendChild(chip);
    });
  }

  // ---------- Mode Mélodie (partition visuelle) ----------
  function buildMelodie() {
    melody = rand(MELODIES); pos = 0; earned = 0; following = false;
    consigne.innerHTML = "";
    const name = document.createElement("span"); name.className = "mel-name"; name.textContent = "« " + melody.nom + " »";
    const listen = pill("🔊 Écouter");
    onTap(listen, () => startFollow());
    consigne.append(name, listen);
    drawScore();
    Audio.speak(`Écoute « ${melody.nom} », puis rejoue-la.`);
    later(startFollow, 900);
  }
  function drawScore() {
    scoreRow.innerHTML = "";
    melody.seq.forEach((idx, k) => {
      const dot = document.createElement("span"); dot.className = "score-dot";
      dot.style.background = NOTES[idx].c;
      if (k < pos) dot.classList.add("done");
      if (k === pos && following) dot.classList.add("next");
      scoreRow.appendChild(dot);
    });
  }
  function startFollow() {
    following = false; glow(null); drawScore();
    playSeq(melody.seq, { onDone: () => { following = true; pos = 0; drawScore(); glow(melody.seq[0]); } });
  }
  function followHit(i, bar) {
    if (i === melody.seq[pos]) {
      flash(bar); earned++; ui.addStar(); pos++;
      if (pos >= melody.seq.length) return finishFollow();
      drawScore(); glow(melody.seq[pos]);
    }
    // note différente : elle sonne, aucun reproche, la cible reste allumée.
  }
  function finishFollow() {
    following = false; glow(null); drawScore();
    bars.forEach(b => flash(b));
    Audio.speak("Bravo, quel musicien !");
    finishRound(go, "balafon", earned);
  }

  function glow(i) { bars.forEach(b => b.classList.remove("glow")); if (i != null && bars[i]) bars[i].classList.add("glow"); }

  // ---------- Changement de mode ----------
  function setMode(m) {
    // Nettoyage inter-modes.
    clearTimers(); stopLoop(); recording = false; following = false; glow(null);
    scoreRow.innerHTML = ""; consigne.innerHTML = "";
    mode = m;
    bLibre.classList.toggle("on", m === "libre");
    bCompose.classList.toggle("on", m === "compose");
    bMel.classList.toggle("on", m === "melodie");
    if (m === "libre") { consigne.textContent = "🎶 Joue librement !"; Audio.speak("Fais ta musique !"); }
    else if (m === "compose") buildCompose();
    else buildMelodie();
  }
  onTap(bLibre, () => setMode("libre"));
  onTap(bCompose, () => setMode("compose"));
  onTap(bMel, () => setMode("melodie"));
  setMode("libre");

  // Nettoyage à la sortie de la scène (groove + timers).
  return { cleanup() { if (grooveTimer) clearInterval(grooveTimer); clearTimers(); stopLoop(); } };
}

function bounce(el) { el.classList.remove("tapd"); void el.offsetWidth; el.classList.add("tapd"); }
function flash(el) { el.classList.add("good"); setTimeout(() => el.classList.remove("good"), 260); }
function ripple(el, color) {
  const r = document.createElement("span"); r.className = "note-ripple"; r.style.background = color;
  el.appendChild(r); setTimeout(() => r.remove(), 500);
}
function mbtn(t) { const b = document.createElement("button"); b.textContent = t; return b; }
function pill(t, dim) { const b = document.createElement("button"); b.className = "btn-pill ghost mini-pill"; b.innerHTML = t; if (dim) b.style.opacity = .5; return b; }
