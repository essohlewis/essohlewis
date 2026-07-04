const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Dossier de stockage des fichiers (hors du dossier public : les fichiers ne
// sont jamais servis en statique, uniquement via une route authentifiée).
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Nom de fichier aléatoire : évite les collisions et le path traversal via
  // le nom d'origine (qui n'est conservé qu'en base, pour l'affichage).
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 }
});

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE };
