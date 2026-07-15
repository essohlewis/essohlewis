/* =============================================================================
 * MediaGrab — app.js
 * =============================================================================
 * ARCHITECTURE (lisez-moi)
 * -----------------------------------------------------------------------------
 * Application 100 % front-only (aucun backend, aucune dépendance, aucun build).
 * Le code est organisé en modules logiques regroupés par responsabilité :
 *
 *   1. CONSTANTES & UTILITAIRES  → constantes, helpers purs (formatage, DOM).
 *   2. THÈME                     → bascule sombre/clair, persistance localStorage.
 *   3. DÉTECTION D'URL           → validation, plateformes non supportées, type.
 *   4. TÉLÉCHARGEMENT PAR URL    → fetch + ReadableStream + progression réelle.
 *   5. FILE D'ATTENTE (QUEUE)    → traitement séquentiel de plusieurs URL.
 *   6. IMPORT LOCAL + APERÇU     → drag & drop, lecteur, métadonnées.
 *   7. CONVERSION IMAGE          → via <canvas> (PNG ↔ JPG ↔ WebP).
 *   8. HISTORIQUE                → persistance localStorage + rendu.
 *   9. INITIALISATION            → câblage des écouteurs d'événements.
 *
 * Principes : fonctions pures quand c'est possible, gestion d'erreurs
 * systématique (try/catch + états d'échec affichés), aucune donnée envoyée
 * en ligne. Les états de progression/erreur utilisent aria-live pour les
 * lecteurs d'écran.
 * =========================================================================== */

