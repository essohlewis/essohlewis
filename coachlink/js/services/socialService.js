/* ==========================================================================
   services/socialService.js — Partage réseaux sociaux, Open Graph dynamique,
   import LinkedIn simulé, génération de lien de profil partageable.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const socialService = {
    /** URL absolue d'un profil coach (partage). */
    lienProfil(coachId) {
      const base = location.origin + location.pathname;
      return `${base}#/coach/${coachId}`;
    },

    /**
     * Construit les liens de partage pour chaque réseau.
     * @returns {object} { facebook, linkedin, whatsapp, x, ... }
     */
    liensPartage(url, texte) {
      const u = encodeURIComponent(url);
      const t = encodeURIComponent(texte || "Découvrez ce coach sur CoachLink CI");
      return {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
        whatsapp: `https://wa.me/?text=${t}%20${u}`,
        x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
        // TikTok / Instagram ne proposent pas de partage web direct : on copie le lien.
        instagram: null,
        tiktok: null,
      };
    },

    /** Met à jour dynamiquement les balises Open Graph pour un partage riche. */
    majOpenGraph(meta) {
      const set = (propriete, contenu) => {
        let tag = document.querySelector(`meta[property="${propriete}"]`);
        if (!tag) {
          tag = document.createElement("meta");
          tag.setAttribute("property", propriete);
          document.head.appendChild(tag);
        }
        tag.setAttribute("content", contenu);
      };
      document.title = meta.titre + " · CoachLink CI";
      set("og:title", meta.titre);
      set("og:description", meta.description || "");
      set("og:type", meta.type || "profile");
      set("og:url", meta.url || location.href);
      set("og:site_name", "CoachLink CI");
    },

    /** Restaure les balises Open Graph par défaut. */
    resetOpenGraph() {
      socialService.majOpenGraph({
        titre: "CoachLink CI",
        description: "Trouvez un coach sportif de confiance en Côte d'Ivoire : musculation, fitness, préparation physique, nutrition sportive, yoga, natation, sport santé.",
        type: "website",
        url: location.origin + location.pathname,
      });
    },

    /**
     * Import LinkedIn simulé : renvoie des données de profil pré-remplies
     * (nom, titre, expérience) à l'inscription coach.
     */
    importerLinkedIn() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            prenom: "Aristide",
            nom: "Kouamé",
            titre: "Coach sportif & préparateur physique certifié",
            bio: "10 ans d'expérience en coaching sportif et préparation physique. Passionné par la remise en forme et la performance.",
            specialites: ["sport", "prepaphysique"],
            langues: ["Français", "Anglais"],
            reseaux: { linkedin: "aristide-kouame" },
          });
        }, 1200); // simule la latence d'un appel OAuth
      });
    },

    /** Copie un texte dans le presse-papier avec repli. */
    async copier(texte) {
      try {
        await navigator.clipboard.writeText(texte);
        return true;
      } catch (e) {
        // Repli pour file:// ou navigateurs sans API clipboard.
        const ta = document.createElement("textarea");
        ta.value = texte;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      }
    },
  };

  CL.socialService = socialService;
})();
