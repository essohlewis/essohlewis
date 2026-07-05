# Pronos — App mobile (Expo / React Native)

App mobile de la plateforme de pronostics (Phase 2). Consomme la **même API**
que le web (`backend/`). Expo SDK 57 · React Native 0.86.

## Écrans

- **Classement** — pronostiqueurs triés par fiabilité (score + badge)
- **Profil pronostiqueur** — stats, palmarès public, abonnement ; picks réservés masqués
- **Connexion** — OTP par téléphone (code affiché en dev)
- **Wallet** — solde, recharge Mobile Money, historique

Navigation : React Navigation (native-stack). Token stocké via **expo-secure-store**.

## Démarrage

```bash
cd mobile
npm install
# Pointe l'app vers ton backend : app.json -> expo.extra.apiUrl
# En dev sur téléphone physique, mets l'IP LAN de ta machine, ex :
#   "apiUrl": "http://192.168.1.10:8000"
npx expo start
```

Puis scanne le QR code avec **Expo Go**, ou lance un simulateur (`i` / `a`).

> ⚠️ `127.0.0.1` ne fonctionne que sur simulateur. Sur un téléphone réel,
> l'app et le backend doivent être sur le même réseau et `apiUrl` doit pointer
> vers l'IP LAN de la machine qui fait tourner `php artisan serve --host=0.0.0.0`.

## Vérification

Le bundle JS est validé via Metro :

```bash
npx expo export --platform ios --output-dir /tmp/pronos-export
```

## Configuration

| Clé | Où | Rôle |
|---|---|---|
| `apiUrl` | `app.json` → `expo.extra.apiUrl` | Base URL du backend |
| token | expo-secure-store (`pronos_token`) | Jeton Sanctum |
