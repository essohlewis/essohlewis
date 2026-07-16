/* ==========================================================================
   utils/media.js — Gestion des médias côté client (sans serveur) :
   - lecture + redimensionnement d'images (canvas) pour maîtriser le poids ;
   - déclenchement d'un sélecteur de fichier ;
   - analyse des liens vidéo (YouTube / Vimeo / lien direct) et intégration.
   >>> Branchement API : remplacer le stockage data-URL par un upload
       multipart vers /media et conserver l'URL renvoyée. <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const media = {
    MAX_SOURCE: 8 * 1024 * 1024, // 8 Mo max en entrée

    /**
     * Lit un fichier image et renvoie une data-URL JPEG redimensionnée.
     * @param {File} file
     * @param {number} maxDim  plus grande dimension cible (px)
     * @param {number} qualite 0-1
     * @returns {Promise<string>} data-URL
     */
    lireImage(file, maxDim, qualite) {
      maxDim = maxDim || 1000;
      qualite = qualite || 0.72;
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error("Veuillez choisir une image."));
        if (file.size > media.MAX_SOURCE) return reject(new Error("Image trop lourde (8 Mo max)."));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("Image illisible."));
          img.onload = () => {
            let { width, height } = img;
            const echelle = Math.min(1, maxDim / Math.max(width, height));
            width = Math.round(width * echelle);
            height = Math.round(height * echelle);
            const canvas = document.createElement("canvas");
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            try {
              resolve(canvas.toDataURL("image/jpeg", qualite));
            } catch (e) { reject(new Error("Conversion de l'image échouée.")); }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    /**
     * Ouvre le sélecteur de fichier et renvoie le File choisi (ou null).
     * @param {string} accept  ex: "image/*"
     */
    choisirFichier(accept) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept || "image/*";
        input.style.display = "none";
        input.addEventListener("change", () => { resolve(input.files[0] || null); input.remove(); });
        document.body.appendChild(input);
        input.click();
      });
    },

    /** Raccourci : choisir une image + la redimensionner. */
    async choisirImage(maxDim, qualite) {
      const file = await media.choisirFichier("image/*");
      if (!file) return null;
      return media.lireImage(file, maxDim, qualite);
    },

    /**
     * Analyse un lien vidéo.
     * @returns {{type:string, id?:string, embed?:string, url:string}|null}
     */
    parseVideo(url) {
      url = String(url || "").trim();
      if (!url) return null;
      let m;
      if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/))) {
        return { type: "youtube", id: m[1], embed: "https://www.youtube.com/embed/" + m[1], url };
      }
      if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
        return { type: "vimeo", id: m[1], embed: "https://player.vimeo.com/video/" + m[1], url };
      }
      if (/^https?:\/\/.+/i.test(url)) return { type: "lien", url };
      return null;
    },

    /**
     * Construit l'élément d'intégration d'une vidéo (iframe ou lien).
     * @returns {HTMLElement|null}
     */
    elementVideo(url) {
      const v = media.parseVideo(url);
      if (!v) return null;
      if (v.embed) {
        return CL.dom.el("div", { class: "post__media" }, [
          CL.dom.el("iframe", {
            src: v.embed, title: "Vidéo", loading: "lazy",
            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
            allowfullscreen: "allowfullscreen",
            style: "width:100%;height:100%;border:0",
          }),
        ]);
      }
      // Lien vidéo direct ou inconnu : bouton de lecture externe.
      return CL.dom.el("a", { class: "post__media post__media--lien", href: v.url, target: "_blank", rel: "noopener" }, [
        CL.dom.el("div", { class: "post__media-play", html: CL.icon("lecture", 26, { fill: true }) }),
        CL.dom.el("span", { class: "texte-sm", text: "Voir la vidéo" }),
      ]);
    },
  };

  CL.media = media;
})();
