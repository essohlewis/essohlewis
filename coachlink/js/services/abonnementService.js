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
      // Résiliation → règlement au prorata des mois encore sous séquestre.
      if (statut === "termine" || statut === "annule") {
        (a.paiements || []).forEach((p) => {
          if (p.libere) return;
          const prevues = Math.max(1, Number(p.seancesPrevues) || 1);
          const validees = Math.min(Number(p.seancesValidees) || 0, prevues);
          const coach = Math.round((Number(p.montant) || 0) * validees / prevues);
          p.montantLibere = coach; p.rembourse = (Number(p.montant) || 0) - coach; p.libere = true;
          if (p.rembourse > 0 && CL.notifications) {
            CL.notifications.ajouter(a.clientId, { type: "paiement", texte: `Abonnement résilié : remboursement de ${CL.format.fcfa(p.rembourse)} pour ${prevues - validees} séance(s) non effectuée(s) (${p.mois}).`, lien: "#/client/abonnements" });
          }
        });
      }
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
      // Règlement SOUS SÉQUESTRE (libere:false) : crédité au portefeuille du coach
      // seulement quand toutes les séances du mois auront été validées par QR.
      a.paiements.unshift({
        id: CL.dom.uid("abp"), mois, montant: a.prixMensuel, operateur: paiement.operateur,
        reference: "AB" + Date.now().toString().slice(-8), date: new Date().toISOString(),
        seancesPrevues: (Number(a.seancesSemaine) || 1) * 4, seancesValidees: 0, libere: false, montantLibere: 0, rembourse: 0,
      });
      if (a.statut !== "actif") { a.statut = "actif"; a.dateDebut = new Date().toISOString(); }
      // Jeton de présence (graine du QR rotatif de l'abonnement).
      if (!a.jeton) a.jeton = "CLQR-abo" + a.id + "-" + Math.random().toString(16).slice(2, 18);
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
              if (!cur.jeton) cur.jeton = "CLQR-abo" + cur.id + "-" + Math.random().toString(16).slice(2, 18);
              cur.paiements.unshift({ id: CL.dom.uid("abp"), mois, montant: cur.prixMensuel, operateur: "Auto (renouvellement)", reference: "AR" + Date.now().toString().slice(-8), date: new Date().toISOString(),
                seancesPrevues: (Number(cur.seancesSemaine) || 1) * 4, seancesValidees: 0, libere: false, montantLibere: 0, rembourse: 0 });
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

    /** Règlement du mois (objet paiement) ou null. */
    paiementDuMois(a, mois) { return (a.paiements || []).find((p) => p.mois === mois) || null; },

    /** Progression des séances du mois : { validees, prevues, libere }. */
    progresMois(a, mois) {
      const p = abonnementService.paiementDuMois(a, mois || abonnementService.moisCourant());
      if (!p) return { validees: 0, prevues: (Number(a.seancesSemaine) || 1) * 4, libere: false, regle: false };
      return { validees: Number(p.seancesValidees) || 0, prevues: Number(p.seancesPrevues) || (Number(a.seancesSemaine) || 1) * 4, libere: !!p.libere, regle: true };
    },

    /**
     * Le coach valide une séance d'abonnement via le QR rotatif du client.
     * Comptabilise la séance du mois ; libère la mensualité au portefeuille dès
     * que toutes les séances prévues sont validées. Renvoie { ok, validees?, prevues?, libere?, message? }.
     */
    async validerSeance(id, code) {
      if (_api()) {
        try {
          const a = CL.API.mapAbonnement(await CL.API.abonnementValiderSeance(id, String(code || "").trim()));
          _remplacer(a);
          const p = abonnementService.paiementDuMois(a, abonnementService.moisCourant());
          return { ok: true, validees: p ? p.seancesValidees : 0, prevues: p ? p.seancesPrevues : 0, libere: p ? p.libere : false };
        } catch (e) { return { ok: false, message: (e && e.message) || "Code de présence invalide ou expiré." }; }
      }
      const l = toutes(); const a = l.find((x) => String(x.id) === String(id));
      if (!a) return { ok: false, message: "Abonnement introuvable." };
      if (!a.jeton) return { ok: false, message: "Abonnement non actif (aucun règlement)." };
      const fen = CL.otp ? CL.otp.fenetreValide(a.jeton, code) : null;
      if (fen === null) return { ok: false, message: "Code de présence invalide ou expiré." };
      const mois = abonnementService.moisCourant();
      const p = abonnementService.paiementDuMois(a, mois);
      if (!p) return { ok: false, message: "Le mois en cours n'est pas encore réglé." };
      a.fenetresValidees = a.fenetresValidees || [];
      if (a.fenetresValidees.indexOf(fen) !== -1) return { ok: false, message: "Cette séance vient déjà d'être validée." };
      a.fenetresValidees.push(fen);
      a.seances = a.seances || [];
      a.seances.push({ mois, fenetre: fen, date: new Date().toISOString() });
      p.seancesValidees = (Number(p.seancesValidees) || 0) + 1;
      p.libere = p.seancesValidees >= (Number(p.seancesPrevues) || 0);
      if (p.libere) p.montantLibere = p.montant; // toutes les séances → mensualité intégrale
      sauver(l);
      if (CL.notifications) {
        CL.notifications.ajouter(a.clientId, { type: "confirmation", texte: `Séance d'abonnement validée (${p.seancesValidees}/${p.seancesPrevues}).`, lien: "#/client/abonnements" });
        if (p.libere) notifierCoach(a, `Toutes les séances du mois validées : ${CL.format.fcfa(p.montant)} crédités sur votre portefeuille.`);
      }
      return { ok: true, validees: p.seancesValidees, prevues: p.seancesPrevues, libere: p.libere };
    },
  };

  function _remplacer(a) {
    const l = toutes(); const i = l.findIndex((x) => String(x.id) === String(a.id));
    if (i >= 0) l[i] = a; else l.unshift(a);
    sauver(l);
  }

  CL.abonnementService = abonnementService;
})();
