/* Conteo — Calcul du niveau de lecture depuis la date de naissance.
 *   N1 (2–3 ans) · N2 (4–5 ans) · N3 (6–7 ans)
 * Surchargeable manuellement (level_locked = true dans le profil). */

export const LEVELS = ['N1', 'N2', 'N3'];

export function ageInYears(birthYear, birthMonth = 1, now = new Date()) {
  let age = now.getFullYear() - birthYear;
  const m = (now.getMonth() + 1) - birthMonth;
  if (m < 0) age -= 1;
  return age;
}

export function levelForAge(age) {
  if (age <= 3) return 'N1';
  if (age <= 5) return 'N2';
  return 'N3';   // 6 ans et plus (l'app cible 2–7 ans)
}

/* Renvoie le niveau effectif d'un profil (respecte le verrouillage parent). */
export function resolveLevel(profile, now = new Date()) {
  if (profile.level_locked && profile.reading_level) return profile.reading_level;
  const age = ageInYears(profile.birth_year, profile.birth_month || 1, now);
  return levelForAge(age);
}

export function levelLabel(level) {
  return { N1: 'Découverte', N2: 'Éveil', N3: 'Autonomie' }[level] || level;
}
