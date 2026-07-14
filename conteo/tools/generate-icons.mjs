/* Conteo — Génère les icônes PNG du manifest PWA depuis favicon.svg.
 * Utilise Chromium (Playwright) pour rasteriser — aucune dépendance native.
 *
 * Exécution : node tools/generate-icons.mjs   (ou npm run icons)
 * Variable optionnelle : PW_CHROMIUM=/chemin/chromium
 *
 * Produit : 192.png, 512.png (fond transparent) et 512-mask.png
 * (maskable : fond plein + icône à 78% pour respecter la zone de sécurité). */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons');

const { chromium } = await import('playwright');
const svg = await readFile(path.join(ICONS, 'favicon.svg'), 'utf8');
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);

async function render(size, { maskable = false } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = maskable ? 78 : 100;
  const html = `<!doctype html><meta charset=utf8>
    <style>html,body{margin:0;width:${size}px;height:${size}px}
    .wrap{width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? '#F2A73B' : 'transparent'}}
    .ico{width:${inner}%;height:${inner}%}</style>
    <div class="wrap"><div class="ico">${svg}</div></div>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buf = await page.screenshot({ omitBackground: !maskable });
  await page.close();
  return buf;
}

await writeFile(path.join(ICONS, '192.png'), await render(192));
await writeFile(path.join(ICONS, '512.png'), await render(512));
await writeFile(path.join(ICONS, '512-mask.png'), await render(512, { maskable: true }));
await browser.close();
console.log('✓ Icônes générées : 192.png, 512.png, 512-mask.png');
