/* ==========================================================================
   services/coachService.js — Accès aux coachs, recherche/filtres, TrustScore,
   badges, favoris, avis, posts, diplômes, disponibilités.
   >>> Branchement API : GET /coachs, GET /coachs/:id, POST /avis… <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  function tous() { return storage.lire(storage.CLES.coachs, []); }
  function sauver(liste) { storage.ecrire(storage.CLES.coachs, liste); }

  const coachService = {
    /* -------------------------- Lecture ------------------------------- */
    lister() { return tous(); },
    specialites() { return storage.lire("specialites", CL.SEED ? CL.SEED.specialites : []); },
    communes() { return storage.lire("communes", CL.SEED ? CL.SEED.communes : []); },

    obtenir(id) { return tous().find((c) => c.id === id) || null; },

    nomComplet(c) { return c ? `${c.prenom} ${c.nom}` : ""; },

    /* ----------------------- TrustScore & badges ---------------------- */
    /**
     * Calcule un score de confiance sur 100 :
     *  - Diplômes vérifiés (max 30)
     *  - Note moyenne (max 30)
     *  - Nombre d'avis / ancienneté (max 20)
     *  - Taux de réponse (max 20)
     */
    trustScore(c) {
      const dv = (c.diplomes || []).filter((d) => d.statut === "verifie").length;
      const totalDiplomes = (c.diplomes || []).length || 1;
      const scoreDiplomes = Math.min(30, (dv / totalDiplomes) * 30);
      const scoreNote = ((c.note || 0) / 5) * 30;
      const scoreExp = Math.min(20, ((c.nbAvis || 0) / 40) * 12 + ((c.ancienneteMois || 0) / 48) * 8);
      const scoreRep = ((c.tauxReponse || 0) / 100) * 20;
      return Math.round(scoreDiplomes + scoreNote + scoreExp + scoreRep);
    },

    /** Retourne la liste des badges mérités par le coach. */
    badges(c) {
      const badges = [];
      const diplomesVerifies = (c.diplomes || []).some((d) => d.statut === "verifie");
      if (diplomesVerifies) badges.push({ cle: "verifie", label: "Coach vérifié", classe: "badge-verifie", icone: "verifie" });
      if ((c.note || 0) >= 4.8 && (c.nbAvis || 0) >= 20) badges.push({ cle: "top", label: "Top noté", classe: "badge-top", icone: "etoile" });
      if ((c.tauxReponse || 0) >= 95) badges.push({ cle: "reactif", label: "Réactif", classe: "badge-reactif", icone: "eclair" });
      if ((c.ancienneteMois || 0) <= 6) badges.push({ cle: "nouveau", label: "Nouveau", classe: "badge-nouveau", icone: "plus" });
      return badges;
    },

    /* --------------------------- Recherche ---------------------------- */
    /**
     * Filtre + tri des coachs.
     * criteres = { texte, specialite, commune, noteMin, prixMax, langue, dispoJour, tri }
     */
    rechercher(criteres) {
      criteres = criteres || {};
      let liste = tous().slice();

      if (criteres.texte) {
        const t = criteres.texte.toLowerCase();
        liste = liste.filter((c) =>
          (`${c.prenom} ${c.nom}`).toLowerCase().includes(t) ||
          (c.titre || "").toLowerCase().includes(t) ||
          (c.bio || "").toLowerCase().includes(t) ||
          (c.specialites || []).some((s) => s.includes(t)) ||
          (c.commune || "").toLowerCase().includes(t)
        );
      }
      if (criteres.specialite) {
        liste = liste.filter((c) => (c.specialites || []).includes(criteres.specialite));
      }
      if (criteres.commune) {
        liste = liste.filter((c) => c.commune === criteres.commune);
      }
      if (criteres.langue) {
        liste = liste.filter((c) => (c.langues || []).includes(criteres.langue));
      }
      if (criteres.noteMin) {
        liste = liste.filter((c) => (c.note || 0) >= Number(criteres.noteMin));
      }
      if (criteres.prixMax) {
        liste = liste.filter((c) => coachService.prixMin(c) <= Number(criteres.prixMax));
      }
      if (criteres.dispoJour) {
        liste = liste.filter((c) => (c.disponibilites[criteres.dispoJour] || []).length > 0);
      }

      switch (criteres.tri) {
        case "note": liste.sort((a, b) => b.note - a.note); break;
        case "prix_asc": liste.sort((a, b) => coachService.prixMin(a) - coachService.prixMin(b)); break;
        case "prix_desc": liste.sort((a, b) => coachService.prixMin(b) - coachService.prixMin(a)); break;
        case "trust": liste.sort((a, b) => coachService.trustScore(b) - coachService.trustScore(a)); break;
        default: liste.sort((a, b) => coachService.trustScore(b) - coachService.trustScore(a));
      }
      return liste;
    },

    prixMin(c) { return Math.min(...(c.tarifs || [{ prix: 0 }]).map((t) => t.prix)); },

    populaires(n) {
      return tous().slice().sort((a, b) => b.note - a.note || b.nbAvis - a.nbAvis).slice(0, n || 4);
    },

    /* ---------------------------- Favoris ----------------------------- */
    favoris() { return storage.lire(storage.CLES.favoris, []); },
    estFavori(id) { return coachService.favoris().includes(id); },
    basculerFavori(id) {
      let f = coachService.favoris();
      if (f.includes(id)) f = f.filter((x) => x !== id);
      else f.push(id);
      storage.ecrire(storage.CLES.favoris, f);
      return f.includes(id);
    },

    /* ----------------------------- Avis ------------------------------- */
    ajouterAvis(coachId, avis) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.avis = c.avis || [];
      c.avis.unshift({
        id: CL.dom.uid("a"),
        auteur: avis.auteur,
        note: avis.note,
        texte: avis.texte,
        date: new Date().toISOString(),
        reponse: null,
      });
      // Recalcule la note moyenne et le nombre d'avis.
      c.nbAvis = c.avis.length;
      c.note = Math.round((c.avis.reduce((s, a) => s + a.note, 0) / c.avis.length) * 10) / 10;
      sauver(liste);
      return true;
    },

    repondreAvis(coachId, avisId, reponse) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      const a = (c.avis || []).find((x) => x.id === avisId);
      if (!a) return false;
      a.reponse = reponse;
      sauver(liste);
      return true;
    },

    /* ----------------------------- Posts ------------------------------ */
    ajouterPost(coachId, post) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.posts = c.posts || [];
      c.posts.unshift({
        id: CL.dom.uid("p"),
        texte: post.texte,
        image: post.image || null,   // data-URL (image téléversée)
        video: post.video || null,   // lien vidéo (YouTube/Vimeo/direct)
        date: new Date().toISOString(),
        likes: 0,
      });
      sauver(liste);
      return true;
    },

    supprimerPost(coachId, postId) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.posts = (c.posts || []).filter((p) => p.id !== postId);
      sauver(liste);
      return true;
    },

    /* -------------------------- Médias / photos ----------------------- */
    /** Définit la photo de profil (data-URL) ou la retire (null). */
    majPhoto(coachId, dataUrl) { return coachService.majProfil(coachId, { photo: dataUrl }); },
    /** Définit la photo de couverture (data-URL) ou la retire (null). */
    majCouverture(coachId, dataUrl) { return coachService.majProfil(coachId, { couverture: dataUrl }); },

    /* ------------------------------ Galerie --------------------------- */
    galerie(coachId) {
      const c = coachService.obtenir(coachId);
      return (c && c.galerie) || [];
    },
    ajouterMedia(coachId, media) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.galerie = c.galerie || [];
      c.galerie.unshift({
        id: CL.dom.uid("m"),
        image: media.image,          // data-URL
        legende: media.legende || "",
        date: new Date().toISOString(),
      });
      sauver(liste);
      return true;
    },
    supprimerMedia(coachId, mediaId) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.galerie = (c.galerie || []).filter((m) => m.id !== mediaId);
      sauver(liste);
      return true;
    },

    aimerPost(coachId, postId) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      const p = c && (c.posts || []).find((x) => x.id === postId);
      if (!p) return 0;
      p.likes = (p.likes || 0) + 1;
      sauver(liste);
      return p.likes;
    },

    /* --------------------------- Diplômes ----------------------------- */
    ajouterDiplome(coachId, diplome) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.diplomes = c.diplomes || [];
      c.diplomes.push({
        id: CL.dom.uid("d"),
        titre: diplome.titre,
        ecole: diplome.ecole,
        annee: diplome.annee,
        statut: "en_attente",
        fichierId: diplome.fichierId || null,
      });
      sauver(liste);
      return true;
    },

    /** Modération admin : valider ou refuser un diplôme. */
    statutDiplome(coachId, diplomeId, statut) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      const d = c && (c.diplomes || []).find((x) => x.id === diplomeId);
      if (!d) return false;
      d.statut = statut; // "verifie" | "refuse"
      sauver(liste);
      return true;
    },

    diplomesEnAttente() {
      const res = [];
      tous().forEach((c) => {
        (c.diplomes || []).forEach((d) => {
          if (d.statut === "en_attente") res.push({ coach: c, diplome: d });
        });
      });
      return res;
    },

    /* ------------------------ Disponibilités -------------------------- */
    /** Marque un créneau comme occupé (après réservation confirmée). */
    reserverCreneau(coachId, jour, heure) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c || !c.disponibilites[jour]) return false;
      c.disponibilites[jour] = c.disponibilites[jour].filter((h) => h !== heure);
      c.nbSeances = (c.nbSeances || 0) + 1;
      sauver(liste);
      return true;
    },

    majDisponibilites(coachId, dispo) {
      const liste = tous();
      const c = liste.find((x) => x.id === coachId);
      if (!c) return false;
      c.disponibilites = dispo;
      sauver(liste);
      return true;
    },

    /* --------------------------- Mise à jour -------------------------- */
    majProfil(coachId, patch) {
      const liste = tous();
      const idx = liste.findIndex((x) => x.id === coachId);
      if (idx === -1) return false;
      liste[idx] = Object.assign({}, liste[idx], patch);
      sauver(liste);
      return liste[idx];
    },

    /** Crée une fiche coach à l'inscription (données minimales). */
    creerDepuisInscription(user, donnees) {
      const liste = tous();
      const id = "coach_" + user.id;
      liste.push({
        id,
        prenom: user.prenom, nom: user.nom, genre: donnees.genre || "h",
        titre: donnees.titre || "Nouveau coach",
        specialites: donnees.specialites || [],
        categorie: donnees.categorie || "Bien-être",
        langues: donnees.langues || ["Français"],
        commune: donnees.commune || "Cocody", ville: "Abidjan",
        bio: donnees.bio || "",
        tarifs: donnees.tarifs || [{ id: "t1", nom: "Séance individuelle", type: "seance", prix: 10000, duree: 60, description: "" }],
        diplomes: [],
        note: 0, nbAvis: 0, nbSeances: 0, ancienneteMois: 0, tauxReponse: 100,
        disponibilites: { Lun: [], Mar: [], Mer: [], Jeu: [], Ven: [], Sam: [], Dim: [] },
        reseaux: donnees.reseaux || {},
        email: user.email, telephone: user.telephone,
        couleur: "#1b4dcc",
        avis: [], posts: [],
        proprietaire: user.id,
      });
      sauver(liste);
      return id;
    },
  };

  CL.coachService = coachService;
})();
