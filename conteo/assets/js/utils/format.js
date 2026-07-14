/* Conteo — Formatage : FCFA, durées, dates. */

export function fcfa(amount) {
  if (amount === 0) return 'Gratuit';
  const n = Number(amount).toLocaleString('fr-FR');
  return `${n} FCFA`;
}

export function duration(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r}`;
}

export function minutes(sec) {
  return Math.round(sec / 60);
}

export function bytes(b) {
  if (!b) return '0 Mo';
  const mb = b / (1024 * 1024);
  if (mb < 1) return `${Math.round(b / 1024)} Ko`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
  return `${(mb / 1024).toFixed(1)} Go`;
}

export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);   // YYYY-MM-DD
}

export function frDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const DAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export function shortDay(dateStr) {
  return DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}
