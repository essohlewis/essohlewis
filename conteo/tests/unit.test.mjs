/* Conteo — Tests unitaires des fonctions pures (aucun navigateur requis).
 * Exécution : node --test tests/  (ou npm test)
 * Utilise le lanceur intégré de Node (node:test), zéro dépendance. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ageInYears, levelForAge, resolveLevel, levelLabel } from '../assets/js/content/level.js';
import { fcfa, duration, minutes, bytes, isoDate, shortDay } from '../assets/js/utils/format.js';
import { binarySearch } from '../assets/js/audio/narrator.js';
import { verifyCode, expectedSig, PACK_CODES } from '../assets/js/billing/codes.js';

/* ---------- level.js ---------- */
test('ageInYears : anniversaire déjà passé / à venir dans l’année', () => {
  const now = new Date('2026-07-14T00:00:00Z');
  assert.equal(ageInYears(2020, 3, now), 6);   // né en mars → 6 ans révolus
  assert.equal(ageInYears(2020, 10, now), 5);  // né en octobre → pas encore 6
});

test('levelForAge : bornes N1/N2/N3', () => {
  assert.equal(levelForAge(2), 'N1');
  assert.equal(levelForAge(3), 'N1');
  assert.equal(levelForAge(4), 'N2');
  assert.equal(levelForAge(5), 'N2');
  assert.equal(levelForAge(6), 'N3');
  assert.equal(levelForAge(7), 'N3');
});

test('resolveLevel : le verrouillage parent surcharge le calcul', () => {
  const now = new Date('2026-07-14T00:00:00Z');
  const auto = { birth_year: 2022, birth_month: 1 };            // ~4 ans → N2
  assert.equal(resolveLevel(auto, now), 'N2');
  const locked = { birth_year: 2022, birth_month: 1, level_locked: true, reading_level: 'N3' };
  assert.equal(resolveLevel(locked, now), 'N3');               // forcé
});

test('levelLabel : libellés français', () => {
  assert.equal(levelLabel('N1'), 'Découverte');
  assert.equal(levelLabel('N2'), 'Éveil');
  assert.equal(levelLabel('N3'), 'Autonomie');
});

/* ---------- format.js ---------- */
test('fcfa : gratuit et milliers séparés', () => {
  assert.equal(fcfa(0), 'Gratuit');
  assert.equal(fcfa(2000), '2 000 FCFA');   // espace fine insécable (fr-FR)
});

test('duration : secondes / minutes', () => {
  assert.equal(duration(45), '45 s');
  assert.equal(duration(60), '1 min');
  assert.equal(duration(90), '1 min 30');
});

test('minutes / bytes / isoDate / shortDay', () => {
  assert.equal(minutes(150), 3);   // arrondi
  assert.equal(bytes(0), '0 Mo');
  assert.match(bytes(5 * 1024 * 1024), /Mo$/);
  assert.match(isoDate(new Date('2026-07-14T10:00:00Z')), /^2026-07-14$/);
  assert.equal(shortDay('2026-07-14'), 'mar');   // 14 juillet 2026 = mardi
});

/* ---------- narrator.js : recherche dichotomique ---------- */
test('binarySearch : plus grand index tel que s <= t', () => {
  const words = [
    { w: 'a', s: 0.0 }, { w: 'b', s: 1.0 }, { w: 'c', s: 2.0 }, { w: 'd', s: 3.0 }
  ];
  assert.equal(binarySearch(words, -1), 0);   // avant tout → premier
  assert.equal(binarySearch(words, 0.5), 0);
  assert.equal(binarySearch(words, 1.0), 1);  // borne exacte incluse
  assert.equal(binarySearch(words, 2.9), 2);
  assert.equal(binarySearch(words, 99), 3);   // après tout → dernier
});

test('binarySearch : cohérent avec une recherche linéaire (fuzz)', () => {
  const words = Array.from({ length: 500 }, (_, i) => ({ w: 'x', s: i * 0.37 }));
  const linear = (t) => { let r = 0; for (let i = 0; i < words.length; i++) if (words[i].s <= t) r = i; return r; };
  for (let k = 0; k < 200; k++) {
    const t = Math.random() * 200 - 5;
    assert.equal(binarySearch(words, t), linear(t));
  }
});

/* ---------- codes.js : vérification HMAC ---------- */
test('verifyCode : rejette un mauvais format', async () => {
  assert.equal((await verifyCode('n’importe quoi')).valid, false);
  assert.equal((await verifyCode('CONT-SAGE-XXXX-9B71')).reason, 'format'); // X non hexa
});

test('verifyCode : rejette un pack inconnu', async () => {
  // Signature valide mais code pack inexistant → reason 'pack'
  const res = await verifyCode('CONT-ZZZZ-0001-0000');
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'pack');
});

test('verifyCode : accepte un code correctement signé', async () => {
  const serial = '002A';
  const sig = await expectedSig('pack-sagesse', serial);
  const code = `CONT-SAGE-${serial}-${sig}`;
  const res = await verifyCode(code);
  assert.equal(res.valid, true);
  assert.equal(res.pack_id, 'pack-sagesse');
  assert.equal(res.serial, serial);
});

test('verifyCode : rejette une signature falsifiée', async () => {
  const serial = '002A';
  const sig = await expectedSig('pack-sagesse', serial);
  // Inverse un chiffre de la signature.
  const bad = (parseInt(sig[0], 16) ^ 0x1).toString(16).toUpperCase() + sig.slice(1);
  const res = await verifyCode(`CONT-SAGE-${serial}-${bad}`);
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'signature');
});

test('PACK_CODES : mapping cohérent', () => {
  assert.equal(PACK_CODES.SAGE, 'pack-sagesse');
});
