/* map.js — Carte du village = menu principal (6 huttes = 6 mini-jeux).
   Cadenas doux (non bloquant) sur les jeux du palier supérieur. */

import Store from "../core/storage.js";
import Audio from "../core/audio.js";
import { hut, icon, starSVG, waxDataURL, avatar } from "../core/art.js";
import { onTap } from "../core/input.js";
import Router from "../core/router.js";

const PALIER_ORDER = { petit: 0, moyen: 1, grand: 2 };

export default async function map(scene, _params, { go }) {
  scene.classList.add("map");
  const cfg = await fetch("js/data/config.json").then(r => r.json());
  const profile = Store.getActive();
  if (!profile) return go("home");

  // Filigrane wax.
  const bg = document.createElement("div");
  bg.className = "wax-bg"; bg.style.backgroundImage = waxDataURL(2);
  scene.appendChild(bg);

  const head = Router.buildHead(scene, {
    title: "🏡 Le village",
    onBack: () => go("home"),
    stars: Store.totalStars(profile)
  });

  // Bouton garde-robe : l'avatar de l'enfant → écran « Mon avatar ».
  const seed = Math.max(0, Store.getProfiles().findIndex(p => p.id === profile.id));
  const wardrobe = document.createElement("button");
  wardrobe.className = "btn-round"; wardrobe.setAttribute("aria-label", "Mon avatar");
  wardrobe.style.overflow = "hidden"; wardrobe.style.padding = "4px";
  wardrobe.appendChild(avatar(seed, Store.getWorn(profile)));
  onTap(wardrobe, () => { Audio.play("tap"); go("avatar"); });
  head.insertBefore(wardrobe, head.querySelector('[data-role="starcount"]'));

  const stage = document.createElement("div"); stage.className = "stage";
  const village = document.createElement("div"); village.className = "village";
  stage.appendChild(village);
  scene.appendChild(stage);

  const order = ["animaux", "formes", "puzzle", "alphabet", "memory", "marche"];
  const playerLevel = PALIER_ORDER[profile.palier];

  order.forEach((gameId) => {
    const g = cfg.jeux[gameId];
    const locked = PALIER_ORDER[g.palierMin] > playerLevel;   // cadenas doux, non bloquant

    const btn = document.createElement("button");
    btn.className = "hut" + (locked ? " locked" : "");
    btn.setAttribute("aria-label", g.nom);
    btn.appendChild(hut(g.couleur));

    if (locked) {
      const badge = document.createElement("div");
      badge.className = "lock-badge"; badge.appendChild(icon("lock"));
      btn.appendChild(badge);
    }

    const stars = Store.starsFor(gameId, profile);
    if (stars > 0) {
      const s = document.createElement("div"); s.className = "hut-stars";
      s.appendChild(starSVG());
      const n = document.createElement("span"); n.textContent = stars; s.appendChild(n);
      btn.appendChild(s);
    }

    onTap(btn, () => {
      Audio.play("tap");
      Audio.speak(g.nom);
      // Le cadenas ne bloque jamais : on entre quand même (version la plus facile).
      go("game", { gameId });
    });
    village.appendChild(btn);
  });
}
