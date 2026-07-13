/* parent.js — Espace parent VERROUILLÉ.
   Déverrouillage : maintien 3 s OU résoudre une addition simple.
   Contenu : profils (CRUD), tableau de progression, réglages, minuteur, réinitialisation. */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { icon, avatar } from "../core/art.js";
import { onTap } from "../core/input.js";
import Router from "../core/router.js";

export default async function parent(scene, params, { go }) {
  const cfg = await fetch("js/data/config.json").then(r => r.json());
  Router.buildHead(scene, { title: "👪 Espace parent", onBack: () => go("home") });

  const body = document.createElement("div");
  body.className = "stage"; body.style.justifyContent = "flex-start";
  scene.appendChild(body);

  showLock(body, () => renderPanel(body, cfg, go, params.createChild));
}

/* ---------- Verrou ---------- */
function showLock(body, unlock) {
  body.innerHTML = "";
  const box = document.createElement("div"); box.className = "lock-screen";
  box.innerHTML = `<div style="font-size:22px;font-weight:800">Espace réservé aux parents</div>
    <p style="color:var(--ink-soft);font-size:18px">Maintiens le bouton 3&nbsp;secondes</p>`;

  const hold = document.createElement("button");
  hold.className = "hold-btn";
  hold.innerHTML = `<span style="position:relative;z-index:2">Maintenir</span>`;
  const ring = document.createElement("div"); ring.className = "fillring";
  hold.insertBefore(ring, hold.firstChild);

  let t0 = 0, raf = 0, done = false;
  const start = () => {
    t0 = Date.now(); done = false;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / 3000);
      ring.style.transform = `scaleY(${p})`;
      if (p >= 1 && !done) { done = true; Audio.play("success"); unlock(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const stop = () => { cancelAnimationFrame(raf); if (!done) ring.style.transform = "scaleY(0)"; };
  hold.addEventListener("pointerdown", start);
  hold.addEventListener("pointerup", stop);
  hold.addEventListener("pointerleave", stop);
  hold.addEventListener("pointercancel", stop);

  box.appendChild(hold);

  // Alternative : addition simple.
  const a = 3 + Math.floor(Math.random() * 6), b = 2 + Math.floor(Math.random() * 6);
  const q = document.createElement("div");
  q.style.cssText = "margin-top:20px;font-size:18px;color:var(--ink-soft)";
  q.textContent = `… ou réponds : ${a} + ${b} = ?`;
  const input = document.createElement("input");
  input.type = "number"; input.inputMode = "numeric";
  input.style.cssText = "font-size:24px;width:100px;text-align:center;padding:8px;border-radius:12px;border:2px solid var(--ink-soft);margin:10px";
  input.addEventListener("input", () => {
    if (parseInt(input.value, 10) === a + b) { Audio.play("success"); unlock(); }
  });
  box.append(q, input);
  body.appendChild(box);
}

/* ---------- Panneau ---------- */
function renderPanel(body, cfg, go, createChild) {
  body.innerHTML = "";
  const panel = document.createElement("div"); panel.className = "parent-panel";
  body.appendChild(panel);

  // === Profils ===
  section(panel, "Enfants");
  const list = document.createElement("div"); panel.appendChild(list);
  const refreshProfiles = () => renderProfiles(list, cfg, go);
  refreshProfiles();

  const addBtn = document.createElement("button");
  addBtn.className = "btn-pill"; addBtn.style.marginTop = "8px";
  addBtn.textContent = "+ Ajouter un enfant";
  onTap(addBtn, () => editProfile(null, cfg, refreshProfiles));
  panel.appendChild(addBtn);

  // === Progression ===
  section(panel, "Progression");
  renderProgress(panel, cfg);

  // === Réglages ===
  section(panel, "Réglages");
  renderSettings(panel);

  // === Zone rouge ===
  section(panel, "Données");
  const reset = document.createElement("button");
  reset.className = "btn-pill ghost"; reset.style.color = "var(--alert)";
  reset.textContent = "Réinitialiser la progression";
  onTap(reset, () => {
    if (confirm("Effacer toutes les étoiles et le temps de jeu ? Les enfants sont conservés.")) {
      Store.resetProgress(); Audio.play("neutral"); renderPanel(body, cfg, go);
    }
  });
  panel.appendChild(reset);

  if (createChild) editProfile(null, cfg, refreshProfiles);
}

function section(parent, title) {
  const h = document.createElement("h2"); h.textContent = title; parent.appendChild(h);
}

function renderProfiles(list, cfg, go) {
  list.innerHTML = "";
  const profiles = Store.getProfiles();
  if (profiles.length === 0) { list.innerHTML = `<p style="color:var(--ink-soft)">Aucun enfant. Ajoute-en un ci-dessous.</p>`; return; }
  profiles.forEach((p, i) => {
    const row = document.createElement("div"); row.className = "parent-row";
    const left = document.createElement("div");
    left.style.cssText = "display:flex;align-items:center;gap:12px";
    const av = document.createElement("div"); av.style.width = "48px"; av.appendChild(avatar(i));
    const info = document.createElement("div");
    info.innerHTML = `<b>${p.nom}</b><br><small style="color:var(--ink-soft)">${cfg.paliers[p.palier].label} · ${cfg.paliers[p.palier].age} ans · ${Store.totalStars(p)} ⭐</small>`;
    left.append(av, info);
    const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:8px";
    const edit = smallBtn("gear", "Modifier", () => editProfile(p, cfg, () => renderProfiles(list, cfg, go)));
    const del = smallBtn("trash", "Supprimer", () => {
      if (confirm(`Supprimer ${p.nom} ?`)) { Store.removeProfile(p.id); renderProfiles(list, cfg, go); }
    });
    del.querySelector("svg").style.color = "var(--alert)";
    actions.append(edit, del);
    row.append(left, actions);
    list.appendChild(row);
  });
}

function smallBtn(ic, label, fn) {
  const b = document.createElement("button"); b.className = "btn-round small";
  b.setAttribute("aria-label", label); b.appendChild(icon(ic)); onTap(b, fn); return b;
}

/* Formulaire de création/édition d'un profil (prénom, avatar, palier). */
function editProfile(existing, cfg, done) {
  const backdrop = document.createElement("div"); backdrop.className = "modal-backdrop";
  const modal = document.createElement("div"); modal.className = "modal";
  const nom = existing ? existing.nom : "";
  let avatarSeed = existing ? (parseInt((existing.avatar || "0").replace(/\D/g, ""), 10) || 0) : 0;
  let palier = existing ? existing.palier : "petit";

  modal.innerHTML = `<h2 style="margin-top:0">${existing ? "Modifier" : "Nouvel enfant"}</h2>`;
  const nameInput = document.createElement("input");
  nameInput.placeholder = "Prénom"; nameInput.value = nom; nameInput.maxLength = 12;
  nameInput.style.cssText = "font-size:22px;padding:12px;width:100%;border-radius:14px;border:2px solid var(--ink-soft);margin-bottom:16px";
  modal.appendChild(nameInput);

  // Choix d'avatar.
  const avRow = document.createElement("div"); avRow.style.cssText = "display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap";
  for (let i = 0; i < 5; i++) {
    const a = document.createElement("button");
    a.style.cssText = "width:64px;height:64px;border-radius:16px;background:var(--surface);padding:6px";
    a.appendChild(avatar(i));
    const mark = () => avRow.querySelectorAll("button").forEach((b, j) =>
      b.style.outline = j === avatarSeed ? "4px solid var(--primary)" : "none");
    onTap(a, () => { avatarSeed = i; mark(); });
    avRow.appendChild(a);
    if (i === avatarSeed) a.style.outline = "4px solid var(--primary)";
  }
  modal.appendChild(avRow);

  // Choix du palier.
  const seg = document.createElement("div"); seg.className = "seg"; seg.style.marginBottom = "20px";
  Object.entries(cfg.paliers).forEach(([key, val]) => {
    const b = document.createElement("button");
    b.textContent = `${val.label} (${val.age})`;
    if (key === palier) b.classList.add("on");
    onTap(b, () => { palier = key; seg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); });
    seg.appendChild(b);
  });
  modal.appendChild(seg);

  const save = document.createElement("button"); save.className = "btn-pill"; save.textContent = "Enregistrer";
  onTap(save, () => {
    const finalNom = nameInput.value.trim() || "Enfant";
    if (existing) Store.updateProfile(existing.id, { nom: finalNom, avatar: "avatar-" + avatarSeed, palier });
    else Store.addProfile({ nom: finalNom, avatar: "avatar-" + avatarSeed, palier });
    Audio.play("success"); close(); done();
  });
  const cancel = document.createElement("button"); cancel.className = "btn-pill ghost"; cancel.textContent = "Annuler";
  cancel.style.marginLeft = "10px"; onTap(cancel, () => close());
  const row = document.createElement("div"); row.append(save, cancel); modal.appendChild(row);

  backdrop.appendChild(modal); document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));
  function close() { backdrop.classList.remove("open"); setTimeout(() => backdrop.remove(), 260); }
}

/* Tableau de progression : temps de jeu / jour, étoiles par module. */
function renderProgress(panel, cfg) {
  const p = Store.getActive() || Store.getProfiles()[0];
  if (!p) { panel.appendChild(txt("Aucun enfant sélectionné.")); return; }

  const today = document.createElement("div"); today.className = "parent-row";
  today.innerHTML = `<span>⏱️ Temps aujourd'hui</span><b>${Store.todayMinutes(p)} min</b>`;
  panel.appendChild(today);

  Object.entries(cfg.jeux).forEach(([id, g]) => {
    const stars = Store.starsFor(id, p);
    const row = document.createElement("div"); row.className = "parent-row";
    const bar = document.createElement("div"); bar.className = "progress-bar-mini";
    const fill = document.createElement("i");
    fill.style.width = Math.min(100, stars) + "%"; bar.appendChild(fill);
    const l = document.createElement("span"); l.textContent = g.nom; l.style.minWidth = "130px";
    const s = document.createElement("b"); s.textContent = stars + " ⭐"; s.style.minWidth = "56px"; s.style.textAlign = "right";
    row.append(l, bar, s); panel.appendChild(row);
  });
}

function renderSettings(panel) {
  const s = Store.getSettings();

  panel.appendChild(sliderRow("🔊 Voix", s.volumeVoix, v => { Store.setSettings({ volumeVoix: v }); Audio.setVolumes({ voix: v }); }));
  panel.appendChild(sliderRow("🎵 Effets", s.volumeSfx, v => { Store.setSettings({ volumeSfx: v }); Audio.setVolumes({ sfx: v }); Audio.play("tap"); }));

  // Mode sombre.
  const darkRow = document.createElement("div"); darkRow.className = "parent-row";
  const dl = document.createElement("span"); dl.textContent = "🌙 Mode soir";
  const toggle = document.createElement("button"); toggle.className = "btn-pill ghost";
  const setLabel = () => toggle.textContent = Store.getSettings().sombre ? "Activé" : "Désactivé";
  setLabel();
  onTap(toggle, () => {
    const v = !Store.getSettings().sombre; Store.setSettings({ sombre: v });
    document.documentElement.dataset.theme = v ? "sombre" : ""; setLabel(); Audio.play("tap");
  });
  darkRow.append(dl, toggle); panel.appendChild(darkRow);

  // Minuteur de session.
  const timerRow = document.createElement("div"); timerRow.className = "parent-row";
  const tl = document.createElement("span"); tl.textContent = "⏳ Durée de session";
  const seg = document.createElement("div"); seg.className = "seg";
  [15, 30, 45].forEach(m => {
    const b = document.createElement("button"); b.textContent = m + " min";
    if (s.minuteur === m) b.classList.add("on");
    onTap(b, () => { Store.setSettings({ minuteur: m }); seg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); Audio.play("tap"); });
    seg.appendChild(b);
  });
  timerRow.append(tl, seg); panel.appendChild(timerRow);
}

function sliderRow(label, value, onChange) {
  const row = document.createElement("div"); row.className = "parent-row";
  const l = document.createElement("span"); l.textContent = label;
  const input = document.createElement("input");
  input.type = "range"; input.min = "0"; input.max = "1"; input.step = "0.1"; input.value = value;
  input.addEventListener("input", () => onChange(parseFloat(input.value)));
  row.append(l, input); return row;
}

function txt(t) { const d = document.createElement("p"); d.style.color = "var(--ink-soft)"; d.textContent = t; return d; }
