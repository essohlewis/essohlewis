#!/usr/bin/env node
/* Conteo — Générateur de codes d'activation (OUTIL HORS-LIGNE, hors application).
 *
 * ⚠️ Ne jamais embarquer ce script ni la clé dans le build public : il sert à
 * produire des lots de codes vendus physiquement. La MÊME clé (HMAC symétrique)
 * vérifie les codes côté client (assets/js/billing/codes.js). Faire tourner la
 * clé à chaque version limite la portée d'une fuite (§8).
 *
 * Usage :
 *   node tools/generate-codes.js <PACK> <quantité> [--key <clé>] [--start <n>] [--out <fichier.csv>]
 * Exemple :
 *   node tools/generate-codes.js SAGE 100 --start 1 --out codes-sagesse.csv
 */

const crypto = require('crypto');
const fs = require('fs');

// DOIT correspondre à assets/js/billing/codes.js
const DEFAULT_KEY = 'conteo-2026-07-key-rotate-me';
const PACK_CODES = {
  SAGE: 'pack-sagesse',
  ANIM: 'pack-animaux',
  HERO: 'pack-heros'
};

function expectedSig(key, packId, serialHex) {
  const h = crypto.createHmac('sha256', key)
    .update(`${packId}:${serialHex.toUpperCase()}`)
    .digest('hex').toUpperCase();
  return h.slice(0, 4);
}

function makeCode(key, packShort, serialNum) {
  const packId = PACK_CODES[packShort];
  if (!packId) throw new Error(`Pack inconnu : ${packShort}. Connus : ${Object.keys(PACK_CODES).join(', ')}`);
  const serial = serialNum.toString(16).toUpperCase().padStart(4, '0');
  if (serial.length > 4) throw new Error('Numéro de série hors limite (max 0xFFFF = 65535).');
  const sig = expectedSig(key, packId, serial);
  return `CONT-${packShort}-${serial}-${sig}`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage : node tools/generate-codes.js <PACK> <quantité> [--key <clé>] [--start <n>] [--out <fichier.csv>]');
    console.log('Packs :', Object.keys(PACK_CODES).join(', '));
    process.exit(1);
  }
  const packShort = args[0].toUpperCase();
  const qty = parseInt(args[1], 10);
  const getOpt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
  };
  const key = getOpt('--key', DEFAULT_KEY);
  const start = parseInt(getOpt('--start', '1'), 10);
  const out = getOpt('--out', null);

  const rows = [];
  for (let i = 0; i < qty; i++) {
    const serialNum = start + i;
    rows.push({ serial: serialNum, code: makeCode(key, packShort, serialNum) });
  }

  if (out) {
    const csv = 'serial,code\n' + rows.map((r) => `${r.serial},${r.code}`).join('\n') + '\n';
    fs.writeFileSync(out, csv);
    console.log(`✓ ${qty} codes écrits dans ${out}`);
  } else {
    rows.forEach((r) => console.log(r.code));
  }
  console.warn(`\n(Clé utilisée : "${key}" — garde-la secrète et fais-la tourner à chaque version.)`);
}

main();
