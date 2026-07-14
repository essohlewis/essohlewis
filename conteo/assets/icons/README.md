# Icônes

`favicon.svg` est la source. Les icônes PNG (`192.png`, `512.png`,
`512-mask.png`) en sont dérivées et **sont versionnées** (le manifest PWA et les
stores exigent du PNG). Pour les régénérer après modification du SVG :

| Fichier | Taille | Usage |
|---|---|---|
| `192.png` | 192×192 | PWA, apple-touch-icon |
| `512.png` | 512×512 | PWA (splash Android) |
| `512-mask.png` | 512×512 | PWA `purpose: maskable` (garder ~20% de marge de sécurité) |

Régénération (rasterisation via Chromium, aucune dépendance native) :

```bash
npm run icons        # = node tools/generate-icons.mjs
```

Le Service Worker précache ces PNG ; il tolère leur absence en dev
(`favicon.svg` sert alors de repli).
