import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Mobile has no dev proxy: the API base URL must be absolute and reachable from
// the device. Configure it in app.json -> expo.extra.apiUrl (a LAN IP in dev).
const BASE = `${Constants.expoConfig?.extra?.apiUrl ?? 'http://127.0.0.1:8000'}/api/v1`;
const TOKEN_KEY = 'pronos_token';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.message || `Erreur ${res.status}`);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  del: (p) => request('DELETE', p),
};
