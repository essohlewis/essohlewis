/* Conteo — Test de fumée navigateur (parcours complet).
 *
 * Auto-suffisant : démarre un petit serveur statique (node:http, sans
 * dépendance) servant la racine du projet, puis pilote Chromium via Playwright.
 *
 * Prérequis : Playwright installé en devDependency.
 * Exécution : node tests/smoke.mjs   (ou npm run test:e2e)
 * Variable optionnelle : PW_CHROMIUM=/chemin/chromium pour un binaire précis.
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5199);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, path.normalize(rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
  }
});

async function main() {
  const { chromium } = await import('playwright');
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://localhost:${PORT}`;

  const errors = [];
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 412, height: 850 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text());
  });

  const steps = [];
  const step = async (name, fn) => {
    try { await fn(); steps.push('ok  ' + name); console.log('✓', name); }
    catch (e) { const msg = e.message.split('\n')[0]; steps.push('FAIL ' + name); errors.push(name + ': ' + msg); console.log('✗', name, '::', msg); }
  };

  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });

  await step('écran d’accueil affiché', () => page.waitForSelector('.splash', { timeout: 5000 }));

  await step('accueil → espace parent (aucun profil)', async () => {
    await page.click('.splash');
    await page.waitForSelector('.gate, .parent-body, .profile-grid', { timeout: 5000 });
  });

  await step('résoudre le verrou arithmétique', async () => {
    if (await page.$('.gate')) {
      const q = await page.textContent('.gate__q');
      const m = q.match(/(\d+)\s*×\s*(\d+)/);
      const ans = String(Number(m[1]) * Number(m[2]));
      await page.click('.gate__pad button >> text="C"');
      for (const c of ans) await page.click(`.gate__pad button >> text="${c}"`);
      await page.click('.gate__pad button >> text="OK"');
    }
    await page.waitForSelector('.parent-body', { timeout: 5000 });
  });

  await step('créer un profil enfant', async () => {
    await page.click('button.btn.btn--block');
    await page.waitForSelector('.modal');
    await page.fill('.modal input[type=text]', 'Awa');
    await page.getByRole('button', { name: 'Créer', exact: true }).click();
    await page.waitForSelector('.pitem', { timeout: 5000 });
  });

  await step('choisir le profil', async () => {
    await page.click('.appbar .icon-btn >> text="🏠"');
    await page.waitForSelector('.profile-card', { timeout: 5000 });
    await page.click('.profile-card:not(.profile-card--add)');
    await page.waitForSelector('.library-grid', { timeout: 5000 });
  });

  await step('bibliothèque : contes filtrés par niveau', async () => {
    const n = await page.$$eval('.tale-card', (els) => els.length);
    if (n < 1) throw new Error('aucune vignette de conte');
  });

  await step('ouvrir le lecteur', async () => {
    await page.click('.tale-card:not(.tale-card--locked)');
    await page.waitForSelector('.reader', { timeout: 5000 });
  });

  await step('karaoké : mots surlignables présents', async () => {
    await page.waitForTimeout(300);
    const kw = await page.$$eval('.reader__caption .kw', (els) => els.length);
    if (kw < 1) throw new Error('aucun mot karaoké rendu');
  });

  await step('lecture : la narration démarre et surligne les mots', async () => {
    // Sans fichier audio (servi par CDN), la narration bascule sur la synthèse
    // vocale ; le surlignage karaoké doit progresser à l'appui sur « Écouter ».
    await page.waitForTimeout(400);   // laisse l'audio 404 basculer en repli
    await page.click('.reader__bar .icon-btn--play');
    await page.waitForTimeout(900);
    const lit = await page.$$eval('.reader__caption .kw--active, .reader__caption .kw--read', (els) => els.length);
    const icon = await page.textContent('.reader__bar .icon-btn--play');
    if (lit < 1) throw new Error('aucun mot surligné après lecture');
    if (icon !== '⏸️') throw new Error('le bouton ne passe pas en pause');
    await page.click('.reader__bar .icon-btn--play');   // pause pour la suite
  });

  await step('navigation page suivante', async () => {
    await page.click('.reader__bar .icon-btn[aria-label="Suivant"]');
    await page.waitForTimeout(200);
  });

  await browser.close();
  await new Promise((r) => server.close(r));

  console.log('\nRésultat :', steps.filter((s) => s.startsWith('ok')).length, '/', steps.length, 'étapes OK');
  if (errors.length) { console.error('\nErreurs :\n' + errors.map((e) => ' - ' + e).join('\n')); process.exit(1); }
  console.log('✅ Parcours complet validé.');
  process.exit(0);
}

main().catch((e) => { console.error(e); server.close(); process.exit(1); });