(() => {
  "use strict";

  /* ===========================================================================
   * 1. CONSTANTES & UTILITAIRES
   * ========================================================================= */

  // Extensions de médias que le navigateur peut télécharger directement.
  const MEDIA_EXTENSIONS = {
    mp4: "video", webm: "video", ogv: "video", mov: "video",
    mp3: "audio", wav: "audio", m4a: "audio", oga: "audio", ogg: "audio",
    gif: "image", jpg: "image", jpeg: "image", png: "image", webp: "image",
    svg: "image", avif: "image", bmp: "image",
    pdf: "document",
  };

  // Plateformes protégées : impossible de télécharger sans backend.
  const BLOCKED_PLATFORMS = [
    { host: "youtube.com",  nom: "YouTube" },
    { host: "youtu.be",     nom: "YouTube" },
    { host: "tiktok.com",   nom: "TikTok" },
    { host: "instagram.com",nom: "Instagram" },
    { host: "linkedin.com", nom: "LinkedIn" },
    { host: "facebook.com", nom: "Facebook" },
    { host: "fb.watch",     nom: "Facebook" },
    { host: "x.com",        nom: "X (Twitter)" },
    { host: "twitter.com",  nom: "X (Twitter)" },
  ];

  const STORAGE_KEYS = { theme: "mediagrab:theme", history: "mediagrab:history" };
  const HISTORY_MAX = 50;

  /** Sélecteur court. */
  const $ = (sel, root = document) => root.querySelector(sel);

  /**
   * Formate une taille en octets vers une chaîne lisible (Ko / Mo / Go).
   * Fonction pure.
   * @param {number} bytes
   * @returns {string}
   */
  function formatSize(bytes) {
    if (bytes == null || Number.isNaN(bytes)) return "—";
    if (bytes < 1024) return `${bytes} o`;
    const units = ["Ko", "Mo", "Go", "To"];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
  }

  /** Formate une durée en secondes vers mm:ss. Fonction pure. */
  function formatDuration(seconds) {
    if (seconds == null || !Number.isFinite(seconds)) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /** Formate une date ISO vers un affichage local court. Fonction pure. */
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  }

  /**
   * Déduit un nom de fichier propre depuis une URL.
   * Fonction pure.
   */
  function filenameFromUrl(url) {
    try {
      const u = new URL(url);
      let name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
      name = name.split("?")[0].split("#")[0];
      return name || "media";
    } catch { return "media"; }
  }

  /** Récupère l'extension (minuscule, sans point) d'un nom de fichier. Pure. */
  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  /** Émoji d'icône selon la grande famille de média. Pure. */
  function iconForKind(kind) {
    return { video: "🎬", audio: "🎵", image: "🖼️", document: "📄" }[kind] || "📦";
  }

  /** Annonce un message aux lecteurs d'écran (aria-live assertif). */
  function announce(message) {
    const el = $("#sr-announcer");
    if (el) { el.textContent = ""; requestAnimationFrame(() => { el.textContent = message; }); }
  }

  /**
   * Déclenche le téléchargement d'un Blob avec un nom donné.
   * Centralise createObjectURL + révocation pour éviter les fuites mémoire.
   */
  function saveBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "media";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révocation différée : laisse le temps au navigateur de démarrer le DL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  }

  /* ===========================================================================
   * 2. THÈME (sombre / clair) — persistant
   * ========================================================================= */
  const Theme = {
    /** Applique un thème et met à jour l'état du bouton. */
    apply(theme) {
      const t = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", t);
      const btn = $("#theme-toggle");
      if (btn) btn.setAttribute("aria-pressed", String(t === "light"));
    },
    /** Bascule et persiste le choix. */
    toggle() {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      this.apply(next);
      try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch { /* quota/refus */ }
      announce(`Thème ${next === "light" ? "clair" : "sombre"} activé`);
    },
    /** Restaure le thème (préférence enregistrée, sinon préférence système). */
    init() {
      let saved = null;
      try { saved = localStorage.getItem(STORAGE_KEYS.theme); } catch { /* ignore */ }
      if (saved) { this.apply(saved); return; }
      const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
      this.apply(prefersLight ? "light" : "dark");
    },
  };

  /* ===========================================================================
   * 3. DÉTECTION D'URL
   * ========================================================================= */

  /**
   * Valide une URL : doit être analysable et en HTTPS.
   * Retourne { ok, url?, error? }. Fonction pure.
   */
  function validateUrl(raw) {
    const value = (raw || "").trim();
    if (!value) return { ok: false, error: "Veuillez saisir une URL." };
    let u;
    try { u = new URL(value); }
    catch { return { ok: false, error: "URL invalide. Vérifiez le format." }; }
    if (u.protocol !== "https:") {
      return { ok: false, error: "Seul le protocole https:// est autorisé." };
    }
    return { ok: true, url: u };
  }

  /**
   * Détecte si l'URL cible une plateforme protégée (non téléchargeable).
   * Retourne l'objet plateforme ou null. Fonction pure.
   */
  function detectBlockedPlatform(url) {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_PLATFORMS.find(
      (p) => host === p.host || host.endsWith("." + p.host)
    ) || null;
  }

  /** Devine la famille de média à partir de l'extension d'URL. Pure. */
  function guessKindFromUrl(url) {
    return MEDIA_EXTENSIONS[extOf(url.pathname)] || null;
  }

  /* ===========================================================================
   * 4. TÉLÉCHARGEMENT PAR URL DIRECTE
   * ========================================================================= */

  // Références DOM (récupérées à l'init).
  const dom = {};

  /** Affiche/masque un encart (alert/status/progress). */
  function setHidden(el, hidden) { if (el) el.hidden = hidden; }

  /** Affiche un message dans la zone de statut URL. type: info|error|success. */
  function showUrlStatus(html, type = "info") {
    const box = dom.urlStatus;
    if (!box) return;
    box.className = `alert alert--${type === "error" ? "error" : "info"}`;
    box.querySelector(".alert-icon").textContent =
      type === "error" ? "⛔" : type === "success" ? "✅" : "ℹ️";
    dom.urlStatusBody.innerHTML = html;
    setHidden(box, false);
  }

  /** Affiche l'encart plateforme bloquée. */
  function showPlatformWarning(platform) {
    dom.platformWarningText.textContent =
      `Le téléchargement direct depuis ${platform.nom} n'est pas possible dans le ` +
      `navigateur (protection CORS et flux chiffrés). Un serveur backend dédié ` +
      `(type yt-dlp) est nécessaire. MediaGrab ne simulera jamais un faux téléchargement.`;
    setHidden(dom.platformWarning, false);
    announce(`${platform.nom} : téléchargement direct impossible dans le navigateur.`);
  }

  /** Met à jour la barre de progression. pct = 0..100, ou null = indéterminé. */
  function updateProgress(pct, label) {
    setHidden(dom.progressWrap, false);
    if (label) dom.progressName.textContent = label;
    if (pct == null) {
      dom.progressFill.classList.add("indeterminate");
      dom.progressPct.textContent = "…";
      dom.progressBar.removeAttribute("aria-valuenow");
      return;
    }
    dom.progressFill.classList.remove("indeterminate");
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    dom.progressFill.style.width = `${clamped}%`;
    dom.progressPct.textContent = `${clamped} %`;
    dom.progressBar.setAttribute("aria-valuenow", String(clamped));
  }

  /** Réinitialise et masque la progression. */
  function resetProgress() {
    setHidden(dom.progressWrap, true);
    dom.progressFill.classList.remove("indeterminate");
    dom.progressFill.style.width = "0%";
    dom.progressPct.textContent = "0 %";
  }

  /**
   * Télécharge une URL en lisant le flux pour une progression réelle.
   * Retourne un objet résultat pour l'historique/queue.
   * @param {URL} url
   * @param {(pct:number|null,label?:string)=>void} onProgress
   * @returns {Promise<{blob:Blob,filename:string,type:string,size:number}>}
   */
  async function downloadUrlToBlob(url, onProgress) {
    const filename = filenameFromUrl(url.href);
    // GET direct : la requête HEAD séparée est souvent bloquée par CORS,
    // on lit donc les en-têtes de la réponse GET elle-même.
    const response = await fetch(url.href, { method: "GET", mode: "cors", redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Le serveur a répondu ${response.status} ${response.statusText}.`);
    }

    const contentType = response.headers.get("Content-Type") || "";
    const lengthHeader = response.headers.get("Content-Length");
    const total = lengthHeader ? parseInt(lengthHeader, 10) : null;

    // Lecture en flux pour suivre la progression octet par octet.
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      onProgress(total ? 0 : null, filename);
      // Boucle de lecture du ReadableStream.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) onProgress((received / total) * 100, filename);
      }
      const blob = new Blob(chunks, contentType ? { type: contentType } : undefined);
      return { blob, filename, type: blob.type || contentType, size: blob.size };
    }

    // Repli : pas de streaming disponible → blob direct, progression indéterminée.
    onProgress(null, filename);
    const blob = await response.blob();
    return { blob, filename, type: blob.type || contentType, size: blob.size };
  }

  /**
   * Orchestration du téléchargement par URL (bouton « Récupérer »).
   * Gère validation, plateformes bloquées, CORS et historique.
   */
  async function handleUrlDownload(rawUrl) {
    // Réinitialise les encarts.
    setHidden(dom.platformWarning, true);
    setHidden(dom.urlStatus, true);
    resetProgress();

    // 3.1 Validation.
    const check = validateUrl(rawUrl);
    if (!check.ok) { showUrlStatus(check.error, "error"); return; }

    // 3.2 Plateforme protégée ?
    const blocked = detectBlockedPlatform(check.url);
    if (blocked) { showPlatformWarning(blocked); return; }

    // 3.3 Téléchargement réel.
    dom.urlFetchBtn.disabled = true;
    dom.urlFetchBtn.querySelector(".btn-label").textContent = "Téléchargement…";
    const kind = guessKindFromUrl(check.url);
    showUrlStatus(
      kind
        ? `Type détecté : <strong>${kind}</strong>. Récupération en cours…`
        : "Récupération en cours…",
      "info"
    );

    try {
      const result = await downloadUrlToBlob(check.url, updateProgress);
      saveBlob(result.blob, result.filename);
      updateProgress(100, result.filename);
      showUrlStatus(
        `Téléchargé : <strong>${result.filename}</strong> ` +
        `(${formatSize(result.size)}${result.type ? ", " + result.type : ""}).`,
        "success"
      );
      announce(`Téléchargement terminé : ${result.filename}`);
      History.add({
        url: check.url.href,
        name: result.filename,
        type: result.type || kind || "inconnu",
        size: result.size,
        kind: MEDIA_EXTENSIONS[extOf(result.filename)] || kind || "document",
      });
    } catch (err) {
      resetProgress();
      // Message pédagogique spécifique CORS / réseau.
      const isNetwork = err instanceof TypeError; // fetch échoue en TypeError si CORS/réseau.
      const openLink =
        `<a href="${check.url.href}" target="_blank" rel="noopener noreferrer">ouvrir dans un nouvel onglet</a>`;
      if (isNetwork) {
        showUrlStatus(
          `<strong>Le serveur distant bloque l'accès (CORS) ou est injoignable.</strong><br>` +
          `Ce n'est pas une erreur de votre part : le serveur qui héberge le fichier ` +
          `n'autorise pas son téléchargement par une autre origine.<br>` +
          `Solution de repli : ${openLink}, puis <em>clic droit → « Enregistrer sous »</em>.`,
          "error"
        );
      } else {
        showUrlStatus(
          `<strong>Échec du téléchargement.</strong> ${err.message}<br>` +
          `Vous pouvez essayer d'${openLink} manuellement.`,
          "error"
        );
      }
      announce("Échec du téléchargement.");
    } finally {
      dom.urlFetchBtn.disabled = false;
      dom.urlFetchBtn.querySelector(".btn-label").textContent = "Récupérer";
    }
  }

  /* ===========================================================================
   * 5. FILE D'ATTENTE (QUEUE)
   * ========================================================================= */
  const Queue = {
    items: [],   // { url, state: 'wait'|'run'|'done'|'err', li, badge }
    running: false,

    /** Construit la liste à partir du textarea (une URL par ligne). */
    build(text) {
      const lines = (text || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      this.items = lines.map((url) => ({ url, state: "wait" }));
      this.render();
      return this.items.length;
    },

    /** (Re)génère l'affichage de la file. */
    render() {
      const list = dom.queueList;
      list.innerHTML = "";
      const stateLabel = { wait: "En attente", run: "En cours", done: "Terminé", err: "Erreur" };
      this.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "queue-item";
        const url = document.createElement("span");
        url.className = "queue-url";
        url.textContent = item.url;
        url.title = item.url;
        const badge = document.createElement("span");
        badge.className = `queue-state queue-state--${item.state}`;
        badge.textContent = stateLabel[item.state];
        li.append(url, badge);
        list.appendChild(li);
        item.li = li; item.badge = badge;
      });
    },

    /** Met à jour l'état d'un élément et son badge. */
    setState(item, state) {
      item.state = state;
      const stateLabel = { wait: "En attente", run: "En cours", done: "Terminé", err: "Erreur" };
      if (item.badge) {
        item.badge.className = `queue-state queue-state--${state}`;
        item.badge.textContent = stateLabel[state];
      }
    },

    /** Traite la file séquentiellement. */
    async start() {
      if (this.running || this.items.length === 0) return;
      this.running = true;
      dom.queueStartBtn.disabled = true;
      for (const item of this.items) {
        if (item.state === "done") continue;
        this.setState(item, "run");
        announce(`File : téléchargement de ${filenameFromUrl(item.url)}`);
        try {
          const check = validateUrl(item.url);
          if (!check.ok) throw new Error(check.error);
          if (detectBlockedPlatform(check.url)) {
            throw new Error("Plateforme protégée (backend requis).");
          }
          const result = await downloadUrlToBlob(check.url, () => {});
          saveBlob(result.blob, result.filename);
          History.add({
            url: check.url.href, name: result.filename,
            type: result.type || "inconnu", size: result.size,
            kind: MEDIA_EXTENSIONS[extOf(result.filename)] || "document",
          });
          this.setState(item, "done");
        } catch {
          this.setState(item, "err");
        }
      }
      this.running = false;
      dom.queueStartBtn.disabled = false;
      announce("File d'attente terminée.");
    },

    /** Vide la file. */
    clear() {
      this.items = [];
      this.render();
      dom.queueInput.value = "";
    },
  };

  /* ===========================================================================
   * 6. IMPORT LOCAL + APERÇU
   * ========================================================================= */
  const Local = {
    file: null,     // File courant
    objectUrl: null,// URL objet du média affiché (à révoquer)

    /** Révoque proprement l'URL objet précédente. */
    revoke() {
      if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    },

    /** Prend en charge un fichier sélectionné / déposé. */
    load(file) {
      if (!file) return;
      this.revoke();
      this.file = file;
      this.objectUrl = URL.createObjectURL(file);
      this.renderPreview(file);
    },

    /** Construit l'aperçu (lecteur adapté) + métadonnées. */
    renderPreview(file) {
      const mediaBox = dom.previewMedia;
      const mime = file.type || "";
      const kind = mime.startsWith("video/") ? "video"
                 : mime.startsWith("audio/") ? "audio"
                 : mime.startsWith("image/") ? "image"
                 : mime === "application/pdf" ? "document"
                 : (MEDIA_EXTENSIONS[extOf(file.name)] || "document");

      mediaBox.innerHTML = "";
      let mediaEl = null;

      if (kind === "video") {
        mediaEl = document.createElement("video");
        mediaEl.controls = true; mediaEl.src = this.objectUrl; mediaEl.preload = "metadata";
      } else if (kind === "audio") {
        mediaEl = document.createElement("audio");
        mediaEl.controls = true; mediaEl.src = this.objectUrl; mediaEl.preload = "metadata";
      } else if (kind === "image") {
        mediaEl = document.createElement("img");
        mediaEl.src = this.objectUrl; mediaEl.alt = `Aperçu de ${file.name}`;
      } else {
        // PDF / autre : badge visuel (l'aperçu inline PDF varie selon navigateur).
        const badge = document.createElement("div");
        badge.className = "file-badge";
        badge.innerHTML = `<span>${iconForKind(kind)}</span>${file.name}`;
        mediaBox.appendChild(badge);
      }
      if (mediaEl) mediaBox.appendChild(mediaEl);

      // Métadonnées de base immédiates.
      const meta = {
        "Nom": file.name,
        "Taille": formatSize(file.size),
        "Type MIME": mime || "inconnu",
      };
      this.renderMeta(meta);

      // Champ de renommage pré-rempli (sans extension).
      dom.renameInput.value = file.name.replace(/\.[^.]+$/, "");

      // Panneau de conversion visible uniquement pour les images.
      setHidden(dom.convertPanel, kind !== "image");

      dom.previewFilename.textContent = file.name;
      setHidden(dom.previewPanel, false);
      dom.previewPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      announce(`Fichier importé : ${file.name}`);

      // Métadonnées avancées asynchrones (dimensions / durée).
      if (kind === "image" && mediaEl) {
        mediaEl.addEventListener("load", () => {
          meta["Dimensions"] = `${mediaEl.naturalWidth} × ${mediaEl.naturalHeight} px`;
          this.renderMeta(meta);
        }, { once: true });
      } else if ((kind === "video" || kind === "audio") && mediaEl) {
        mediaEl.addEventListener("loadedmetadata", () => {
          if (kind === "video" && mediaEl.videoWidth) {
            meta["Dimensions"] = `${mediaEl.videoWidth} × ${mediaEl.videoHeight} px`;
          }
          meta["Durée"] = formatDuration(mediaEl.duration);
          this.renderMeta(meta);
        }, { once: true });
      }
    },

    /** Rend le tableau de métadonnées (<dl>). */
    renderMeta(metaObj) {
      const dl = dom.previewMeta;
      dl.innerHTML = "";
      for (const [key, val] of Object.entries(metaObj)) {
        const dt = document.createElement("dt"); dt.textContent = key;
        const dd = document.createElement("dd"); dd.textContent = val;
        dl.append(dt, dd);
      }
    },

    /** Télécharge le fichier local (éventuellement renommé). */
    download() {
      if (!this.file) return;
      const base = (dom.renameInput.value || "").trim() || this.file.name.replace(/\.[^.]+$/, "");
      const ext = extOf(this.file.name);
      const filename = ext ? `${base}.${ext}` : base;
      saveBlob(this.file, filename);
      History.add({
        url: "(fichier local)", name: filename,
        type: this.file.type || "inconnu", size: this.file.size,
        kind: MEDIA_EXTENSIONS[extOf(filename)] || "document",
      });
      announce(`Téléchargement du fichier local : ${filename}`);
    },
  };

  /* ===========================================================================
   * 7. CONVERSION IMAGE (via <canvas>)
   * ========================================================================= */
  const Converter = {
    /**
     * Convertit l'image locale courante vers le format choisi et la télécharge.
     * Utilise <canvas>.toBlob(). Gère l'échec (format non supporté par le navigateur).
     */
    async convert() {
      if (!Local.file || !Local.objectUrl) return;
      const format = dom.convertFormat.value;             // ex. "image/webp"
      const quality = parseFloat(dom.convertQuality.value); // 0..1
      const extMap = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
      const outExt = extMap[format] || "img";

      try {
        // Charge l'image dans un élément détaché pour dessiner sur le canvas.
        const img = await this._loadImage(Local.objectUrl);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        // Fond blanc pour JPG (pas d'alpha) afin d'éviter un fond noir.
        if (format === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Format non pris en charge par ce navigateur."))),
            format,
            quality
          );
        });

        const base = (dom.renameInput.value || "image").trim() || "image";
        const filename = `${base}.${outExt}`;
        saveBlob(blob, filename);
        History.add({
          url: "(conversion locale)", name: filename,
          type: format, size: blob.size, kind: "image",
        });
        announce(`Image convertie et téléchargée : ${filename}`);
      } catch (err) {
        announce("Échec de la conversion.");
        // Affiche l'erreur dans la zone de statut URL (réutilisée comme zone globale).
        showUrlStatus(`<strong>Conversion impossible :</strong> ${err.message}`, "error");
      }
    },

    /** Charge une image depuis une URL objet. Retourne une Promise<HTMLImageElement>. */
    _loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Impossible de lire l'image."));
        img.src = src;
      });
    },
  };

  /* ===========================================================================
   * 8. HISTORIQUE (localStorage)
   * ========================================================================= */
  const History = {
    entries: [],

    /** Charge l'historique depuis localStorage (tolérant aux erreurs). */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.history);
        this.entries = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this.entries)) this.entries = [];
      } catch { this.entries = []; }
      this.render();
    },

    /** Persiste l'historique (tolérant au quota). */
    save() {
      try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(this.entries)); }
      catch { /* quota dépassé ou stockage refusé : on ignore silencieusement */ }
    },

    /** Ajoute une entrée en tête et rafraîchit l'affichage. */
    add(entry) {
      this.entries.unshift({ ...entry, date: new Date().toISOString() });
      if (this.entries.length > HISTORY_MAX) this.entries.length = HISTORY_MAX;
      this.save();
      this.render();
    },

    /** Supprime une entrée par index. */
    remove(index) {
      this.entries.splice(index, 1);
      this.save();
      this.render();
    },

    /** Vide tout l'historique. */
    clear() {
      this.entries = [];
      this.save();
      this.render();
      announce("Historique vidé.");
    },

    /** Rend la liste de l'historique. */
    render() {
      const list = dom.historyList;
      list.innerHTML = "";
      setHidden(dom.historyEmpty, this.entries.length > 0);

      this.entries.forEach((entry, index) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const thumb = document.createElement("div");
        thumb.className = "history-thumb";
        thumb.textContent = iconForKind(entry.kind);

        const info = document.createElement("div");
        info.className = "history-info";
        const name = document.createElement("div");
        name.className = "history-name"; name.textContent = entry.name; name.title = entry.name;
        const sub = document.createElement("div");
        sub.className = "history-sub";
        sub.textContent = `${formatSize(entry.size)} · ${entry.type} · ${formatDate(entry.date)}`;
        info.append(name, sub);

        const actions = document.createElement("div");
        actions.className = "history-actions";

        // Re-télécharger : possible uniquement pour les vraies URL distantes.
        const isRemote = /^https?:\/\//i.test(entry.url || "");
        if (isRemote) {
          const redl = document.createElement("button");
          redl.type = "button";
          redl.className = "icon-btn";
          redl.title = "Re-télécharger"; redl.setAttribute("aria-label", `Re-télécharger ${entry.name}`);
          redl.textContent = "⬇️";
          redl.addEventListener("click", () => handleUrlDownload(entry.url));
          actions.appendChild(redl);
        }

        const del = document.createElement("button");
        del.type = "button";
        del.className = "icon-btn icon-btn--danger";
        del.title = "Supprimer"; del.setAttribute("aria-label", `Supprimer ${entry.name} de l'historique`);
        del.textContent = "🗑️";
        del.addEventListener("click", () => this.remove(index));
        actions.appendChild(del);

        li.append(thumb, info, actions);
        list.appendChild(li);
      });
    },
  };

  /* ===========================================================================
   * 9. INITIALISATION — câblage des écouteurs
   * ========================================================================= */
  function cacheDom() {
    Object.assign(dom, {
      // URL
      urlForm: $("#url-form"),
      urlInput: $("#url-input"),
      urlFetchBtn: $("#url-fetch-btn"),
      platformWarning: $("#platform-warning"),
      platformWarningText: $("#platform-warning-text"),
      urlStatus: $("#url-status"),
      urlStatusBody: $("#url-status-body"),
      progressWrap: $("#url-progress-wrap"),
      progressName: $("#url-progress-name"),
      progressPct: $("#url-progress-pct"),
      progressBar: $("#url-progressbar"),
      progressFill: $("#url-progress-fill"),
      // Queue
      queueInput: $("#queue-input"),
      queueStartBtn: $("#queue-start-btn"),
      queueClearBtn: $("#queue-clear-btn"),
      queueList: $("#queue-list"),
      // Local
      dropzone: $("#dropzone"),
      fileInput: $("#file-input"),
      previewPanel: $("#preview-panel"),
      previewMedia: $("#preview-media"),
      previewFilename: $("#preview-filename"),
      previewMeta: $("#preview-meta"),
      renameInput: $("#rename-input"),
      downloadLocalBtn: $("#download-local-btn"),
      convertPanel: $("#convert-panel"),
      convertFormat: $("#convert-format"),
      convertQuality: $("#convert-quality"),
      qualityValue: $("#quality-value"),
      convertBtn: $("#convert-btn"),
      // History
      historyList: $("#history-list"),
      historyEmpty: $("#history-empty"),
      historyClearBtn: $("#history-clear-btn"),
      // Theme
      themeToggle: $("#theme-toggle"),
    });
  }

  function bindEvents() {
    // Thème
    dom.themeToggle.addEventListener("click", () => Theme.toggle());

    // Téléchargement par URL
    dom.urlForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleUrlDownload(dom.urlInput.value);
    });
    // Feedback en direct : détecte une plateforme bloquée dès la saisie.
    dom.urlInput.addEventListener("input", () => {
      const check = validateUrl(dom.urlInput.value);
      if (check.ok) {
        const blocked = detectBlockedPlatform(check.url);
        if (blocked) { showPlatformWarning(blocked); return; }
      }
      setHidden(dom.platformWarning, true);
    });

    // File d'attente
    dom.queueStartBtn.addEventListener("click", () => {
      const n = Queue.build(dom.queueInput.value);
      if (n === 0) { announce("Aucune URL à traiter."); return; }
      Queue.start();
    });
    dom.queueClearBtn.addEventListener("click", () => Queue.clear());

    // Import local — sélecteur
    dom.dropzone.addEventListener("click", () => dom.fileInput.click());
    dom.dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dom.fileInput.click(); }
    });
    dom.fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) Local.load(file);
    });

    // Import local — drag & drop
    ["dragenter", "dragover"].forEach((evt) =>
      dom.dropzone.addEventListener(evt, (e) => {
        e.preventDefault(); dom.dropzone.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dom.dropzone.addEventListener(evt, (e) => {
        e.preventDefault(); dom.dropzone.classList.remove("is-dragover");
      })
    );
    dom.dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) Local.load(file);
    });

    // Aperçu : téléchargement + conversion
    dom.downloadLocalBtn.addEventListener("click", () => Local.download());
    dom.convertBtn.addEventListener("click", () => Converter.convert());
    dom.convertQuality.addEventListener("input", () => {
      dom.qualityValue.textContent = parseFloat(dom.convertQuality.value).toFixed(2);
    });

    // Historique
    dom.historyClearBtn.addEventListener("click", () => {
      if (History.entries.length && confirm("Vider tout l'historique ?")) History.clear();
    });
  }

  /** Point d'entrée. */
  function init() {
    cacheDom();
    Theme.init();
    History.load();
    bindEvents();
  }

  // Démarre quand le DOM est prêt.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
