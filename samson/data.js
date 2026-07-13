/* =============================================================
   SAMSON — Données du jeu
   Chaque énigme : id, name, alias?, hint, category, level (1..3), svg
   Les illustrations utilisent des couleurs adaptées au thème.
   ============================================================= */

const SAMSON_PUZZLES = [
  /* ====================== NIVEAU 1 — FACILE ====================== */
  {
    id: "soleil", name: "Soleil", level: 1, hint: "Il brille dans le ciel le jour.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <g stroke="#f59e0b" stroke-width="7" stroke-linecap="round">
        <line x1="100" y1="18" x2="100" y2="42"/><line x1="100" y1="158" x2="100" y2="182"/>
        <line x1="18" y1="100" x2="42" y2="100"/><line x1="158" y1="100" x2="182" y2="100"/>
        <line x1="41" y1="41" x2="58" y2="58"/><line x1="142" y1="142" x2="159" y2="159"/>
        <line x1="159" y1="41" x2="142" y2="58"/><line x1="58" y1="142" x2="41" y2="159"/>
      </g>
      <circle cx="100" cy="100" r="42" fill="#fbbf24" stroke="#f59e0b" stroke-width="5"/>
    </svg>`
  },
  {
    id: "etoile", name: "Étoile", level: 1, hint: "On en voit briller la nuit.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 20 L122 78 L184 82 L136 122 L152 182 L100 148 L48 182 L64 122 L16 82 L78 78 Z"
        fill="#fde047" stroke="#eab308" stroke-width="5" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: "coeur", name: "Cœur", alias: ["coeur"], level: 1, hint: "Symbole de l'amour.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 172 C40 128 24 96 24 68 C24 42 44 26 68 26 C84 26 96 34 100 48
               C104 34 116 26 132 26 C156 26 176 42 176 68 C176 96 160 128 100 172 Z"
        fill="#ef4444" stroke="#b91c1c" stroke-width="5" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: "maison", name: "Maison", level: 1, hint: "On y habite.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M30 96 L100 38 L170 96 Z" fill="#ef4444" stroke="#991b1b" stroke-width="5" stroke-linejoin="round"/>
      <rect x="46" y="96" width="108" height="76" fill="#fcd34d" stroke="#b45309" stroke-width="5"/>
      <rect x="86" y="122" width="28" height="50" fill="#92400e"/>
      <rect x="60" y="112" width="22" height="22" fill="#60a5fa" stroke="#1e3a8a" stroke-width="3"/>
      <rect x="118" y="112" width="22" height="22" fill="#60a5fa" stroke="#1e3a8a" stroke-width="3"/>
    </svg>`
  },
  {
    id: "arbre", name: "Arbre", level: 1, hint: "Il a un tronc et des feuilles.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="90" y="120" width="20" height="60" fill="#92400e"/>
      <circle cx="100" cy="82" r="52" fill="#22c55e" stroke="#15803d" stroke-width="5"/>
      <circle cx="66" cy="104" r="34" fill="#16a34a" stroke="#15803d" stroke-width="4"/>
      <circle cx="134" cy="104" r="34" fill="#16a34a" stroke="#15803d" stroke-width="4"/>
    </svg>`
  },
  {
    id: "pomme", name: "Pomme", level: 1, hint: "Un fruit rouge ou vert.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 60 C120 40 152 44 160 74 C170 112 138 172 112 172 C106 172 102 168 100 168
               C98 168 94 172 88 172 C62 172 30 112 40 74 C48 44 80 40 100 60 Z"
        fill="#ef4444" stroke="#991b1b" stroke-width="5"/>
      <path d="M100 60 C100 40 108 30 122 26" fill="none" stroke="#92400e" stroke-width="6" stroke-linecap="round"/>
      <path d="M108 44 C124 34 140 40 144 52 C128 58 114 54 108 44 Z" fill="#22c55e"/>
    </svg>`
  },
  {
    id: "poisson", name: "Poisson", level: 1, hint: "Il nage dans l'eau.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M40 100 C60 60 120 60 150 100 C120 140 60 140 40 100 Z" fill="#38bdf8" stroke="#0369a1" stroke-width="5"/>
      <path d="M150 100 L182 74 L176 100 L182 126 Z" fill="#0ea5e9" stroke="#0369a1" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="72" cy="94" r="7" fill="#0c4a6e"/>
      <path d="M96 100 q14 -14 28 0 q-14 14 -28 0" fill="#7dd3fc"/>
    </svg>`
  },
  {
    id: "cle", name: "Clé", alias: ["cle"], level: 1, hint: "Elle ouvre une serrure.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="66" cy="100" r="34" fill="none" stroke="#eab308" stroke-width="12"/>
      <circle cx="66" cy="100" r="12" fill="var(--card)"/>
      <rect x="96" y="92" width="86" height="16" fill="#eab308"/>
      <rect x="150" y="108" width="14" height="22" fill="#eab308"/>
      <rect x="172" y="108" width="14" height="30" fill="#eab308"/>
    </svg>`
  },
  {
    id: "ballon", name: "Ballon", level: 1, hint: "On tape dedans pour jouer.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="66" fill="#f8fafc" stroke="#0f172a" stroke-width="5"/>
      <path d="M100 60 L124 78 L114 108 L86 108 L76 78 Z" fill="#0f172a"/>
      <path d="M100 60 L100 34 M124 78 L152 70 M114 108 L132 132 M86 108 L68 132 M76 78 L48 70"
            stroke="#0f172a" stroke-width="5"/>
    </svg>`
  },
  {
    id: "lune", name: "Lune", level: 1, hint: "Elle éclaire la nuit.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M132 26 A76 76 0 1 0 132 174 A58 58 0 1 1 132 26 Z" fill="#fde68a" stroke="#d97706" stroke-width="5"/>
      <circle cx="150" cy="70" r="6" fill="#fbbf24"/><circle cx="168" cy="110" r="4" fill="#fbbf24"/>
    </svg>`
  },
  {
    id: "fleur", name: "Fleur", level: 1, hint: "Elle sent bon dans le jardin.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="96" y="104" width="8" height="72" fill="#16a34a"/>
      <path d="M96 140 q-30 -6 -34 -30 q30 4 34 30" fill="#22c55e"/>
      <g fill="#ec4899" stroke="#be185d" stroke-width="3">
        <circle cx="100" cy="66" r="20"/><circle cx="66" cy="90" r="20"/><circle cx="134" cy="90" r="20"/>
        <circle cx="79" cy="128" r="20"/><circle cx="121" cy="128" r="20"/>
      </g>
      <circle cx="100" cy="98" r="18" fill="#fde047" stroke="#d97706" stroke-width="3"/>
    </svg>`
  },
  {
    id: "nuage", name: "Nuage", level: 1, hint: "Blanc et cotonneux dans le ciel.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <g fill="#e2e8f0" stroke="#94a3b8" stroke-width="5">
        <circle cx="72" cy="112" r="30"/><circle cx="108" cy="96" r="38"/><circle cx="140" cy="116" r="26"/>
        <rect x="66" y="118" width="82" height="28" rx="14" stroke="none"/>
      </g>
    </svg>`
  },
  {
    id: "chat", name: "Chat", level: 1, hint: "Il miaule et ronronne.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M56 62 L48 30 L84 54 Z M144 62 L152 30 L116 54 Z" fill="#f59e0b" stroke="#b45309" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="100" cy="106" r="52" fill="#fbbf24" stroke="#b45309" stroke-width="5"/>
      <circle cx="82" cy="100" r="7" fill="#0f172a"/><circle cx="118" cy="100" r="7" fill="#0f172a"/>
      <path d="M100 112 l-9 9 h18 Z" fill="#ec4899"/>
      <path d="M100 121 v8 M100 129 q-10 6 -18 2 M100 129 q10 6 18 2" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <path d="M62 108 h-28 M62 118 h-26 M138 108 h28 M138 118 h26" stroke="#78350f" stroke-width="2"/>
    </svg>`
  },
  {
    id: "chien", name: "Chien", level: 1, hint: "Le meilleur ami de l'homme.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="58" cy="88" rx="20" ry="36" fill="#92400e"/>
      <ellipse cx="142" cy="88" rx="20" ry="36" fill="#92400e"/>
      <circle cx="100" cy="106" r="50" fill="#d97706" stroke="#92400e" stroke-width="5"/>
      <circle cx="82" cy="100" r="7" fill="#0f172a"/><circle cx="118" cy="100" r="7" fill="#0f172a"/>
      <ellipse cx="100" cy="122" rx="13" ry="10" fill="#0f172a"/>
      <path d="M100 132 v8 q-10 8 -18 2" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "gateau", name: "Gâteau", alias: ["gateau"], level: 1, hint: "On souffle les bougies dessus.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="46" y="98" width="108" height="62" rx="8" fill="#f9a8d4" stroke="#be185d" stroke-width="5"/>
      <path d="M46 116 q13 12 27 0 t27 0 t27 0 t27 0" fill="none" stroke="#fff" stroke-width="7"/>
      <rect x="96" y="60" width="8" height="30" fill="#60a5fa"/>
      <path d="M100 46 q-8 9 0 15 q8 -6 0 -15" fill="#f59e0b"/>
      <rect x="46" y="150" width="108" height="10" fill="#be185d"/>
    </svg>`
  },
  {
    id: "cadeau", name: "Cadeau", alias: ["present"], level: 1, hint: "On l'offre pour un anniversaire.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="48" y="90" width="104" height="76" fill="#ef4444" stroke="#991b1b" stroke-width="5"/>
      <rect x="38" y="70" width="124" height="26" fill="#f87171" stroke="#991b1b" stroke-width="5"/>
      <rect x="92" y="70" width="16" height="96" fill="#fbbf24"/>
      <path d="M100 70 C80 48 58 58 68 70 M100 70 C120 48 142 58 132 70" fill="none" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/>
    </svg>`
  },

  /* ====================== NIVEAU 2 — MOYEN ====================== */
  {
    id: "parapluie", name: "Parapluie", level: 2, hint: "Utile quand il pleut.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M40 96 A60 60 0 0 1 160 96 Z" fill="#8b5cf6" stroke="#5b21b6" stroke-width="5" stroke-linejoin="round"/>
      <path d="M60 96 q10 -14 20 0 M100 96 q10 -14 20 0" fill="#a78bfa"/>
      <line x1="100" y1="96" x2="100" y2="160" stroke="#334155" stroke-width="6"/>
      <path d="M100 160 q0 16 -16 16" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "horloge", name: "Horloge", level: 2, hint: "Elle donne l'heure.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="66" fill="#f1f5f9" stroke="#334155" stroke-width="6"/>
      <line x1="100" y1="100" x2="100" y2="58" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
      <line x1="100" y1="100" x2="134" y2="118" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="6" fill="#ef4444"/>
      <g stroke="#334155" stroke-width="4"><line x1="100" y1="42" x2="100" y2="50"/><line x1="158" y1="100" x2="150" y2="100"/><line x1="100" y1="158" x2="100" y2="150"/><line x1="42" y1="100" x2="50" y2="100"/></g>
    </svg>`
  },
  {
    id: "bateau", name: "Bateau", level: 2, hint: "Il flotte sur la mer.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M44 130 L156 130 L138 166 L62 166 Z" fill="#ef4444" stroke="#991b1b" stroke-width="5" stroke-linejoin="round"/>
      <line x1="100" y1="40" x2="100" y2="130" stroke="#78350f" stroke-width="6"/>
      <path d="M100 46 L142 116 L100 116 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="4"/>
      <path d="M94 52 L58 116 L94 116 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="4"/>
      <path d="M30 172 q20 -10 40 0 t40 0 t40 0" fill="none" stroke="#38bdf8" stroke-width="5"/>
    </svg>`
  },
  {
    id: "cloche", name: "Cloche", level: 2, hint: "Elle sonne pour prévenir.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 40 a10 10 0 0 1 10 10 c30 8 30 60 34 84 l6 14 H50 l6 -14 c4 -24 4 -76 34 -84 a10 10 0 0 1 10 -10 Z"
        fill="#facc15" stroke="#a16207" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="100" cy="160" r="10" fill="#a16207"/>
    </svg>`
  },
  {
    id: "tasse", name: "Tasse", level: 2, hint: "Pour boire un café chaud.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M50 80 H130 V128 a20 24 0 0 1 -80 0 Z" fill="#f8fafc" stroke="#334155" stroke-width="5"/>
      <path d="M130 90 a22 22 0 0 1 0 44" fill="none" stroke="#334155" stroke-width="7"/>
      <path d="M70 66 q6 -12 0 -24 M92 66 q6 -12 0 -24 M114 66 q6 -12 0 -24" fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "livre", name: "Livre", level: 2, hint: "On le lit page après page.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 52 C80 40 52 40 40 46 V150 C52 144 80 144 100 156 Z" fill="#60a5fa" stroke="#1e40af" stroke-width="5" stroke-linejoin="round"/>
      <path d="M100 52 C120 40 148 40 160 46 V150 C148 144 120 144 100 156 Z" fill="#93c5fd" stroke="#1e40af" stroke-width="5" stroke-linejoin="round"/>
      <line x1="100" y1="52" x2="100" y2="156" stroke="#1e40af" stroke-width="4"/>
    </svg>`
  },
  {
    id: "voiture", name: "Voiture", level: 2, hint: "Elle roule sur la route.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M28 128 L44 96 L70 78 L138 78 L160 100 L176 108 L176 128 Z" fill="#ef4444" stroke="#991b1b" stroke-width="5" stroke-linejoin="round"/>
      <path d="M74 84 L128 84 L142 100 L64 100 Z" fill="#bfdbfe" stroke="#1e40af" stroke-width="3"/>
      <circle cx="66" cy="132" r="18" fill="#1f2937" stroke="#0f172a" stroke-width="4"/>
      <circle cx="66" cy="132" r="7" fill="#9ca3af"/>
      <circle cx="140" cy="132" r="18" fill="#1f2937" stroke="#0f172a" stroke-width="4"/>
      <circle cx="140" cy="132" r="7" fill="#9ca3af"/>
    </svg>`
  },
  {
    id: "papillon", name: "Papillon", level: 2, hint: "Insecte aux ailes colorées.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <line x1="100" y1="58" x2="100" y2="150" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 70 C60 30 30 60 44 96 C30 120 60 140 100 108 Z" fill="#f472b6" stroke="#be185d" stroke-width="4"/>
      <path d="M100 70 C140 30 170 60 156 96 C170 120 140 140 100 108 Z" fill="#c084fc" stroke="#7e22ce" stroke-width="4"/>
      <path d="M100 56 q-10 -18 -22 -20 M100 56 q10 -18 22 -20" fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "cerf-volant", name: "Cerf-volant", level: 2, hint: "Il vole au bout d'une ficelle.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 30 L150 90 L100 150 L50 90 Z" fill="#f97316" stroke="#9a3412" stroke-width="5" stroke-linejoin="round"/>
      <path d="M100 30 L100 150 M50 90 L150 90" stroke="#9a3412" stroke-width="3"/>
      <path d="M100 150 q10 14 -4 22 t4 22 t-4 22" fill="none" stroke="#64748b" stroke-width="3"/>
    </svg>`
  },
  {
    id: "ancre", name: "Ancre", level: 2, hint: "Elle immobilise le bateau.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="44" r="14" fill="none" stroke="#475569" stroke-width="7"/>
      <line x1="100" y1="58" x2="100" y2="160" stroke="#475569" stroke-width="8" stroke-linecap="round"/>
      <line x1="70" y1="82" x2="130" y2="82" stroke="#475569" stroke-width="8" stroke-linecap="round"/>
      <path d="M100 160 C60 160 46 130 44 112 L64 122 M100 160 C140 160 154 130 156 112 L136 122" fill="none" stroke="#475569" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: "fusee", name: "Fusée", alias: ["fusee"], level: 2, hint: "Elle décolle vers l'espace.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 24 C124 44 132 84 132 118 H68 C68 84 76 44 100 24 Z" fill="#e2e8f0" stroke="#334155" stroke-width="5"/>
      <circle cx="100" cy="76" r="14" fill="#38bdf8" stroke="#0369a1" stroke-width="4"/>
      <path d="M68 108 L44 140 L68 130 Z M132 108 L156 140 L132 130 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <path d="M84 118 H116 L108 150 L100 138 L92 150 Z" fill="#f97316"/>
    </svg>`
  },
  {
    id: "avion", name: "Avion", level: 2, hint: "Il vole avec des passagers.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M28 106 L150 90 L178 82 q10 6 0 12 L150 106 L118 148 L102 148 L116 106 L70 110 L56 130 L44 130 L52 104 Z"
        fill="#e2e8f0" stroke="#334155" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="90" cy="99" r="4" fill="#38bdf8"/><circle cx="106" cy="97" r="4" fill="#38bdf8"/>
    </svg>`
  },
  {
    id: "couronne", name: "Couronne", level: 2, hint: "Un roi ou une reine la porte.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M40 142 L52 72 L84 108 L100 56 L116 108 L148 72 L160 142 Z" fill="#fbbf24" stroke="#b45309" stroke-width="5" stroke-linejoin="round"/>
      <rect x="40" y="142" width="120" height="20" fill="#f59e0b" stroke="#b45309" stroke-width="5"/>
      <circle cx="100" cy="54" r="7" fill="#ef4444"/><circle cx="52" cy="72" r="6" fill="#22c55e"/><circle cx="148" cy="72" r="6" fill="#3b82f6"/>
    </svg>`
  },
  {
    id: "lunettes", name: "Lunettes", level: 2, hint: "Elles aident à mieux voir.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="62" cy="104" r="30" fill="#bfdbfe" fill-opacity=".5" stroke="#334155" stroke-width="7"/>
      <circle cx="138" cy="104" r="30" fill="#bfdbfe" fill-opacity=".5" stroke="#334155" stroke-width="7"/>
      <path d="M92 100 q8 -8 16 0" fill="none" stroke="#334155" stroke-width="7"/>
      <path d="M32 96 L14 82 M168 96 L186 82" stroke="#334155" stroke-width="7" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "crayon", name: "Crayon", level: 2, hint: "Pour écrire ou dessiner.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <g transform="rotate(45 100 100)">
        <rect x="78" y="34" width="44" height="94" fill="#fbbf24" stroke="#b45309" stroke-width="4"/>
        <path d="M78 128 L100 168 L122 128 Z" fill="#fcd34d" stroke="#b45309" stroke-width="4"/>
        <path d="M89 150 L100 168 L111 150 Z" fill="#0f172a"/>
        <rect x="78" y="30" width="44" height="14" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      </g>
    </svg>`
  },
  {
    id: "arc-en-ciel", name: "Arc-en-ciel", level: 2, hint: "Il apparaît après la pluie.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke-width="11">
        <path d="M28 150 a72 72 0 0 1 144 0" stroke="#ef4444"/>
        <path d="M44 150 a56 56 0 0 1 112 0" stroke="#f59e0b"/>
        <path d="M60 150 a40 40 0 0 1 80 0" stroke="#22c55e"/>
        <path d="M76 150 a24 24 0 0 1 48 0" stroke="#3b82f6"/>
      </g>
      <g fill="#e2e8f0" stroke="#94a3b8" stroke-width="3">
        <circle cx="34" cy="158" r="12"/><circle cx="166" cy="158" r="12"/>
      </g>
    </svg>`
  },

  /* ====================== NIVEAU 3 — DIFFICILE ====================== */
  {
    id: "montgolfiere", name: "Montgolfière", alias: ["montgolfiere"], level: 3, hint: "Un ballon géant qui emporte une nacelle.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 24 C56 24 44 70 44 92 C44 118 72 138 100 138 C128 138 156 118 156 92 C156 70 144 24 100 24 Z"
        fill="#f43f5e" stroke="#9f1239" stroke-width="5"/>
      <path d="M100 24 C82 40 82 118 100 138 M100 24 C118 40 118 118 100 138" fill="none" stroke="#fecdd3" stroke-width="4"/>
      <line x1="84" y1="134" x2="90" y2="160" stroke="#78350f" stroke-width="3"/>
      <line x1="116" y1="134" x2="110" y2="160" stroke="#78350f" stroke-width="3"/>
      <rect x="86" y="160" width="28" height="20" rx="3" fill="#a16207" stroke="#78350f" stroke-width="3"/>
    </svg>`
  },
  {
    id: "diamant", name: "Diamant", level: 3, hint: "Une pierre précieuse qui scintille.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M60 60 H140 L172 92 L100 168 L28 92 Z" fill="#67e8f9" stroke="#0e7490" stroke-width="5" stroke-linejoin="round"/>
      <path d="M28 92 H172 M60 60 L84 92 L100 168 M140 60 L116 92 L100 168 M84 92 H116" fill="none" stroke="#0e7490" stroke-width="3"/>
    </svg>`
  },
  {
    id: "boussole", name: "Boussole", level: 3, hint: "Elle indique le Nord.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="64" fill="#f1f5f9" stroke="#334155" stroke-width="6"/>
      <circle cx="100" cy="100" r="52" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M100 56 L114 100 L100 92 Z" fill="#ef4444"/>
      <path d="M100 144 L86 100 L100 108 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <circle cx="100" cy="100" r="6" fill="#334155"/>
    </svg>`
  },
  {
    id: "chateau", name: "Château", alias: ["chateau"], level: 3, hint: "Un roi peut y habiter.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="46" y="88" width="108" height="84" fill="#cbd5e1" stroke="#475569" stroke-width="5"/>
      <path d="M46 88 v-16 h12 v10 h12 v-10 h12 v10 h12 v-10 h12 v10 h12 v-10 h12 v10 h12 v-10 h12 v16 Z" fill="#94a3b8" stroke="#475569" stroke-width="4"/>
      <rect x="40" y="60" width="24" height="112" fill="#94a3b8" stroke="#475569" stroke-width="5"/>
      <rect x="136" y="60" width="24" height="112" fill="#94a3b8" stroke="#475569" stroke-width="5"/>
      <path d="M40 60 L52 44 L64 60 Z M136 60 L148 44 L160 60 Z" fill="#ef4444" stroke="#991b1b" stroke-width="3"/>
      <path d="M84 172 v-40 a16 16 0 0 1 32 0 v40 Z" fill="#78350f" stroke="#451a03" stroke-width="4"/>
    </svg>`
  },
  {
    id: "guitare", name: "Guitare", level: 3, hint: "Un instrument à six cordes.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="94" y="24" width="12" height="86" rx="3" fill="#78350f"/>
      <path d="M100 104 C64 104 56 138 72 160 C86 180 114 180 128 160 C144 138 136 104 100 104 Z" fill="#d97706" stroke="#78350f" stroke-width="5"/>
      <circle cx="100" cy="140" r="14" fill="#451a03"/>
      <rect x="90" y="18" width="20" height="12" rx="3" fill="#451a03"/>
    </svg>`
  },
  {
    id: "telescope", name: "Télescope", alias: ["telescope"], level: 3, hint: "Pour observer les étoiles.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="52" y="70" width="90" height="26" rx="8" transform="rotate(-24 97 83)" fill="#64748b" stroke="#334155" stroke-width="4"/>
      <rect x="120" y="52" width="30" height="30" rx="6" transform="rotate(-24 135 67)" fill="#94a3b8" stroke="#334155" stroke-width="4"/>
      <line x1="96" y1="112" x2="72" y2="168" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
      <line x1="96" y1="112" x2="128" y2="168" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
      <line x1="60" y1="168" x2="140" y2="168" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "chouette", name: "Chouette", alias: ["hibou"], level: 3, hint: "Oiseau de nuit aux grands yeux.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="100" cy="112" rx="52" ry="60" fill="#a16207" stroke="#78350f" stroke-width="5"/>
      <path d="M52 74 L64 40 L84 66 Z M148 74 L136 40 L116 66 Z" fill="#a16207" stroke="#78350f" stroke-width="4"/>
      <circle cx="80" cy="96" r="20" fill="#fef3c7" stroke="#78350f" stroke-width="4"/>
      <circle cx="120" cy="96" r="20" fill="#fef3c7" stroke="#78350f" stroke-width="4"/>
      <circle cx="80" cy="96" r="8" fill="#0f172a"/><circle cx="120" cy="96" r="8" fill="#0f172a"/>
      <path d="M100 108 L110 122 L90 122 Z" fill="#f97316"/>
      <path d="M76 150 q24 20 48 0" fill="none" stroke="#78350f" stroke-width="3"/>
    </svg>`
  },
  {
    id: "cactus", name: "Cactus", level: 3, hint: "Plante piquante du désert.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="88" y="60" width="24" height="112" rx="12" fill="#16a34a" stroke="#166534" stroke-width="4"/>
      <path d="M88 100 h-18 a14 14 0 0 0 -14 14 v16 a10 10 0 0 0 20 0 v-6" fill="#22c55e" stroke="#166534" stroke-width="4"/>
      <path d="M112 88 h18 a14 14 0 0 1 14 14 v22 a10 10 0 0 1 -20 0 v-6" fill="#22c55e" stroke="#166534" stroke-width="4"/>
      <rect x="72" y="168" width="56" height="16" rx="4" fill="#b45309"/>
      <circle cx="100" cy="72" r="4" fill="#fde047"/><circle cx="100" cy="90" r="4" fill="#fde047"/>
    </svg>`
  },
  {
    id: "champignon", name: "Champignon", level: 3, hint: "Il pousse dans la forêt.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M44 108 C44 66 84 42 100 42 C116 42 156 66 156 108 Z" fill="#ef4444" stroke="#991b1b" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="78" cy="78" r="8" fill="#fee2e2"/><circle cx="118" cy="72" r="10" fill="#fee2e2"/><circle cx="108" cy="98" r="7" fill="#fee2e2"/>
      <path d="M84 108 h32 v44 a16 16 0 0 1 -32 0 Z" fill="#fde68a" stroke="#b45309" stroke-width="4"/>
    </svg>`
  },
  {
    id: "eclair", name: "Éclair", alias: ["eclair", "foudre"], level: 3, hint: "Il illumine le ciel pendant l'orage.", category: "nature",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M112 24 L60 108 L96 108 L84 176 L148 84 L108 84 Z" fill="#facc15" stroke="#a16207" stroke-width="5" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: "pieuvre", name: "Pieuvre", alias: ["poulpe"], level: 3, hint: "Animal marin à huit tentacules.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 40 C60 40 52 84 52 108 C52 120 62 122 62 132 C50 140 44 128 40 140
               C58 150 60 130 70 138 C64 152 78 156 78 142 C86 154 96 148 92 138
               C102 150 110 142 104 132 C116 148 122 138 116 132 C128 150 136 140 128 130
               C142 142 148 130 138 124 C148 118 148 84 148 108 C148 84 140 40 100 40 Z"
        fill="#c084fc" stroke="#7e22ce" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="84" cy="86" r="8" fill="#0f172a"/><circle cx="116" cy="86" r="8" fill="#0f172a"/>
    </svg>`
  },
  {
    id: "phare", name: "Phare", level: 3, hint: "Il guide les bateaux la nuit.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M84 70 L116 70 L128 172 L72 172 Z" fill="#f8fafc" stroke="#334155" stroke-width="5" stroke-linejoin="round"/>
      <path d="M84 70 L116 70 M80 100 L120 100 M76 132 L124 132" stroke="#ef4444" stroke-width="8"/>
      <rect x="82" y="44" width="36" height="26" fill="#fbbf24" stroke="#334155" stroke-width="4"/>
      <path d="M82 54 L44 40 M118 54 L156 40" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
      <path d="M72 172 q28 12 56 0" fill="none" stroke="#38bdf8" stroke-width="5"/>
    </svg>`
  },
  {
    id: "robot", name: "Robot", level: 3, hint: "Une machine qui peut bouger seule.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <line x1="100" y1="58" x2="100" y2="40" stroke="#475569" stroke-width="4"/><circle cx="100" cy="36" r="7" fill="#ef4444"/>
      <rect x="58" y="58" width="84" height="70" rx="12" fill="#94a3b8" stroke="#475569" stroke-width="5"/>
      <circle cx="82" cy="88" r="11" fill="#38bdf8" stroke="#0369a1" stroke-width="3"/>
      <circle cx="118" cy="88" r="11" fill="#38bdf8" stroke="#0369a1" stroke-width="3"/>
      <rect x="78" y="108" width="44" height="8" rx="4" fill="#475569"/>
      <rect x="70" y="128" width="60" height="40" rx="6" fill="#cbd5e1" stroke="#475569" stroke-width="5"/>
      <rect x="44" y="130" width="12" height="32" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
      <rect x="144" y="130" width="12" height="32" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
    </svg>`
  },
  {
    id: "fantome", name: "Fantôme", alias: ["fantome"], level: 3, hint: "Il fait « Bouh ! » la nuit.", category: "objet",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M56 162 V98 a44 44 0 0 1 88 0 V162 l-14 -12 l-14 12 l-16 -12 l-16 12 l-14 -12 Z"
        fill="#f8fafc" stroke="#94a3b8" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="84" cy="96" r="8" fill="#0f172a"/><circle cx="116" cy="96" r="8" fill="#0f172a"/>
      <ellipse cx="100" cy="118" rx="8" ry="10" fill="#94a3b8"/>
    </svg>`
  },
  {
    id: "escargot", name: "Escargot", level: 3, hint: "Il porte sa maison sur le dos.", category: "animal",
    svg: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <path d="M46 150 h74" fill="none" stroke="#a16207" stroke-width="14" stroke-linecap="round"/>
      <path d="M46 150 q-16 0 -16 -22 v-6" fill="none" stroke="#a16207" stroke-width="14" stroke-linecap="round"/>
      <circle cx="30" cy="118" r="4" fill="#0f172a"/>
      <circle cx="120" cy="112" r="44" fill="#f59e0b" stroke="#92400e" stroke-width="5"/>
      <path d="M120 112 a22 22 0 1 0 22 22" fill="none" stroke="#92400e" stroke-width="6"/>
    </svg>`
  }
];

/* Paliers du mode Parcours (filtrent par niveau de difficulté) */
const SAMSON_TIERS = [
  { id: "facile",    label: "Facile",    revealRatio: 0.55, time: 60, hints: 3, levels: [1], icon: "🌱", color: "#22c55e" },
  { id: "moyen",     label: "Moyen",     revealRatio: 0.35, time: 45, hints: 2, levels: [2], icon: "⚡", color: "#f59e0b" },
  { id: "difficile", label: "Difficile", revealRatio: 0.15, time: 35, hints: 1, levels: [3], icon: "🔥", color: "#ef4444" },
  { id: "expert",    label: "Expert",    revealRatio: 0.0,  time: 30, hints: 0, levels: [1, 2, 3], icon: "👑", color: "#8b5cf6" }
];

/* Modes de jeu */
const SAMSON_MODES = [
  { id: "parcours", label: "Parcours",        icon: "🗺️", desc: "Progresse à travers 4 paliers de difficulté.", color: "#6366f1" },
  { id: "daily",    label: "Défi du jour",    icon: "📅", desc: "8 énigmes uniques, les mêmes pour tous aujourd'hui.", color: "#ec4899" },
  { id: "survie",   label: "Survie",          icon: "♾️", desc: "Enchaîne sans fin, 3 vies, difficulté croissante.", color: "#ef4444" },
  { id: "chrono",   label: "Contre-la-montre", icon: "⏱️", desc: "90 secondes : trouve-en un maximum !", color: "#f59e0b" },
  { id: "duo",      label: "Duo",             icon: "👥", desc: "2 joueurs à tour de rôle, le meilleur gagne.", color: "#14b8a6" }
];

/* Succès / trophées débloquables */
const SAMSON_ACHIEVEMENTS = [
  { id: "first_win",   icon: "🎉", name: "Premiers pas",      desc: "Terminer une première partie." },
  { id: "combo5",      icon: "🔥", name: "En feu",            desc: "Atteindre un combo x5." },
  { id: "combo10",     icon: "🌟", name: "Imparable",         desc: "Atteindre un combo x10." },
  { id: "score1000",   icon: "💰", name: "Millier",           desc: "Marquer 1000 points en une partie." },
  { id: "score5000",   icon: "💎", name: "Score de maître",   desc: "Marquer 5000 points en une partie." },
  { id: "perfect",     icon: "🏆", name: "Sans faute",        desc: "Obtenir 3 étoiles sur un parcours." },
  { id: "nohint",      icon: "🧠", name: "Cerveau",           desc: "Gagner une partie sans aucun indice." },
  { id: "expert",      icon: "👑", name: "Expert confirmé",   desc: "Terminer le parcours Expert." },
  { id: "daily",       icon: "📅", name: "Fidèle",            desc: "Réussir un Défi du jour." },
  { id: "streak3",     icon: "📆", name: "Assidu",            desc: "3 jours de suite (série quotidienne)." },
  { id: "survivor",    icon: "🛡️", name: "Survivant",         desc: "15 bonnes réponses en mode Survie." },
  { id: "played10",    icon: "🎮", name: "Joueur régulier",   desc: "Jouer 10 parties." }
];

if (typeof module !== "undefined") {
  module.exports = { SAMSON_PUZZLES, SAMSON_TIERS, SAMSON_MODES, SAMSON_ACHIEVEMENTS };
}
