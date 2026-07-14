/* Conteo — Graphiques dessinés à la main en Canvas 2D (aucune bibliothèque).
 * barChart : temps d'écran par jour. Rendu net sur écrans haute densité. */

export function barChart(data, { labels, unit = '', height = 180, color = '#2E7D5B', max } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Graphique : ' + data.map((v, i) => `${labels[i]} ${v}${unit}`).join(', '));

  const draw = () => {
    const cssW = canvas.clientWidth || 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = height * dpr;
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, height);

    const pad = { l: 8, r: 8, t: 12, b: 24 };
    const w = cssW - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    const peak = max || Math.max(1, ...data);
    const n = data.length;
    const gap = 10;
    const bw = Math.max(6, (w - gap * (n - 1)) / n);

    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue('--text-muted').trim() || '#6E675E';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';

    data.forEach((v, i) => {
      const x = pad.l + i * (bw + gap);
      const bh = (v / peak) * h;
      const y = pad.t + h - bh;
      // barre arrondie
      roundRect(ctx, x, y, bw, bh, 6);
      ctx.fillStyle = color;
      ctx.fill();
      // valeur
      if (v > 0) {
        ctx.fillStyle = ink;
        ctx.fillText(String(v), x + bw / 2, y - 4);
      }
      // label
      ctx.fillStyle = ink;
      ctx.fillText(labels[i] || '', x + bw / 2, height - 8);
    });
  };

  // Redessine à l'insertion et au redimensionnement.
  requestAnimationFrame(draw);
  const ro = new ResizeObserver(draw);
  queueMicrotask(() => canvas.isConnected && ro.observe(canvas));
  window.addEventListener('resize', draw);

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2 || r);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
