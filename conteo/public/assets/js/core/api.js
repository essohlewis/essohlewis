/**
 * CONTEO — Client HTTP (fetch + Bearer token).
 * Gère l'ajout du token, le décodage JSON et une erreur normalisée.
 */

import { state } from './store.js';

const BASE = '/api/v1';

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const e = new Error('offline');
    e.offline = true;
    throw e;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Erreur ${res.status}`);
    err.status = res.status;
    err.errors = data && data.errors;
    throw err;
  }

  return data && 'data' in data ? data.data : data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p, b) => request('DELETE', p, b),
};
