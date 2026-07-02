export const colors = {
  bg: '#0f1115',
  surface: '#191d24',
  surface2: '#222732',
  text: '#eef1f5',
  muted: '#9aa4b2',
  brand: '#14a44d',
  brand2: '#0d7a39',
  danger: '#e5484d',
  gold: '#d4af37',
  silver: '#b8c0cc',
  bronze: '#cd7f32',
  border: '#2a2f3a',
};

export const badgeColor = {
  gold: colors.gold,
  silver: colors.silver,
  bronze: colors.bronze,
  unrated: colors.muted,
};

export const badgeLabel = {
  gold: 'Or',
  silver: 'Argent',
  bronze: 'Bronze',
  unrated: 'Non noté',
};

// Money helper: minor units (centimes) -> "5 000 XOF"
export function formatXof(cents) {
  const xof = Math.round((cents || 0) / 100);
  return `${xof.toLocaleString('fr-FR')} XOF`;
}
