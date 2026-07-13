/* art.js — Fabrique d'illustrations SVG procédurales.
   Zéro asset binaire : tout est dessiné en code, coloré en CSS, redimensionnable.
   Si un vrai fichier SVG/PNG existe (data/*.img), on l'utilise à la place. */

const NS = "http://www.w3.org/2000/svg";

/* Construit un élément SVG à partir d'un contenu <path>/<shape> interne. */
export function svg(inner, { viewBox = "0 0 100 100", cls = "" } = {}) {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", viewBox);
  el.setAttribute("part", "art");
  if (cls) el.setAttribute("class", cls);
  el.innerHTML = inner;
  return el;
}

/* ---------- Icônes d'interface ---------- */
const ICONS = {
  home:   `<path d="M50 14 12 46h10v40h20V62h16v24h20V46h10z" fill="currentColor"/>`,
  back:   `<path d="M62 18 30 50l32 32" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
  replay: `<path d="M50 22a28 28 0 1 0 26 18" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/><path d="M74 16v22H52z" fill="currentColor"/>`,
  sound:  `<path d="M20 40h14l18-16v52L34 60H20z" fill="currentColor"/><path d="M64 38a14 14 0 0 1 0 24M72 30a26 26 0 0 1 0 40" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  mute:   `<path d="M20 40h14l18-16v52L34 60H20z" fill="currentColor"/><path d="M64 40l22 22M86 40 64 62" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  gear:   `<path d="M50 34a16 16 0 1 0 0 32 16 16 0 0 0 0-32zm0 10a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" fill="currentColor"/><path d="M50 8l6 10a34 34 0 0 1 8 3l11-4 8 14-8 8a34 34 0 0 1 0 8l8 8-8 14-11-4a34 34 0 0 1-8 3l-6 10h-0l-6-10a34 34 0 0 1-8-3l-11 4-8-14 8-8a34 34 0 0 1 0-8l-8-8 8-14 11 4a34 34 0 0 1 8-3z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>`,
  lock:   `<rect x="26" y="46" width="48" height="38" rx="8" fill="currentColor"/><path d="M36 46v-8a14 14 0 0 1 28 0v8" fill="none" stroke="currentColor" stroke-width="8"/>`,
  star:   `<path d="M50 8l12 26 28 3-21 19 6 28-25-15-25 15 6-28L9 37l28-3z" fill="currentColor"/>`,
  play:   `<path d="M32 22v56l44-28z" fill="currentColor"/>`,
  basket: `<path d="M18 40h64l-8 40a8 8 0 0 1-8 6H34a8 8 0 0 1-8-6z" fill="currentColor"/><path d="M32 40 44 18M68 40 56 18" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  check:  `<path d="M20 52l20 20 40-44" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
  trash:  `<path d="M30 38h40l-4 44a8 8 0 0 1-8 7H42a8 8 0 0 1-8-7z" fill="currentColor"/><path d="M26 30h48M42 30v-6a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  close:  `<path d="M28 28l44 44M72 28 28 72" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>`
};
export function icon(name) { return svg(ICONS[name] || ICONS.star, { cls: "icon" }); }

/* ---------- Étoile de récompense (couleur or) ---------- */
export function starSVG() { return svg(`<path d="M50 8l12 26 28 3-21 19 6 28-25-15-25 15 6-28L9 37l28-3z" fill="var(--reward)" stroke="#e0a800" stroke-width="2"/>`); }

/* ---------- Avatars enfants (5 variantes colorées) ----------
   `worn` : liste d'accessoires portés (chapeau, pagne, sac, lunettes, ballon,
   collier). Rétro-compat : accepte aussi l'ancien objet {hat,glasses,scarf}. */
const AV_SKIN = ["#7a4a2b", "#8d5a34", "#a06a3e"];
const AV_HAIR = ["#1B2432", "#2b2018", "#3a2a1a"];
export function avatar(seed = 0, worn = []) {
  if (worn && !Array.isArray(worn)) {         // compat ancien objet
    const o = worn; worn = [];
    if (o.hat) worn.push("chapeau"); if (o.glasses) worn.push("lunettes"); if (o.scarf) worn.push("pagne");
  }
  const has = (id) => worn.includes(id);
  const skin = AV_SKIN[seed % AV_SKIN.length];
  const hair = AV_HAIR[(seed + 1) % AV_HAIR.length];
  const shirt = ["#FF9F1C", "#2EC4B6", "#E71D36", "#FFD166", "#6A4C93"][seed % 5];

  const sac = has("sac") ? `<path d="M42 62 26 86" stroke="#5a3a20" stroke-width="4" fill="none"/><rect x="14" y="80" width="22" height="18" rx="5" fill="#E71D36"/><rect x="20" y="80" width="10" height="6" rx="3" fill="#a81026"/>` : "";
  const ballon = has("ballon") ? `<circle cx="84" cy="90" r="11" fill="#2EC4B6"/><path d="M73 90h22M84 79v22" stroke="#1B2432" stroke-width="2.5"/>` : "";
  const pagne = has("pagne") ? `<path d="M30 64 66 90 60 99 24 73z" fill="#FF9F1C"/><path d="M33 68 63 90M28 74 58 96" stroke="#E71D36" stroke-width="3"/>` : "";
  const collier = has("collier") ? `<g fill="#FFD166" stroke="#e0a800" stroke-width="1.5"><circle cx="38" cy="67" r="3.2"/><circle cx="44" cy="72" r="3.2"/><circle cx="50" cy="74" r="3.4"/><circle cx="56" cy="72" r="3.2"/><circle cx="62" cy="67" r="3.2"/></g>` : "";
  const lunettes = has("lunettes") ? `<path d="M49 46h2" stroke="#1B2432" stroke-width="3"/><circle cx="41" cy="46" r="8" fill="rgba(255,255,255,.25)" stroke="#1B2432" stroke-width="3"/><circle cx="59" cy="46" r="8" fill="rgba(255,255,255,.25)" stroke="#1B2432" stroke-width="3"/><path d="M33 45h-6M67 45h6" stroke="#1B2432" stroke-width="3"/>` : "";
  const chapeau = has("chapeau") ? `<path d="M24 30h52l-6-14H30z" fill="#2EC4B6"/><rect x="18" y="28" width="64" height="8" rx="4" fill="#1B2432"/>` : "";

  return svg(`
    ${sac}${ballon}
    <circle cx="50" cy="86" r="34" fill="${shirt}"/>
    ${pagne}${collier}
    <circle cx="50" cy="46" r="26" fill="${skin}"/>
    <path d="M24 44a26 26 0 0 1 52 0q-8-10-26-10T24 44z" fill="${hair}"/>
    <circle cx="41" cy="46" r="4" fill="#1B2432"/>
    <circle cx="59" cy="46" r="4" fill="#1B2432"/>
    <path d="M42 58q8 7 16 0" fill="none" stroke="#1B2432" stroke-width="3" stroke-linecap="round"/>
    ${lunettes}${chapeau}
  `);
}

/* ---------- Huttes de la carte (une couleur par jeu) ---------- */
export function hut(color) {
  return svg(`
    <path d="M50 12 14 44h72z" fill="${color}"/>
    <rect x="22" y="44" width="56" height="42" rx="6" fill="${color}"/>
    <rect x="40" y="58" width="20" height="28" rx="6" fill="rgba(0,0,0,.25)"/>
    <path d="M14 44h72" stroke="rgba(0,0,0,.2)" stroke-width="4"/>
  `);
}

/* ---------- Formes géométriques (jeu Formes) ---------- */
export function shape(kind, color) {
  const s = {
    rond:      `<circle cx="50" cy="50" r="40" fill="${color}"/>`,
    carre:     `<rect x="14" y="14" width="72" height="72" rx="8" fill="${color}"/>`,
    triangle:  `<path d="M50 12 88 82H12z" fill="${color}"/>`,
    etoile:    `<path d="M50 8l12 26 28 3-21 19 6 28-25-15-25 15 6-28L9 37l28-3z" fill="${color}"/>`,
    coeur:     `<path d="M50 84C18 60 16 36 32 28c10-5 18 2 18 8 0-6 8-13 18-8 16 8 14 32-18 56z" fill="${color}"/>`,
    croissant: `<path d="M62 12a40 40 0 1 0 0 76 32 32 0 0 1 0-76z" fill="${color}"/>`
  };
  return svg(s[kind] || s.rond);
}

/* ---------- Pièces / billets FCFA (stylisés, non photoréalistes) ---------- */
export function money(value) {
  const isBill = value >= 500;
  if (isBill) {
    const col = value >= 1000 ? "#2EC4B6" : "#FF9F1C";
    return svg(`<rect x="4" y="24" width="92" height="52" rx="8" fill="${col}"/>
      <rect x="12" y="32" width="76" height="36" rx="5" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
      <text x="50" y="57" font-size="26" font-weight="900" text-anchor="middle" fill="#fff">${value}</text>
      <text x="50" y="70" font-size="9" text-anchor="middle" fill="#fff" opacity=".85">FCFA</text>`,
      { viewBox: "0 0 100 100" });
  }
  const col = value >= 100 ? "#FFD166" : "#F2E9DC";
  return svg(`<circle cx="50" cy="50" r="42" fill="${col}" stroke="#c99a24" stroke-width="4"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="#c99a24" stroke-width="2" opacity=".6"/>
    <text x="50" y="52" font-size="26" font-weight="900" text-anchor="middle" fill="#7a5a10">${value}</text>
    <text x="50" y="68" font-size="10" text-anchor="middle" fill="#7a5a10">F</text>`);
}

/* ---------- Motifs wax (dos des cartes Memory + filigrane) ---------- */
export function wax(seed = 0) {
  const cols = [["#FF9F1C", "#E71D36"], ["#2EC4B6", "#1B2432"], ["#FFD166", "#6A4C93"], ["#E71D36", "#FDFCF7"], ["#2EC4B6", "#FF9F1C"], ["#1B2432", "#FFD166"]];
  const [a, b] = cols[seed % cols.length];
  const pats = [
    `<rect width="100" height="100" fill="${a}"/><circle cx="50" cy="50" r="26" fill="${b}"/><circle cx="50" cy="50" r="12" fill="${a}"/>`,
    `<rect width="100" height="100" fill="${a}"/><path d="M0 50h100M50 0v100" stroke="${b}" stroke-width="14"/>`,
    `<rect width="100" height="100" fill="${b}"/><path d="M50 10l40 40-40 40L10 50z" fill="${a}"/>`,
    `<rect width="100" height="100" fill="${a}"/><path d="M20 20h60v60H20z" fill="none" stroke="${b}" stroke-width="10"/><circle cx="50" cy="50" r="8" fill="${b}"/>`,
    `<rect width="100" height="100" fill="${b}"/><circle cx="25" cy="25" r="14" fill="${a}"/><circle cx="75" cy="25" r="14" fill="${a}"/><circle cx="25" cy="75" r="14" fill="${a}"/><circle cx="75" cy="75" r="14" fill="${a}"/>`,
    `<rect width="100" height="100" fill="${a}"/><path d="M0 0l100 100M100 0L0 100" stroke="${b}" stroke-width="12"/>`
  ];
  return svg(pats[seed % pats.length]);
}

/* Motif wax en data-URI pour l'arrière-plan filigrane. */
export function waxDataURL(seed = 0) {
  const el = wax(seed);
  const s = new XMLSerializer().serializeToString(el);
  return `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
}

