/* ==========================================================================
   components/ui.js — Petits composants réutilisables :
   avatar (généré depuis initiales), étoiles, badges, boutons de partage,
   sélecteur d'étoiles, squelettes de chargement, spécialité → libellé.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el, esc } = CL.dom;
  const { format } = CL;

  const ui = {
    /**
     * Génère un avatar SVG (data URI) à partir des initiales et d'une couleur.
     * Évite toute image externe → fonctionne hors-ligne.
     */
    avatarURI(nom, couleur, taille) {
      const t = taille || 120;
      const ini = format.initiales(nom);
      const c = couleur || "#1b4dcc";
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.15"/></linearGradient></defs>` +
        `<rect width="${t}" height="${t}" fill="${c}"/><rect width="${t}" height="${t}" fill="url(#g)"/>` +
        `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ` +
        `font-family="Segoe UI, sans-serif" font-size="${t * 0.4}" fill="#ffffff" font-weight="700">${esc(ini)}</text></svg>`;
      return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    },

    /** Élément <img> avatar pour un coach (photo réelle si disponible). */
    avatarCoach(coach, classe) {
      return el("img", {
        class: "avatar " + (classe || "avatar-md"),
        src: coach.photo || ui.avatarURI(CL.coachService.nomComplet(coach), coach.couleur),
        alt: "Photo de " + CL.coachService.nomComplet(coach),
        loading: "lazy",
      });
    },

    avatarNom(nom, classe, couleur) {
      return el("img", {
        class: "avatar " + (classe || "avatar-sm"),
        src: ui.avatarURI(nom, couleur || "#475569"),
        alt: "Avatar de " + nom,
      });
    },

    /** Rendu d'étoiles (note affichée). */
    etoiles(note, opts) {
      opts = opts || {};
      const cont = el("span", { class: "etoiles" + (opts.grand ? " etoiles--lg" : "") });
      const n = Math.round(Number(note) || 0);
      for (let i = 1; i <= 5; i++) {
        cont.innerHTML += CL.icon("etoile", opts.grand ? 22 : 16, { fill: i <= n });
      }
      if (opts.valeur) {
        cont.appendChild(el("span", { class: "note-valeur", text: format.note(note) }));
      }
      return cont;
    },

    /**
     * Sélecteur d'étoiles interactif.
     * @returns {object} { element, valeur() }
     */
    etoilesSaisie(initiale) {
      let valeur = initiale || 0;
      const cont = el("div", { class: "etoiles etoiles-saisie etoiles--lg" });
      const dessiner = () => {
        cont.innerHTML = "";
        for (let i = 1; i <= 5; i++) {
          const s = el("span", { html: CL.icon("etoile", 28, { fill: i <= valeur }) });
          s.addEventListener("click", () => { valeur = i; dessiner(); });
          cont.appendChild(s);
        }
      };
      dessiner();
      return { element: cont, valeur: () => valeur };
    },

    /** Rendu des badges d'un coach. */
    badges(coach, max) {
      const liste = CL.coachService.badges(coach);
      const cont = el("div", { class: "rangee rangee-wrap gap-2" });
      liste.slice(0, max || liste.length).forEach((b) => {
        cont.appendChild(el("span", { class: "badge " + b.classe }, [
          el("span", { html: CL.icon(b.icone, 13, { fill: b.cle === "verifie" || b.cle === "top" }) }),
          document.createTextNode(" " + b.label),
        ]));
      });
      return cont;
    },

    /** Libellé lisible d'une spécialité depuis son id. */
    labelSpecialite(id) {
      const s = CL.coachService.specialites().find((x) => x.id === id);
      return s ? s.nom : id;
    },
    emojiSpecialite(id) {
      const s = CL.coachService.specialites().find((x) => x.id === id);
      return s ? s.emoji : "•";
    },

    /** Chips de spécialités (statiques). */
    chipsSpecialites(ids) {
      const cont = el("div", { class: "rangee rangee-wrap gap-2" });
      (ids || []).forEach((id) => {
        cont.appendChild(el("span", { class: "chip chip-statique" }, [
          document.createTextNode(ui.emojiSpecialite(id) + " " + ui.labelSpecialite(id)),
        ]));
      });
      return cont;
    },

    /** Boutons de partage social pour une URL. */
    boutonsPartage(url, texte) {
      const liens = CL.socialService.liensPartage(url, texte);
      const cont = el("div", { class: "partage-boutons" });
      const reseaux = [
        { cle: "facebook", icone: "facebook", classe: "social-facebook", label: "Facebook" },
        { cle: "linkedin", icone: "linkedin", classe: "social-linkedin", label: "LinkedIn" },
        { cle: "whatsapp", icone: "whatsapp", classe: "social-whatsapp", label: "WhatsApp" },
        { cle: "x", icone: "x_twitter", classe: "social-x", label: "X" },
      ];
      reseaux.forEach((r) => {
        cont.appendChild(el("a", {
          class: "btn-icone " + r.classe, href: liens[r.cle], target: "_blank", rel: "noopener",
          title: "Partager sur " + r.label, "aria-label": "Partager sur " + r.label,
          html: CL.icon(r.icone, 20, { fill: r.cle !== "x" && r.cle !== "linkedin" }),
        }));
      });
      // Bouton "copier le lien" (utile pour Instagram/TikTok).
      const copier = el("button", {
        class: "btn-icone social-instagram", title: "Copier le lien", "aria-label": "Copier le lien",
        html: CL.icon("partager", 20),
      });
      copier.addEventListener("click", async () => {
        const ok = await CL.socialService.copier(url);
        ok ? CL.toast.succes("Lien copié", "Partagez-le où vous voulez.") : CL.toast.erreur("Échec", "Copie impossible.");
      });
      cont.appendChild(copier);
      return cont;
    },

    /** Grille de squelettes de chargement. */
    squelettesCoachs(n) {
      const cont = el("div", { class: "grille grille-coachs" });
      for (let i = 0; i < (n || 6); i++) {
        cont.appendChild(el("div", { class: "carte" }, [
          el("div", { class: "skeleton", style: "height:84px;border-radius:16px 16px 0 0" }),
          el("div", { class: "carte-corps" }, [
            el("div", { class: "skeleton skeleton-ligne", style: "width:60%;height:18px" }),
            el("div", { class: "skeleton skeleton-ligne", style: "width:40%" }),
            el("div", { class: "skeleton skeleton-ligne", style: "width:90%;margin-top:16px" }),
            el("div", { class: "skeleton skeleton-ligne", style: "width:80%" }),
          ]),
        ]));
      }
      return cont;
    },

    /** État vide générique. */
    vide(icone, titre, message) {
      return el("div", { class: "vide" }, [
        el("div", { html: CL.icon(icone || "inbox", 56) }),
        el("h3", { text: titre || "Rien à afficher" }),
        message ? el("p", { text: message }) : null,
      ]);
    },
  };

  CL.ui = ui;
})();
