/* ==========================================================================
   utils/localisation.js — Sélection d'un lieu (GPS + adresse) réutilisable.
   - Capture la position via l'API Geolocation du navigateur (aucune clé).
   - Champs ville / commune / quartier / adresse (repères CI).
   - Aperçu Google Maps intégré (iframe sans clé API) + lien "Ouvrir dans Maps".
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const el = CL.dom.el;

  function requete(loc) {
    if (loc.lat && loc.lng) return loc.lat + "," + loc.lng;
    return [loc.adresse, loc.quartier, loc.commune, loc.ville, "Côte d'Ivoire"].filter(Boolean).join(", ");
  }

  const localisation = {
    /** Lien Google Maps (coordonnées ou adresse). */
    lienMaps(loc) {
      return "https://www.google.com/maps?q=" + encodeURIComponent(requete(loc || {}));
    },
    /** URL d'intégration Maps (iframe, sans clé API). */
    embedMaps(loc) {
      return "https://maps.google.com/maps?q=" + encodeURIComponent(requete(loc || {})) + "&z=15&output=embed";
    },

    /** Résumé lisible d'un lieu (pour affichage). */
    resume(loc) {
      if (!loc) return "";
      return [loc.lieuNom, loc.quartier, loc.commune, loc.ville].filter(Boolean).join(" · ");
    },

    /**
     * Construit un champ de localisation.
     * @param {object} init  valeurs initiales { lieuNom, adresse, ville, commune, quartier, lat, lng }
     * @param {object} opts  { salle:boolean } affiche le nom du lieu/salle
     * @returns {{el:HTMLElement, valeur:function}}
     */
    champ(init, opts) {
      init = init || {}; opts = opts || {};
      const inp = (ph, val) => el("input", { class: "input", placeholder: ph, value: val || "" });
      const nomSalle = inp("Nom de la salle / du lieu", init.lieuNom);
      const adresse  = inp("Adresse / rue", init.adresse);
      const ville    = inp("Ville", init.ville || "Abidjan");
      const commune  = inp("Commune (ex : Cocody)", init.commune);
      const quartier = inp("Quartier / repère", init.quartier);
      const lat = el("input", { class: "input", placeholder: "Latitude", value: init.lat || "", readonly: "readonly" });
      const lng = el("input", { class: "input", placeholder: "Longitude", value: init.lng || "", readonly: "readonly" });
      const apercu = el("div", { class: "mt-2" });

      function valeur() {
        return {
          lieuNom: nomSalle.value.trim(), adresse: adresse.value.trim(),
          ville: ville.value.trim(), commune: commune.value.trim(), quartier: quartier.value.trim(),
          lat: lat.value.trim(), lng: lng.value.trim(),
        };
      }

      function majApercu() {
        CL.dom.vider(apercu);
        const loc = valeur();
        if (loc.lat || loc.ville || loc.adresse) {
          apercu.appendChild(el("iframe", {
            src: localisation.embedMaps(loc), loading: "lazy", title: "Carte du lieu",
            style: "width:100%;height:180px;border:0;border-radius:10px",
          }));
          apercu.appendChild(el("a", {
            class: "btn-lien texte-sm", href: localisation.lienMaps(loc), target: "_blank", rel: "noopener",
            html: CL.icon("localisation", 14) + " Ouvrir dans Google Maps",
          }));
        }
      }

      const btnGps = el("button", { class: "btn btn-fantome btn-sm", type: "button", html: CL.icon("localisation", 16) + " Utiliser ma position (GPS)" });
      btnGps.addEventListener("click", () => {
        if (!navigator.geolocation) return CL.toast.erreur("GPS", "Géolocalisation indisponible sur cet appareil.");
        btnGps.disabled = true; btnGps.textContent = "Localisation…";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat.value = pos.coords.latitude.toFixed(6);
            lng.value = pos.coords.longitude.toFixed(6);
            btnGps.disabled = false; btnGps.innerHTML = CL.icon("localisation", 16) + " Position enregistrée ✓";
            CL.toast.succes("Position enregistrée", "Coordonnées GPS capturées.");
            majApercu();
          },
          () => {
            btnGps.disabled = false; btnGps.innerHTML = CL.icon("localisation", 16) + " Utiliser ma position (GPS)";
            CL.toast.info("GPS refusé", "Saisissez l'adresse manuellement.");
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      [adresse, ville, commune, quartier].forEach((i) => i.addEventListener("change", majApercu));

      function chp(label, input) { return el("div", { class: "champ" }, [el("label", { text: label }), input]); }

      const bloc = el("div", { class: "pile-3" }, [
        opts.salle ? chp("Nom de la salle / du lieu", nomSalle) : null,
        el("div", { class: "grille grille-2" }, [chp("Ville", ville), chp("Commune", commune)]),
        el("div", { class: "grille grille-2" }, [chp("Quartier / repère", quartier), chp("Adresse", adresse)]),
        el("div", {}, [
          el("label", { class: "champ", style: "font-weight:600;margin-bottom:6px;display:block", text: "Position GPS (Google Maps)" }),
          el("div", { class: "rangee gap-2 rangee-wrap" }, [btnGps, el("div", { class: "grille grille-2", style: "flex:1;min-width:180px" }, [lat, lng])]),
        ]),
        apercu,
      ]);
      majApercu();
      return { el: bloc, valeur };
    },
  };

  CL.localisation = localisation;
})();
