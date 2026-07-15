# 🎬 MediaGrab CI

> Plateforme web de téléchargement de vidéos multi-réseaux — **gratuite, rapide, mobile-first** — pensée pour la Côte d'Ivoire et l'Afrique de l'Ouest francophone.

MediaGrab CI permet de coller l'URL d'une vidéo (**YouTube, TikTok, Instagram, Facebook, X/Twitter, Vimeo, Dailymotion**, et des centaines d'autres) et de la télécharger dans le **format et la qualité de son choix** (MP4 1080p→360p, ou audio MP3/M4A).

- **Front-end** : HTML5 / CSS3 / JavaScript vanilla (aucun framework), landing page complète + outil intégré.
- **Back-end** : micro-serveur **Node.js / Express** minimal, dont le rôle unique est l'extraction et le **relais du flux vidéo en streaming** (le navigateur ne peut pas le faire seul à cause de CORS).
- **Aucune base de données. Aucune dépendance payante. Aucun stockage de fichier.** Le serveur est *stateless*.

---

## 📸 Aperçu

- Landing page one-page moderne (glassmorphism, mode sombre/clair, animations douces).
- Outil de téléchargement placé directement dans le héro : champ URL → **Analyser** → choix du format → **Télécharger**.
- Détection automatique de la plateforme (logo instantané), barre de progression, historique de session (`localStorage`), gestion d'erreurs claire en français.
- 100 % responsive, **mobile-first** (optimisé pour smartphones Android sur connexion variable).

---

## 🗂️ Structure du projet

```
mediagrab-ci/
├── server/                    # Micro-back-end Node/Express
│   ├── server.js              # Point d'entrée + service des fichiers statiques
│   ├── routes/
│   │   ├── info.js            # POST /api/info    → métadonnées + formats
│   │   └── download.js        # POST|GET /api/download → streaming du média
│   ├── services/
│   │   └── extractor.js       # Wrapper yt-dlp (métadonnées + flux)
│   ├── middleware/
│   │   ├── validateUrl.js     # Validation stricte + whitelist de domaines
│   │   └── rateLimiter.js     # Rate-limiting (express-rate-limit)
│   ├── .env.example
│   └── package.json
├── public/                    # Front-end statique
│   ├── index.html
│   ├── css/
│   │   ├── variables.css      # Design tokens (thème clair/sombre)
│   │   ├── main.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── app.js             # Logique principale
│   │   ├── api.js             # Appels fetch
│   │   ├── ui.js             # Rendu dynamique
│   │   └── history.js         # Historique localStorage
│   └── assets/                # Logo + favicon SVG
└── README.md
```

---

## ✅ Prérequis

1. **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
2. **yt-dlp** — moteur d'extraction.
   Le paquet `youtube-dl-exec` télécharge automatiquement un binaire yt-dlp à l'installation.
   Si vous préférez utiliser un binaire système (recommandé en production), installez-le :
   ```bash
   # Linux / macOS (via pip)
   python3 -m pip install -U yt-dlp
   # ou via le binaire officiel
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```
   puis renseignez `YTDLP_PATH` dans votre `.env` (voir ci-dessous).
3. **FFmpeg** — nécessaire pour fusionner vidéo+audio et convertir l'audio en MP3 :
   ```bash
   # Debian/Ubuntu
   sudo apt install ffmpeg
   # macOS (Homebrew)
   brew install ffmpeg
   ```

---

## 🚀 Installation & lancement

```bash
# 1. Se placer dans le dossier serveur
cd mediagrab-ci/server

# 2. Installer les dépendances (télécharge aussi le binaire yt-dlp)
npm install

# 3. (Optionnel) Copier et adapter la configuration
cp .env.example .env

# 4. Démarrer le serveur
npm start
```

Le serveur sert **à la fois l'API et le front-end**. Ouvrez ensuite :

```
http://localhost:3000
```

Pour le développement avec rechargement automatique :

```bash
npm run dev
```

---

## ⚙️ Variables d'environnement

Toutes optionnelles (des valeurs par défaut raisonnables sont fournies). Voir `server/.env.example`.

| Variable            | Défaut        | Description                                              |
|---------------------|---------------|---------------------------------------------------------|
| `PORT`              | `3000`        | Port d'écoute du serveur.                                |
| `NODE_ENV`          | `development` | `production` active la mise en cache des assets.         |
| `CORS_ORIGIN`       | `*`           | Origine autorisée pour CORS (ex : `https://mediagrab.ci`). |
| `YTDLP_PATH`        | *(vide)*      | Chemin vers un binaire yt-dlp personnalisé.              |
| `EXTRACT_TIMEOUT`   | `25000`       | Délai max d'extraction des métadonnées (ms).            |
| `DOWNLOAD_TIMEOUT`  | `300000`      | Délai max d'un téléchargement (ms).                     |
| `RATE_WINDOW_MS`    | `60000`       | Fenêtre du rate-limiting (ms).                          |
| `RATE_INFO_MAX`     | `20`          | Nb max d'analyses par fenêtre / IP.                     |
| `RATE_DOWNLOAD_MAX` | `8`           | Nb max de téléchargements par fenêtre / IP.             |

---

## 🔌 API

### `POST /api/info`
Analyse une URL et renvoie les métadonnées + formats disponibles.

**Requête**
```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

**Réponse (200)**
```json
{
  "success": true,
  "data": {
    "title": "...",
    "author": "...",
    "thumbnail": "https://...",
    "durationLabel": "3:42",
    "platform": "youtube",
    "formats": {
      "video": [{ "formatId": "...", "label": "1080p", "ext": "mp4", "filesizeLabel": "42.1 Mo" }],
      "audio": [{ "formatId": "audio-mp3", "label": "Audio MP3", "ext": "mp3" }]
    }
  }
}
```

### `POST /api/download` (ou `GET /api/download?url=...&formatId=...`)
Relaie le flux du média choisi vers le client (`Content-Disposition: attachment`). **Rien n'est stocké sur le serveur.**

**Paramètres** : `url`, `formatId`, `title` (optionnel), `sourceFormatId` (pour l'audio).

### `GET /api/health`
Point de santé pour le monitoring : `{ "status": "ok" }`.

---

## 🔒 Sécurité

- **Validation stricte des URL** : format http(s), whitelist de domaines, protection anti-SSRF (rejet des hôtes internes / IP privées), filtrage des métacaractères shell.
- **Rate-limiting** distinct pour l'analyse et le téléchargement (`express-rate-limit`).
- **Helmet** (en-têtes de sécurité + CSP), **CORS** configurable, corps de requête borné.
- **Timeouts** sur l'extraction et le téléchargement ; le process yt-dlp est tué si le client se déconnecte.
- Aucune donnée personnelle, aucun fichier conservé : le serveur est *stateless*.

---

## ⚠️ Avertissement légal

Le téléchargement de vidéos depuis certaines plateformes (**notamment YouTube**) peut enfreindre leurs **conditions d'utilisation**. MediaGrab CI est un **outil technique** : il appartient à l'utilisateur final de **ne télécharger que du contenu dont il détient les droits ou qui est libre de droits**, et de respecter le **droit d'auteur** ainsi que les **CGU** des plateformes concernées.

**L'usage de cet outil relève de la seule responsabilité de l'utilisateur.** Les auteurs du projet déclinent toute responsabilité quant à un usage non conforme.

---

## 📄 Licence

MIT — libre d'utilisation, de modification et de distribution, sans garantie.

---

*Conçu avec ❤️ en Côte d'Ivoire.*
