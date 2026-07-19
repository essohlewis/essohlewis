/**
 * db.js — Stockage simple (fichier JSON + images sur disque) pour les
 * vérifications KYC. Pas de dépendance native ; suffisant pour ce back-office.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "kyc.json");

function ensure() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");
}
function all() { ensure(); try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) || []; } catch (e) { return []; } }
function saveAll(rows) { ensure(); fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2)); }
function uid(p) { return (p || "kyc") + "_" + crypto.randomBytes(6).toString("hex"); }

/** Décode une data-URL/base64 → { ext, buffer } ou null. */
function decodeImage(dataUrl, maxBytes) {
  if (!dataUrl) return null;
  let s = String(dataUrl).trim(), ext = "jpg";
  const m = /^data:image\/(\w+);base64,/i.exec(s);
  if (m) { ext = m[1].toLowerCase() === "png" ? "png" : "jpg"; s = s.slice(s.indexOf(",") + 1); }
  const buf = Buffer.from(s, "base64");
  if (!buf.length || (maxBytes && buf.length > maxBytes)) return null;
  return { ext, buffer: buf };
}
function saveImage(dataUrl, prefix, maxBytes) {
  const img = decodeImage(dataUrl, maxBytes);
  if (!img) return null;
  const name = `${prefix}_${crypto.randomBytes(6).toString("hex")}.${img.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), img.buffer);
  return name;
}
function imagePath(name) { return path.join(UPLOAD_DIR, name); }
function removeImage(name) { if (name) { try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch (e) {} } }

module.exports = { DATA_DIR, UPLOAD_DIR, all, saveAll, uid, saveImage, imagePath, removeImage };
