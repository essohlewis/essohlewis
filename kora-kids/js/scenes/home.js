/* home.js — Écran d'accueil : choix du profil enfant (avatars, pas de clavier). */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { avatar, icon } from "../core/art.js";
import { onTap } from "../core/input.js";
import { soundToggle } from "../core/router.js";
import { applyTapSize } from "../core/a11y.js";

export default function home(scene, _params, { go }) {
  scene.classList.add("home");

  // Bouton parent (petit, en haut à droite).
  const gear = document.createElement("button");
  gear.className = "btn-round small parent-gear";
  gear.setAttribute("aria-label", "Espace parent");
  gear.appendChild(icon("gear"));
  onTap(gear, () => { Audio.play("tap"); go("parent"); });
  scene.appendChild(gear);

  const mute = soundToggle();
  mute.style.cssText = "position:absolute;top:12px;left:12px";
  scene.appendChild(mute);

  const brand = document.createElement("div");
  brand.className = "brand";
  brand.innerHTML = `KORA<br>KIDS<small>joue &amp; apprends</small>`;
  scene.appendChild(brand);

  const wrap = document.createElement("div");
  wrap.className = "avatars";
  scene.appendChild(wrap);

  const profiles = Store.getProfiles();

  profiles.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "avatar-pick";
    btn.setAttribute("aria-label", p.nom);
    const av = document.createElement("div"); av.className = "av bob";
    av.style.animationDelay = (i * 0.2) + "s";
    av.appendChild(avatar(i, accFromProfile(p)));
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = p.nom;
    btn.append(av, nm);
    onTap(btn, () => {
      Audio.play("success");
      Store.setActive(p.id);
      applyTapSize(p.palier);
      Audio.speak("Bonjour " + p.nom + " !");
      go("map");
    });
    wrap.appendChild(btn);
  });

  // Bouton "ajouter un enfant" (jusqu'à 4 profils) — passe par l'espace parent.
  if (profiles.length < 4) {
    const add = document.createElement("button");
    add.className = "avatar-pick add";
    add.setAttribute("aria-label", "Ajouter un enfant");
    add.innerHTML = `<div class="av">${bigPlus()}</div><div class="nm">Ajouter</div>`;
    onTap(add, () => { Audio.play("tap"); go("parent", { createChild: true }); });
    wrap.appendChild(add);
  }

  if (profiles.length === 0) {
    Audio.speak("Bienvenue ! Touche « Ajouter » pour créer un enfant.");
  }
}

function bigPlus() {
  return `<svg viewBox="0 0 100 100" style="width:60%"><path d="M50 24v52M24 50h52" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>`;
}

export function accFromProfile(p) {
  const a = p.accessoires || [];
  return { hat: a.includes("chapeau"), glasses: a.includes("lunettes"), scarf: a.includes("pagne") || a.includes("collier") };
}