/* ---------- Fruits & produits du marché ---------- */
export function produce(kind) {
  const P = {
    mangue:  `<path d="M50 14c22 0 34 18 34 36S66 88 50 88 16 68 16 50 28 14 50 14z" fill="#FF9F1C"/><path d="M50 14q8 2 8 10" stroke="#2EC4B6" stroke-width="4" fill="none"/>`,
    banane:  `<path d="M22 30q40 60 60 40q-6 24-40 20T18 52z" fill="#FFD166" stroke="#c99a24" stroke-width="2"/>`,
    tomate:  `<circle cx="50" cy="56" r="34" fill="#E71D36"/><path d="M50 22l-8-8m8 8 8-8m-8 8v-6" stroke="#2EC4B6" stroke-width="5" stroke-linecap="round"/>`,
    piment:  `<path d="M40 20q6 40 -6 60t-20 4q24 4 40-16t2-48z" fill="#E71D36"/><path d="M40 20q6-8 14-8" stroke="#2EC4B6" stroke-width="5" fill="none"/>`,
    igname:  `<path d="M24 40q0-16 26-16t26 16-6 44-20 4-26-32z" fill="#8d5a34"/>`,
    arachides:`<path d="M40 20q18 0 18 22t18 22-6 18-24 2-24-18 6-24 12-22z" fill="#d9b382" stroke="#a07a3a" stroke-width="2"/>`,
    attieke: `<ellipse cx="50" cy="60" rx="36" ry="22" fill="#FDFCF7" stroke="#e0d6c0" stroke-width="3"/><circle cx="40" cy="58" r="4" fill="#FFD166"/><circle cx="54" cy="54" r="4" fill="#FFD166"/><circle cx="60" cy="64" r="4" fill="#FFD166"/><circle cx="46" cy="66" r="4" fill="#FFD166"/>`,
    alloco:  `<rect x="24" y="38" width="52" height="30" rx="14" fill="#FF9F1C" transform="rotate(-12 50 50)"/><rect x="30" y="52" width="52" height="26" rx="12" fill="#e07b00" transform="rotate(8 55 60)"/>`,
    poisson: `<path d="M18 50q20-24 50 0-20 24-50 0z" fill="#2EC4B6"/><path d="M68 50l20-12v24z" fill="#2EC4B6"/><circle cx="34" cy="46" r="3" fill="#1B2432"/>`,
    pain:    `<path d="M14 58q0-24 36-24t36 24q0 12-36 12T14 58z" fill="#d9a45b" stroke="#a06a2e" stroke-width="2"/><path d="M34 42l6 20M50 40v22M66 42l-6 20" stroke="#a06a2e" stroke-width="2"/>`
  };
  return svg(P[kind] || P.mangue);
}

