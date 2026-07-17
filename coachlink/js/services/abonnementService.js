/* ==========================================================================
   services/abonnementService.js — Abonnements mensuels (programme client↔coach).
   Cycle : demande (client) → propose (coach : programme + prix) → actif
   (client paie) → termine / annule. Règlements mensuels (Mobile Money).
   >>> Branchement API : /abonnements … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  function toutes() { return storage.lire(storage.CLES.abonnements, []); }
  function sauver(l) { storage.ecrire(storage.CLES.abonnements, l); }
  function _api() { return CL.API && CL.API.actif; }

  function notifierCoach(a, texte) {
    const coach = CL.coachService && CL.coachService.obtenir(a.coachId);
    if (coach && coach.proprietaire && CL.notifications) {
      CL.notifications.ajouter(coach.proprietaire, { type: "abonnement", texte, lien: "#/espace-coach/abonnements" });
    }
  }

  const abonnementService = {
    LIEUX: {
      salle_coach: "Salle du coach",
      domicile: "À mon domicile",
      salle_proposee: "Salle proposée",
    },
    OBJECTIFS: ["Perte de poids", "Prise de masse", "Remise en forme", "Préparation physique", "Bien-être / souplesse", "Nutrition & suivi"],

    /** Prix mensuel = prix séance × séances/semaine × 4 (hors abonnement salle). */
    prixMensuel(prixSeance, seancesSemaine) {
      return (Number(prixSeance) || 0) * (Number(seancesSemaine) || 1) * 4;
    },

    parClient(userId) {
      return toutes().filter((a) => a.clientId === userId).sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    },
    parCoach(coachId) {
      return toutes().filter((a) => a.coachId === coachId).sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    },
    obtenir(id) { return toutes().find((a) => String(a.id) === String(id)) || null; },

    /** Mois courant au format Y-m. */
    moisCourant() { return new Date().toISOString().slice(0, 7); },
    moisRegle(a, mois) { return (a.paiements || []).some((p) => p.mois === mois); },

    /** Le client crée une demande d'abonnement (asynchrone). */
    async creer(d) {
      if (_api()) {
        const a = CL.API.mapAbonnement(await CL.API.post("/abonnements", d));
        const l = toutes(); l.unshift(a); sauver(l);
        return a;
      }
      const l = toutes();
      const a = {
        id: CL.dom.uid("abo"),
        clientId: d.clientId, clientNom: d.clientNom, coachId: d.coachId, coachNom: d.coachNom,
        objectif: d.objectif, seancesSemaine: Number(d.seancesSemaine) || 1,
        lieuType: d.lieuType || "salle_coach", lieuNom: d.lieuNom || "",
        adresse: d.adresse || "", ville: d.ville || "", commune: d.commune || "", quartier: d.quartier || "",
        lat: d.lat || "", lng: d.lng || "",
        prixSeance: Number(d.prixSeance) || 0,
        prixMensuel: abonnementService.prixMensuel(d.prixSeance, d.seancesSemaine),
        inclutSalle: !!d.inclutSalle, fixePar: d.fixePar === "coach" ? "coach" : "client",
        programme: {}, statut: "demande", paiements: [], creeLe: new Date().toISOString(),
      };
      l.unshift(a); sauver(l);
      notifierCoach(a, `${a.clientNom} souhaite un abonnement mensuel (${a.seancesSemaine} séance(s)/sem.).`);
      return a;
    },

    /** Le coach fixe le programme hebdomadaire + le prix, et propose (asynchrone). */
    async definirProgramme(id, d) {
      if (_api()) {
        const a = CL.API.mapAbonnement(await CL.API.patch("/abonnements/" + id + "/programme", d));
        _remplacer(a); return a;
      }
      const l = toutes(); const a = l.find((x) => String(x.id) === String(id));
      if (!a) return null;
      a.programme = d.programme || {};
      a.seancesSemaine = Number(d.seancesSemaine) || a.seancesSemaine;
      a.prixSeance = Number(d.prixSeance) || a.prixSeance;
      a.prixMensuel = abonnementService.prixMensuel(a.prixSeance, a.seancesSemaine);
      if (d.lieuNom) a.lieuNom = d.lieuNom;
      a.statut = "propose";
      // Le coach fixe et signe les termes du contrat en proposant le programme.
      if (!a.contratRef) a.contratRef = "CTR-" + a.id + "-" + Math.random().toString(16).slice(2, 10);
      a.contratCoachLe = new Date().toISOString();
      sauver(l);
      if (CL.notifications) CL.notifications.ajouter(a.clientId, {
        type: "abonnement", texte: `Votre coach a préparé votre programme mensuel (${CL.format.fcfa(a.prixMensuel)}).`,
        lien: "#/client/abonnements",
      });
      return a;
    },

    /** Change le statut (asynchrone). */
    async changerStatut(id, statut) {
      if (_api()) {
        const a = CL.API.mapAbonnement(await CL.API.patch("/abonnements/" + id + "/statut", { statut }));
        _remplacer(a); return a;
      }
      const l = toutes(); const a = l.find((x) => String(x.id) === String(id));
      if (!a) return null;
      a.statut = statut;
      if (statut === "actif") { a.dateDebut = new Date().toISOString(); }
      sauver(l);
      return a;
    },

    /** Règlement mensuel (asynchrone). Renvoie { ok, abonnement?, enAttente?, message? }. */
    async payer(id, paiement) {
      if (!/^\d{4}$/.test(String(paiement.code || ""))) {
        return { ok: false, message: "Code de confirmation invalide (4 chiffres attendus)." };
      }
      const mois = paiement.mois || abonnementService.moisCourant();
      if (_api()) {
        try {
          const brut = await CL.API.post("/abonnements/" + id + "/payer", {
            operateur: paiement.operateur, numero: paiement.numero, code: paiement.code, mois,
          });
          if (brut && brut.paiement_statut === "en_attente") {
            return { ok: true, enAttente: true, message: brut.message, lien: brut.lien || null };
          }
          const a = CL.API.mapAbonnement(brut); _remplacer(a);
          return { ok: true, abonnement: a };
        } catch (e) { return { ok: false, message: (e && e.message) || "Paiement refusé." }; }
      }
      const l = toutes(); const a = l.find((x) => String(x.id) === String(id));
      if (!a) return { ok: false, message: "Abonnement introuvable." };
      if (abonnementService.moisRegle(a, mois)) return { ok: false, message: "Ce mois est déjà réglé." };
      a.paiements = a.paiements || [];
      a.paiements.unshift({
        id: CL.dom.uid("abp"), mois, montant: a.prixMensuel, operateur: paiement.operateur,
        reference: "AB" + Date.now().toString().slice(-8), date: new Date().toISOString(),
      });
      if (a.statut !== "actif") { a.statut = "actif"; a.dateDebut = new Date().toISOString(); }
      // Le client accepte et signe le contrat en activant l'abonnement.
      if (!a.contratRef) a.contratRef = "CTR-" + a.id + "-" + Math.random().toString(16).slice(2, 10);
      if (!a.contratClientLe) a.contratClientLe = new Date().toISOString();
      sauver(l);
      notifierCoach(a, `${a.clientNom} a réglé son abonnement (${mois}).`);
      return { ok: true, abonnement: a };
    },

    /** Active/désactive le renouvellement automatique (asynchrone). */
    async basculerAuto(id, actif) {
      if (_api()) {
        const a = CL.API.mapAbonnement(await CL.API.abonnementAuto(id, !!actif));
        _remplacer(a); return a;
      }
      const l = toutes(); const a = l.find((x) => String(x.id) === String(id));
      if (!a) return null;
      a.autoRenouvellement = !!actif; sauver(l);
      return a;
    },

    /**
     * À l'ouverture de l'appli (client) : pour chaque abonnement actif dont le
     * mois courant n'est pas réglé → prélèvement automatique si activé, sinon
     * rappel de paiement (une seule fois par mois). Renvoie le nombre d'actions.
     */
    async verifierRenouvellements() {
      const u = CL.auth && CL.auth.courant();
      if (!u || u.role !== "client") return 0;
      const mois = abonnementService.moisCourant();
      const rappels = new Set(CL.storage.lire("cl_abo_rappels", []));
      let n = 0;
      const dus = abonnementService.parClient(u.id).filter((a) => a.statut === "actif" && !abonnementService.moisRegle(a, mois));
      for (const a of dus) {
        if (a.autoRenouvellement) {
          if (_api()) {
            try { _remplacer(CL.API.mapAbonnement(await CL.API.abonnementRenouveler(a.id, mois))); n++; } catch (_) { /* réessai au prochain chargement */ }
          } else {
            const l = toutes(); const cur = l.find((x) => String(x.id) === String(a.id));
            if (cur && !abonnementService.moisRegle(cur, mois)) {
              cur.paiements = cur.paiements || [];
              cur.paiements.unshift({ id: CL.dom.uid("abp"), mois, montant: cur.prixMensuel, operateur: "Auto (renouvellement)", reference: "AR" + Date.now().toString().slice(-8), date: new Date().toISOString() });
              sauver(l);
              CL.notifications.ajouter(u.id, { type: "paiement", texte: `Abonnement avec ${cur.coachNom} renouvelé automatiquement (${mois}) : ${CL.format.fcfa(cur.prixMensuel)}.`, lien: "#/client/abonnements" });
              notifierCoach(cur, `${cur.clientNom} — renouvellement automatique réglé (${mois}).`);
              n++;
            }
          }
        } else {
          const cle = "aborap:" + a.id + "@" + mois;
          if (!rappels.has(cle)) {
            CL.notifications.ajouter(u.id, { type: "rappel", texte: `Votre abonnement avec ${a.coachNom} (${mois}) est à régler : ${CL.format.fcfa(a.prixMensuel)}. Activez le renouvellement automatique pour ne plus y penser.`, lien: "#/client/abonnements" });
            rappels.add(cle); n++;
          }
        }
      }
      if (rappels.size) CL.storage.ecrire("cl_abo_rappels", Array.from(rappels).slice(-400));
      return n;
    },
  };

  function _remplacer(a) {
    const l = toutes(); const i = l.findIndex((x) => String(x.id) === String(a.id));
    if (i >= 0) l[i] = a; else l.unshift(a);
    sauver(l);
  }

  CL.abonnementService = abonnementService;
})();
