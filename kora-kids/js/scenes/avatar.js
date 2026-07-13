/* avatar.js — Garde-robe : l'enfant habille son avatar avec les accessoires
   débloqués par ses étoiles. Le vrai moteur de motivation à cet âge.
   Accessoires verrouillés : affichés avec le palier d'étoiles à atteindre. */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { avatar, icon, starSVG } from "../core/art.js";
import { onTap } from "../core/input.js";
import Router from "../core/router.js";
import { reducedMotion } from "../core/a11y.js";

export default function avatarScene(scene, params, { go }) {
  scene.classList.add("wardrobe");
  const profile = Store.getActive();
  if (!profile) return go("home");
  const seed = Math.max(0, Store.getProfiles().findIndex(p => p.id === profile.id));

  Router.buildHead(scene, { title: "👕 Mon avatar", onBack: () => go("map"), stars: Store.totalStars(profile) });

  const stage = document.createElement("div"); stage.className = "stage";
  scene.appendChild(stage);

  // Avatar en grand, qui danse.
  const big = document.createElement("div"); big.className = "big-avatar bob";
  const renderBig = () => { big.innerHTML = ""; big.appendChild(avatar(seed, Store.getWorn(profile))); };
  renderBig();
  stage.appendChild(big);

  // Grille d'accessoires.
  const grid = document.createElement("div"); grid.className = "acc-grid";
  stage.appendChild(grid);

  Store.ACCESSOIRES.forEach(acc => {
    const unlocked = Store.isUnlocked(acc.id, profile);
    const card = document.createElement("button");
    card.className = "acc-card" + (unlocked ? "" : " locked");
    card.setAttribute("aria-label", unlocked ? acc.nom : `${acc.nom} — verrouillé`);

    // Aperçu : mini-avatar portant uniquement cet accessoire.
    const av = document.createElement("div"); av.className = "acc-av";
    av.appendChild(avatar(seed, [acc.id]));
    card.appendChild(av);

    const label = document.createElement("div"); label.className = "acc-label";
    card.appendChild(label);

    const check = document.createElement("div"); check.className = "acc-check";
    check.appendChild(icon("check")); card.appendChild(check);

    const paint = () => {
      const worn = Store.isWorn(acc.id, profile);
      card.classList.toggle("worn", worn);
      if (unlocked) label.textContent = acc.nom;
      else { label.innerHTML = `<span class="acc-lock">${starTag(acc.tier)}</span>`; }
    };
    paint();

    if (unlocked) {
      onTap(card, () => {
        Store.toggleWorn(acc.id);
        const nowWorn = Store.isWorn(acc.id, profile);
        Audio.play(nowWorn ? "success" : "tap");
        Audio.speak(nowWorn ? cap(acc.nom) : "");
        renderBig();
        if (!reducedMotion) { big.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
          { duration: 380, easing: "cubic-bezier(.2,.9,.3,1.2)" }); }
        paint();
      });
    } else {
      onTap(card, () => { Audio.play("neutral"); Audio.speak(`Gagne ${acc.tier} étoiles pour débloquer ${acc.nom}.`); });
    }

    grid.appendChild(card);
  });

  // Message de bienvenue vocal.
  const anyLocked = Store.ACCESSOIRES.some(a => !Store.isUnlocked(a.id, profile));
  Audio.speak(anyLocked ? "Habille ton avatar ! Gagne des étoiles pour débloquer plus d'accessoires."
                        : "Habille ton avatar comme tu veux !");
}

function starTag(n) {
  return `<svg viewBox="0 0 100 100" style="width:20px;height:20px;vertical-align:-4px"><path d="M50 8l12 26 28 3-21 19 6 28-25-15-25 15 6-28L9 37l28-3z" fill="var(--reward)"/></svg> ${n}`;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
