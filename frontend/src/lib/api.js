// Thin fetch wrapper around the Pronos API. Stores the Sanctum token in
// localStorage and attaches it as a Bearer header.

const BASE = '/api/v1';
const TOKEN_KEY = 'pronos_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || `Erreur ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  del: (p) => request('DELETE', p),
};

// Money helper: minor units (centimes) -> "5 000 XOF"
export function formatXof(cents) {
  const xof = Math.round((cents || 0) / 100);
  return `${xof.toLocaleString('fr-FR')} XOF`;
}
