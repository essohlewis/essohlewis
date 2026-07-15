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

  const bookingService = {
    OPERATEURS,

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

    /**
     * Crée une demande de prestation (statut en_attente).
     * donnees = { coachId, clientId, clientNom, tarifId, tarifNom, prix,
     *             jour, heure, message }
     */
    creer(donnees) {
      const liste = toutes();
      const resa = Object.assign({
        id: CL.dom.uid("resa"),
        statut: "en_attente",
        paiement: null,
        creeLe: new Date().toISOString(),
      }, donnees);
      liste.push(resa);
      sauver(liste);

      // Notifie le coach.
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

    /** Enregistre le paiement Mobile Money simulé. */
    payer(resaId, paiement) {
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return { ok: false, message: "Réservation introuvable." };
      // Simulation : le code de confirmation doit faire 4 chiffres.
      if (!/^\d{4}$/.test(String(paiement.code || ""))) {
        return { ok: false, message: "Code de confirmation invalide (4 chiffres attendus)." };
      }
      r.paiement = {
        operateur: paiement.operateur,
        numero: paiement.numero,
        montant: r.prix,
        reference: "MM" + Date.now().toString().slice(-8),
        date: new Date().toISOString(),
      };
      sauver(liste);
      return { ok: true, reservation: r };
    },

    /** Change le statut (côté coach ou client). */
    changerStatut(resaId, statut) {
      const liste = toutes();
      const r = liste.find((b) => b.id === resaId);
      if (!r) return false;
      r.statut = statut;
      sauver(liste);

      // Effets de bord : notifications + occupation créneau.
      if (statut === "confirmee") {
        CL.coachService.reserverCreneau(r.coachId, r.jour, r.heure);
        CL.notifications.ajouter(r.clientId, {
          type: "confirmation",
          texte: `Votre séance « ${r.tarifNom} » a été confirmée !`,
          lien: "#/client/reservations",
        });
      } else if (statut === "refusee") {
        CL.notifications.ajouter(r.clientId, {
          type: "refus",
          texte: `Votre demande « ${r.tarifNom} » a été refusée.`,
          lien: "#/client/reservations",
        });
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
