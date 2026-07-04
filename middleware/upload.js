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
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const logger = require('../utils/logger');
    if (file.size && file.size > MAX_FILE_SIZE) {
      logger.warn(`File size ${file.size} exceeds limit ${MAX_FILE_SIZE} for user ${req.userId}`);
      return cb(new Error(`File size exceeds maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`));
    }
    cb(null, true);
  }
});

// Error handling middleware for multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const logger = require('../utils/logger');
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.warn(`Upload rejected: file too large (${err.limit} bytes limit), user ${req.userId}`);
      return res.status(413).json({ message: `File size exceeds maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Only one file can be uploaded at a time' });
    }
    logger.error(`Multer error: ${err.code} - ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    const logger = require('../utils/logger');
    logger.error(`Upload error: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE, handleUploadError };