/* ---------- Animaux (silhouettes pleines, reconnaissables) ---------- */
export function animal(kind) {
  const A = {
    elephant: `<ellipse cx="52" cy="56" rx="34" ry="26" fill="#8a94a6"/><circle cx="30" cy="46" r="20" fill="#8a94a6"/><path d="M22 54q-6 20 2 30t8-2" fill="#8a94a6"/><path d="M40 40q10-6 20 0" stroke="#5c6473" stroke-width="3" fill="none"/><circle cx="30" cy="42" r="3" fill="#1B2432"/><path d="M70 74v10M56 76v10" stroke="#8a94a6" stroke-width="8" stroke-linecap="round"/>`,
    lion:    `<circle cx="50" cy="50" r="30" fill="#FF9F1C"/><circle cx="50" cy="50" r="22" fill="#FFD166"/><circle cx="42" cy="48" r="3" fill="#1B2432"/><circle cx="58" cy="48" r="3" fill="#1B2432"/><path d="M44 58q6 6 12 0" stroke="#1B2432" stroke-width="3" fill="none"/><path d="M50 54l-4 4h8z" fill="#8a5a2b"/>`,
    agouti:  `<ellipse cx="52" cy="58" rx="30" ry="20" fill="#8d5a34"/><circle cx="28" cy="52" r="14" fill="#8d5a34"/><path d="M20 46l-6-6M22 42l-8-2" stroke="#8d5a34" stroke-width="4"/><circle cx="26" cy="50" r="2.5" fill="#1B2432"/><path d="M78 60q10 4 8 14" stroke="#8d5a34" stroke-width="5" fill="none"/>`,
    coq:     `<ellipse cx="50" cy="60" rx="24" ry="20" fill="#E71D36"/><circle cx="64" cy="42" r="12" fill="#E71D36"/><path d="M64 30q4-10 12-6t-4 10z" fill="#c81028"/><path d="M74 42l10-2-8 6z" fill="#FFD166"/><circle cx="66" cy="40" r="2.5" fill="#1B2432"/><path d="M28 66q-12 4-14 16M34 68q-10 8-8 18" stroke="#FF9F1C" stroke-width="4" fill="none"/>`,
    chevre:  `<ellipse cx="52" cy="58" rx="28" ry="18" fill="#F2E9DC"/><circle cx="30" cy="50" r="13" fill="#F2E9DC"/><path d="M24 40q-4-10 2-16M32 40q0-12 8-16" stroke="#b9a888" stroke-width="4" fill="none"/><circle cx="27" cy="50" r="2.5" fill="#1B2432"/><path d="M26 58v6" stroke="#b9a888" stroke-width="3"/>`,
    mouton:  `<circle cx="52" cy="56" r="28" fill="#FDFCF7" stroke="#e0d6c0" stroke-width="3"/><circle cx="28" cy="52" r="13" fill="#3a2a1a"/><circle cx="24" cy="50" r="2.5" fill="#fff"/><path d="M20 46q-6-2-6 4" stroke="#3a2a1a" stroke-width="4" fill="none"/>`,
    hippopotame:`<ellipse cx="52" cy="58" rx="34" ry="24" fill="#6A4C93"/><ellipse cx="26" cy="60" rx="18" ry="14" fill="#6A4C93"/><circle cx="20" cy="62" r="3" fill="#1B2432"/><circle cx="30" cy="62" r="3" fill="#1B2432"/><circle cx="26" cy="46" r="4" fill="#54366f"/>`,
    crocodile:`<path d="M10 60q30-10 80 0-50 10-80 0z" fill="#2EC4B6"/><path d="M14 58l6-8 6 8 6-8 6 8 6-8 6 8" fill="none" stroke="#1f8f84" stroke-width="3"/><circle cx="70" cy="52" r="4" fill="#1B2432"/>`,
    singe:   `<circle cx="50" cy="52" r="24" fill="#5a4232"/><circle cx="50" cy="56" r="16" fill="#d9b382"/><circle cx="30" cy="46" r="8" fill="#5a4232"/><circle cx="70" cy="46" r="8" fill="#5a4232"/><circle cx="43" cy="52" r="3" fill="#1B2432"/><circle cx="57" cy="52" r="3" fill="#1B2432"/><path d="M44 62q6 5 12 0" stroke="#1B2432" stroke-width="2.5" fill="none"/>`,
    perroquet:`<ellipse cx="52" cy="54" rx="20" ry="26" fill="#2EC4B6"/><circle cx="52" cy="34" r="13" fill="#E71D36"/><path d="M52 34l-12 4 12 6z" fill="#FFD166"/><circle cx="50" cy="32" r="2.5" fill="#1B2432"/><path d="M64 50q14 6 8 22" stroke="#FF9F1C" stroke-width="6" fill="none"/>`,
    poisson: `<path d="M18 50q20-24 50 0-20 24-50 0z" fill="#FF9F1C"/><path d="M68 50l20-12v24z" fill="#FF9F1C"/><circle cx="34" cy="46" r="3" fill="#1B2432"/>`,
    tortue:  `<ellipse cx="50" cy="56" rx="30" ry="22" fill="#2EC4B6"/><path d="M50 34v44M28 56h44M36 40l28 32M64 40 36 72" stroke="#1f8f84" stroke-width="3"/><circle cx="82" cy="52" r="9" fill="#8d5a34"/><circle cx="84" cy="50" r="2" fill="#1B2432"/>`,
    serpent: `<path d="M18 70q10-30 30-20t30-20" fill="none" stroke="#6A4C93" stroke-width="14" stroke-linecap="round"/><circle cx="78" cy="30" r="3" fill="#1B2432"/>`,
    panthere:`<ellipse cx="52" cy="56" rx="30" ry="20" fill="#1B2432"/><circle cx="28" cy="50" r="13" fill="#1B2432"/><circle cx="24" cy="48" r="2.5" fill="#FFD166"/><path d="M40 44l4 4M56 42l4 4M64 54l4 4" stroke="#33405a" stroke-width="3"/>`,
    buffle:  `<ellipse cx="52" cy="58" rx="30" ry="20" fill="#4a3728"/><circle cx="30" cy="52" r="14" fill="#4a3728"/><path d="M18 46q-8-8-2-14M42 46q8-8 2-14" stroke="#2b2018" stroke-width="5" fill="none"/><circle cx="27" cy="52" r="2.5" fill="#1B2432"/>`,
    canard:  `<ellipse cx="50" cy="58" rx="26" ry="18" fill="#FDFCF7"/><circle cx="70" cy="44" r="11" fill="#FDFCF7"/><path d="M78 44l12 2-12 5z" fill="#FF9F1C"/><circle cx="72" cy="42" r="2.5" fill="#1B2432"/>`,
    chien:   `<ellipse cx="52" cy="58" rx="26" ry="18" fill="#8d5a34"/><circle cx="30" cy="50" r="14" fill="#8d5a34"/><path d="M20 42q-8 2-6 14z" fill="#5a3a20"/><circle cx="26" cy="50" r="2.5" fill="#1B2432"/><path d="M28 58v4" stroke="#1B2432" stroke-width="3"/>`,
    chat:    `<ellipse cx="52" cy="58" rx="24" ry="17" fill="#8a94a6"/><circle cx="32" cy="50" r="13" fill="#8a94a6"/><path d="M24 40l2-10 8 8M40 40l-2-10-8 8" fill="#8a94a6"/><circle cx="28" cy="50" r="2.5" fill="#1B2432"/><circle cx="37" cy="50" r="2.5" fill="#1B2432"/>`,
    ane:     `<ellipse cx="52" cy="58" rx="28" ry="18" fill="#9aa0ac"/><circle cx="30" cy="48" r="12" fill="#9aa0ac"/><path d="M24 38q-3-14 3-16M34 38q3-14-3-16" fill="#9aa0ac"/><circle cx="27" cy="48" r="2.5" fill="#1B2432"/>`,
    pintade: `<ellipse cx="50" cy="56" rx="24" ry="22" fill="#33405a"/><circle cx="50" cy="56" r="20" fill="#4a5a78"/><circle cx="42" cy="50" r="2.5" fill="#fff"/><circle cx="58" cy="50" r="2.5" fill="#fff"/><circle cx="46" cy="62" r="2.5" fill="#fff"/><circle cx="56" cy="64" r="2.5" fill="#fff"/><circle cx="50" cy="34" r="8" fill="#4a5a78"/><path d="M50 26l4-8 4 6z" fill="#E71D36"/>`
  };
  return svg(A[kind] || A.lion);
}

/* ---------- Scènes de fond pour le puzzle (dégradés simples plein) ---------- */
export function sceneImg(kind) {
  const S = {
    village: `<rect width="100" height="100" fill="#8ec6e6"/><rect y="66" width="100" height="34" fill="#7a9a4a"/><path d="M20 66 34 44 48 66z" fill="#c0603a"/><rect x="24" y="58" width="20" height="12" fill="#8d5a34"/><path d="M58 66 72 42 86 66z" fill="#c0603a"/><rect x="62" y="56" width="20" height="14" fill="#8d5a34"/><circle cx="82" cy="20" r="9" fill="#FFD166"/>`,
    savane:  `<rect width="100" height="100" fill="#f6d27a"/><rect y="70" width="100" height="30" fill="#c99a4a"/><circle cx="22" cy="66" r="14" fill="#4a7a3a"/><rect x="20" y="66" width="4" height="20" fill="#5a3a20"/><path d="M60 70q4-22 10-22t10 22" fill="#4a7a3a"/><rect x="68" y="60" width="4" height="26" fill="#5a3a20"/><circle cx="80" cy="22" r="10" fill="#FF9F1C"/>`,
    marche:  `<rect width="100" height="100" fill="#f2c94c"/><rect y="60" width="100" height="40" fill="#c0603a"/><rect x="10" y="46" width="34" height="18" fill="#2EC4B6"/><rect x="56" y="46" width="34" height="18" fill="#E71D36"/><circle cx="20" cy="44" r="4" fill="#FF9F1C"/><circle cx="30" cy="44" r="4" fill="#FFD166"/><circle cx="66" cy="44" r="4" fill="#FDFCF7"/>`,
    lagune:  `<rect width="100" height="100" fill="#a6e0d6"/><rect y="60" width="100" height="40" fill="#2EC4B6"/><path d="M0 60q25-10 50 0t50 0v6H0z" fill="#1f8f84"/><circle cx="78" cy="20" r="9" fill="#FFD166"/><path d="M14 60q6-20 12-20t12 20" fill="#4a7a3a"/>`
  };
  return svg(S[kind] || S.village, { viewBox: "0 0 100 100" });
}

/* ---------- Objets culturels divers (alphabet, etc.) ---------- */
export function misc(kind) {
  const M = {
    tam:    `<path d="M30 30h40l-6 46a14 8 0 0 1-28 0z" fill="#8d5a34"/><ellipse cx="50" cy="30" rx="20" ry="8" fill="#FDFCF7" stroke="#5a3a20" stroke-width="3"/><path d="M32 34l8 40M68 34l-8 40" stroke="#e0d6c0" stroke-width="3"/>`,
    pagne:  `<rect x="14" y="18" width="72" height="64" rx="6" fill="#FF9F1C"/><path d="M14 34h72M14 50h72M14 66h72" stroke="#E71D36" stroke-width="5"/><circle cx="32" cy="26" r="4" fill="#2EC4B6"/><circle cx="68" cy="42" r="4" fill="#2EC4B6"/><circle cx="32" cy="58" r="4" fill="#2EC4B6"/><circle cx="68" cy="74" r="4" fill="#2EC4B6"/>`,
    arbre:  `<rect x="46" y="52" width="8" height="34" fill="#8d5a34"/><circle cx="50" cy="40" r="26" fill="#2EC4B6"/><circle cx="34" cy="46" r="14" fill="#2EC4B6"/><circle cx="66" cy="46" r="14" fill="#2EC4B6"/>`,
    quatre: `<text x="50" y="70" font-size="70" font-weight="900" text-anchor="middle" fill="#FF9F1C">4</text>`,
    wax:    ``  /* voir wax() dédié */
  };
  if (kind === "wax") return wax(0);
  return svg(M[kind] || M.pagne);
}

/* Résout un nom d'illustration vers la bonne fabrique (animaux, produits, scènes, objets). */
const ANIMALS = ["elephant","lion","agouti","coq","chevre","mouton","hippopotame","crocodile","singe","perroquet","poisson","tortue","serpent","panthere","buffle","canard","chien","chat","ane","pintade"];
const PRODUCE = ["mangue","banane","tomate","piment","igname","arachides","attieke","alloco","pain"];
const SCENES  = ["village","savane","marche","lagune"];
export function resolveArt(name) {
  if (ANIMALS.includes(name)) return animal(name);
  if (PRODUCE.includes(name)) return produce(name);
  if (SCENES.includes(name))  return sceneImg(name);
  return misc(name);
}

/* Convertit un SVG en data-URL (pour background-image, ex. puzzle). */
export function toDataURL(el) {
  const s = new XMLSerializer().serializeToString(el);
  return `data:image/svg+xml,${encodeURIComponent(s)}`;
}
