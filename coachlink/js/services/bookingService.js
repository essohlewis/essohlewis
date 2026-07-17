/* ==========================================================================
   services/bookingService.js — Réservations, statuts, paiement Mobile Money
   simulé, notifications liées.
   Statuts : en_attente → confirmee / refusee → terminee / annulee.
   >>> Branchement API : POST /reservations, PATCH /reservations/:id … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  function toutes() { return storage.lire(storage.CLES.bookings, []); }
  function sauver(l) { storage.ecrire(storage.CLES.bookings, l); }

  const OPERATEURS = [
    { id: "orange", nom: "Orange Money", prefixe: "07", classe: "op-orange", label: "OM" },
    { id: "mtn", nom: "MTN MoMo", prefixe: "05", classe: "op-mtn", label: "MTN" },
    { id: "moov", nom: "Moov Money", prefixe: "01", classe: "op-moov", label: "Moov" },
    { id: "wave", nom: "Wave", prefixe: "", classe: "op-wave", label: "Wave" },
  ];

  // Codes promotionnels de la plateforme (taux de réduction en %).
  const PROMOS = {
    BIENVENUE10: { taux: 10, libelle: "Offre de bienvenue" },
    COACHLINK15: { taux: 15, libelle: "Promo CoachLink" },
    SPORT2026: { taux: 20, libelle: "Spécial rentrée sportive" },
  };

  const bookingService = {
    OPERATEURS,
    PROMOS,

    /**
     * Valide un code promo ou un code de parrainage.
     * Les codes de parrainage ont le format PARRAIN-XXXX (10 % de remise) et
     * ne peuvent pas être son propre code.
     * @returns {{ok:boolean, taux?:number, libelle?:string, message?:string}}
     */
    validerPromo(code, userId) {
      const c = String(code || "").trim().toUpperCase();
      if (!c) return { ok: false, message: "Saisissez un code." };
      if (PROMOS[c]) return { ok: true, taux: PROMOS[c].taux, libelle: PROMOS[c].libelle };
      if (/^PARRAIN-[A-Z0-9]{4,}$/.test(c)) {
        if (userId && CL.auth.codeParrainage && c === CL.auth.codeParrainage(CL.auth.courant())) {
          return { ok: false, message: "Vous ne pouvez pas utiliser votre propre code de parrainage." };
        }
        return { ok: true, taux: 10, libelle: "Parrainage" };
      }
      return { ok: false, message: "Code invalide ou expiré." };
    },

    STATUTS: {
      en_attente: { label: "En attente", classe: "st-attente" },
      confirmee: { label: "Confirmée", classe: "st-confirme" },
      refusee: { label: "Refusée", classe: "st-annule" },
      terminee: { label: "Terminée", classe: "st-termine" },
      annulee: { label: "Annulée", classe: "st-annule" },
    },

    lister() { return toutes(); },

    /** Réservations d'un client. */
    parClient(userId) {
      return toutes().filter((b) => b.clientId === userId)
        .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    },

    /** Demandes reçues par un coach. */
    parCoach(coachId) {
      return toutes().filter((b) => b.coachId === coachId)
        .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    },

    obtenir(id) { return toutes().find((b) => b.id === id) || null; },

    _api() { return CL.API && CL.API.actif; },

    /**
     * Crée une demande de prestation (statut en_attente). Asynchrone.
     * donnees = { coachId, clientId, clientNom, tarifId, tarifNom, prix,
     *             duree, jour, heure, message }
     */
    async creer(donnees) {
      if (bookingService._api()) {
        const brut = await CL.API.reserver({
          coachId: donnees.coachId, tarifId: donnees.tarifId, tarifNom: donnees.tarifNom,
          prix: donnees.prix, duree: donnees.duree, jour: donnees.jour, heure: donnees.heure,
          message: donnees.message || "",
          lieuType: donnees.lieuType || "", lieuNom: donnees.lieuNom || "", adresse: donnees.adresse || "",
          ville: donnees.ville || "", commune: donnees.commune || "", quartier: donnees.quartier || "",
          lat: donnees.lat || "", lng: donnees.lng || "",
        });
        const resa = CL.API.mapReservation(brut);
        const liste = toutes(); liste.unshift(resa); sauver(liste); // reflète localement (le serveur notifie le coach)
        return resa;
      }
      const liste = toutes();
      const resa = Object.assign({
        id: CL.dom.uid("resa"), statut: "en_attente", paiement: null,
        creeLe: new Date().toISOString(),
      }, donnees);
      liste.push(resa);
      sauver(liste);
      const coach = CL.coachService.obtenir(donnees.coachId);
      if (coach && coach.proprietaire) {
        CL.notifications.ajouter(coach.proprietaire, {
          type: "reservation",
          texte: `Nouvelle demande de ${donnees.clientNom} pour « ${donnees.tarifNom} ».`,
          lien: "#/espace-coach/reservations",
        });
      }
      return resa;
    },

    /** Enregistre le paiement Mobile Money (asynchrone). */
    async payer(resaId, paiement) {
      // Validation commune du code de confirmation.
      if (!/^\d{4}$/.test(String(paiement.code || ""))) {
        return { ok: false, message: "Code de confirmation invalide (4 chiffres attendus)." };
      }
      if (bookingService._api()) {
        try {
          const brut = await CL.API.payer(resaId, {
            operateur: paiement.operateur, numero: paiement.numero, code: paiement.code,
            promoTaux: paiement.promo ? paiement.promo.taux : null,
            promoCode: paiement.promo ? paiement.promo.code : null,
          });
          // Paiement réel asynchrone : l'opérateur confirmera via webhook.
          // (« paiement_statut » distinct du statut de la réservation.)
          if (brut && brut.paiement_statut === "en_attente") {
            return { ok: true, enAttente: true, reference: brut.reference, lien: brut.lien || null,
                     message: brut.message || "Confirmez le paiement sur votre téléphone." };
          }
          const resa = CL.API.mapReservation(brut);
          const liste = toutes();
          const i = liste.findIndex((b) => String(b.id) === String(resaId));
          if (i >= 0) liste[i] = resa; else liste.unshift(resa);
          sauver(liste);
          return { ok: true, reservation: resa };
        } catch (e) {
          return { ok: false, message: e.message || "Paiement refusé." };
        }
      }
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return { ok: false, message: "Réservation introuvable." };
      // Application éventuelle d'un code promo / parrainage.
      let remise = 0, promo = null;
      if (paiement.promo && paiement.promo.taux) {
        remise = Math.round((r.prix * paiement.promo.taux) / 100);
        promo = { code: paiement.promo.code, taux: paiement.promo.taux, libelle: paiement.promo.libelle };
      }
      const montantPaye = r.prix - remise;
      r.paiement = {
        operateur: paiement.operateur,
        numero: paiement.numero,
        montant: montantPaye,
        prixInitial: r.prix,
        remise,
        promo,
        reference: "MM" + Date.now().toString().slice(-8),
        date: new Date().toISOString(),
      };
      sauver(liste);
      // Notifie le coach du paiement reçu.
      const coach = CL.coachService.obtenir(r.coachId);
      if (coach && coach.proprietaire) {
        CL.notifications.ajouter(coach.proprietaire, {
          type: "paiement",
          texte: `${r.clientNom} a payé « ${r.tarifNom} » (${(montantPaye).toLocaleString("fr-FR")} FCFA).`,
          lien: "#/espace-coach/reservations",
        });
      }
      return { ok: true, reservation: r };
    },

    /** Le coach ajuste le lieu du rendez-vous. Renvoie la résa mise à jour ou false. */
    majLieu(resaId, loc) {
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return false;
      Object.assign(r, {
        lieuType: loc.lieuType || r.lieuType || "", lieuNom: loc.lieuNom || "", adresse: loc.adresse || "",
        ville: loc.ville || "", commune: loc.commune || "", quartier: loc.quartier || "",
        lat: loc.lat || "", lng: loc.lng || "",
      });
      sauver(liste);
      if (bookingService._api()) {
        CL.API.patch("/reservations/" + resaId + "/lieu", loc).catch(() => {});
      } else {
        CL.notifications.ajouter(r.clientId, {
          type: "reservation", texte: `Votre coach a précisé le lieu de « ${r.tarifNom} ».`, lien: "#/client/reservations",
        });
      }
      return r;
    },

    /**
     * Le coach valide la présence via le code du QR : la séance passe « terminée »
     * et les fonds sont libérés vers son portefeuille. Renvoie { ok, resa?, message? }.
     */
    async validerPresence(resaId, code) {
      if (bookingService._api()) {
        try {
          const brut = await CL.API.validerPresence(resaId, String(code || "").trim());
          const resa = CL.API.mapReservation(brut);
          const liste = toutes(); const i = liste.findIndex((b) => b.id === resaId);
          if (i >= 0) liste[i] = resa; else liste.unshift(resa); sauver(liste);
          return { ok: true, resa };
        } catch (e) { return { ok: false, message: (e && e.message) || "Code QR invalide." }; }
      }
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return { ok: false, message: "Réservation introuvable." };
      if (r.presenceValidee) return { ok: false, message: "Présence déjà validée." };
      var codeOk = CL.otp ? CL.otp.valide(r.jeton, code) : (String(r.jeton) === String(code || "").trim());
      if (!r.jeton || !codeOk) return { ok: false, message: "Code de présence invalide ou expiré." };
      r.presenceValidee = true; r.presenceLe = new Date().toISOString(); r.statut = "terminee";
      sauver(liste);
      // Notifie les deux parties (le portefeuille du coach est crédité, cf. portefeuilleService).
      CL.notifications.ajouter(r.clientId, { type: "confirmation", texte: `Présence validée pour « ${r.tarifNom} ». Merci et à bientôt !`, lien: "#/client/reservations" });
      const coach = CL.coachService.obtenir(r.coachId);
      if (coach && coach.proprietaire) {
        CL.notifications.ajouter(coach.proprietaire, { type: "paiement", texte: `Séance « ${r.tarifNom} » validée : ${CL.format.fcfa(r.prix)} crédités sur votre portefeuille.`, lien: "#/espace-coach/portefeuille" });
      }
      return { ok: true, resa: r };
    },

    /** Change le statut (côté coach ou client). */
    changerStatut(resaId, statut) {
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return false;
      r.statut = statut;
      sauver(liste);

      // En mode API, le serveur gère la transition (notifications, créneau).
      if (bookingService._api()) {
        CL.API.patch("/reservations/" + resaId + "/statut", { statut }).catch(() => {});
        return true;
      }

      // Effets de bord : notifications + occupation créneau.
      if (statut === "confirmee") {
        if (!r.jeton) { r.jeton = "CLQR-" + r.id + "-" + Math.random().toString(16).slice(2, 18); sauver(liste); }
        CL.coachService.reserverCreneau(r.coachId, r.jour, r.heure);
        CL.notifications.ajouter(r.clientId, {
          type: "confirmation",
          texte: `Votre séance « ${r.tarifNom} » a été confirmée ! Présentez votre QR de présence au coach en fin de séance.`,
          lien: "#/client/reservations",
        });
      } else if (statut === "refusee") {
        CL.notifications.ajouter(r.clientId, {
          type: "refus",
          texte: `Votre demande « ${r.tarifNom} » a été refusée.`,
          lien: "#/client/reservations",
        });
      } else if (statut === "terminee") {
        CL.notifications.ajouter(r.clientId, {
          type: "info",
          texte: `Séance « ${r.tarifNom} » terminée. Laissez un avis à votre coach !`,
          lien: "#/client/avis",
        });
      } else if (statut === "annulee") {
        // Annulation par le client → prévient le coach.
        const coach = CL.coachService.obtenir(r.coachId);
        if (coach && coach.proprietaire) {
          CL.notifications.ajouter(coach.proprietaire, {
            type: "annulation",
            texte: `${r.clientNom} a annulé sa réservation « ${r.tarifNom} ».`,
            lien: "#/espace-coach/reservations",
          });
        }
      }
      return true;
    },

    /** Réservations terminées d'un client sans avis (pour proposer d'évaluer). */
    aEvaluer(userId) {
      return toutes().filter((b) => b.clientId === userId && b.statut === "terminee" && !b.avisLaisse);
    },

    marquerAvisLaisse(resaId) {
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (r) { r.avisLaisse = true; sauver(liste); }
    },
  };

  CL.bookingService = bookingService;
})();
