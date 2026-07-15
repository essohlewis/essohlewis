/* ==========================================================================
   components/coachCard.js — Carte coach utilisée dans la recherche, la home,
   les favoris. Clique → profil. Bouton favori.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el } = CL.dom;
  const { format, coachService, ui } = CL;

  function carte(coach) {
    const nom = coachService.nomComplet(coach);
    const estFav = coachService.estFavori(coach.id);
    const badges = coachService.badges(coach);
    const badgePrincipal = badges[0];

    const btnFav = el("button", {
      class: "btn-icone", "aria-label": "Ajouter aux favoris",
      style: "background:var(--surface);border:1px solid var(--bordure)",
      html: CL.icon("coeur", 18, { fill: estFav }),
    });
    btnFav.style.color = estFav ? "var(--rouge-alerte)" : "var(--texte-doux)";
    btnFav.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!CL.auth.estConnecte()) { CL.toast.info("Connexion requise", "Connectez-vous pour enregistrer des favoris."); location.hash = "#/connexion"; return; }
      const actif = coachService.basculerFavori(coach.id);
      btnFav.innerHTML = CL.icon("coeur", 18, { fill: actif });
      btnFav.style.color = actif ? "var(--rouge-alerte)" : "var(--texte-doux)";
      CL.toast.succes(actif ? "Ajouté aux favoris" : "Retiré des favoris", nom);
      window.dispatchEvent(new CustomEvent("cl:favoris"));
    });

    const c = el("article", { class: "carte carte-interactive coach-carte", tabindex: "0", role: "link", "aria-label": "Voir le profil de " + nom }, [
      el("div", { class: "coach-carte__banniere", style: `background:linear-gradient(120deg, ${coach.couleur}, #3b6fe6)` }, [
        ui.avatarCoach(coach, "coach-carte__avatar"),
      ]),
      el("div", { class: "coach-carte__corps" }, [
        el("div", { class: "rangee entre" }, [
          el("div", {}, [
            el("h4", { class: "coach-carte__nom" }, [
              document.createTextNode(nom),
              badges.some((b) => b.cle === "verifie")
                ? el("span", { class: "puce-verifie", title: "Coach vérifié", html: CL.icon("verifie", 18, { fill: true }) })
                : null,
            ]),
            el("div", { class: "coach-carte__specialite", text: coach.titre }),
          ]),
          btnFav,
        ]),
        el("div", { class: "coach-carte__meta" }, [
          el("span", { class: "rangee gap-2" }, [ui.etoiles(coach.note), el("span", { class: "note-valeur", text: format.note(coach.note) }), el("span", { class: "texte-faible texte-xs", text: `(${coach.nbAvis})` })]),
          el("span", { class: "rangee gap-2", html: CL.icon("localisation", 15) + " " + coach.commune }),
        ]),
        el("div", { class: "rangee rangee-wrap gap-2 mt-3" },
          (coach.specialites || []).slice(0, 2).map((s) => el("span", { class: "chip chip-statique texte-xs", text: ui.emojiSpecialite(s) + " " + ui.labelSpecialite(s) }))
        ),
        el("div", { class: "coach-carte__pied" }, [
          el("div", {}, [
            el("span", { class: "texte-xs texte-faible", text: "À partir de" }),
            el("div", { class: "coach-carte__prix", text: format.fcfa(coachService.prixMin(coach)) }),
          ]),
          badgePrincipal
            ? el("span", { class: "badge " + badgePrincipal.classe }, [document.createTextNode(badgePrincipal.label)])
            : el("span", { class: "badge badge-neutre", text: coach.nbSeances + " séances" }),
        ]),
      ]),
    ]);

    const aller = () => { location.hash = "#/coach/" + coach.id; };
    c.addEventListener("click", aller);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") aller(); });
    return c;
  }

  CL.coachCard = carte;
})();
