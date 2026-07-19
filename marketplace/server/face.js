/**
 * face.js — Reconnaissance faciale pour le backend Node.
 * Délègue la comparaison biométrique au helper Python (dlib / face_recognition),
 * lequel s'appuie sur des modèles fournis par PyPI. Repli propre : si Python ou
 * la librairie manque, renvoie { available:false } et la décision revient à
 * l'administrateur.
 */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PYTHON = process.env.PYTHON_BIN || "python3";
const SCRIPT = path.join(__dirname, "face_match.py");

/** Écrit une data-URL/base64 dans un fichier temporaire ; renvoie le chemin. */
function writeTemp(dataUrl, prefix) {
  let s = String(dataUrl || "").trim();
  let ext = "jpg";
  const m = /^data:image\/(\w+);base64,/i.exec(s);
  if (m) { ext = m[1].toLowerCase() === "png" ? "png" : "jpg"; s = s.slice(s.indexOf(",") + 1); }
  const buf = Buffer.from(s, "base64");
  const p = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(p, buf);
  return p;
}

/**
 * Compare la pièce et le selfie. Résout avec l'objet du helper Python
 * { match, score, distance, faces } ou { available:false } si indisponible.
 */
function compare(idImage, selfie) {
  return new Promise((resolve) => {
    let a, b;
    try { a = writeTemp(idImage, "id"); b = writeTemp(selfie, "self"); }
    catch (e) { return resolve({ available: false, error: "bad_image" }); }

    let out = "", err = "";
    let child;
    try { child = spawn(PYTHON, [SCRIPT, a, b], { timeout: 30000 }); }
    catch (e) { cleanup(); return resolve({ available: false, error: "spawn_failed" }); }

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", () => { cleanup(); resolve({ available: false, error: "python_missing" }); });
    child.on("close", (code) => {
      cleanup();
      if (code !== 0 && !out) return resolve({ available: false, error: err.slice(0, 200) || "exit_" + code });
      try {
        const j = JSON.parse(out.trim());
        if (j.error && j.error.startsWith("internal:")) return resolve({ available: false, error: j.error });
        resolve(Object.assign({ available: true }, j));
      } catch (e) { resolve({ available: false, error: "bad_output" }); }
    });

    function cleanup() { try { fs.unlinkSync(a); } catch (e) {} try { fs.unlinkSync(b); } catch (e) {} }
  });
}

/** Teste si le service de reconnaissance faciale est opérationnel. */
async function selfTest() {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(PYTHON, ["-c", "import face_recognition"], { timeout: 15000 }); }
    catch (e) { return resolve(false); }
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

module.exports = { compare, selfTest };
