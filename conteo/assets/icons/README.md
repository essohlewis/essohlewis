# Icônes

`favicon.svg` est fourni et sert d'icône principale (navigateurs modernes, onglet).

Les icônes PNG matricielles requises par le manifest PWA et les stores doivent
être **exportées depuis `favicon.svg`** (contenu binaire, non versionné ici) :

| Fichier | Taille | Usage |
|---|---|---|
| `192.png` | 192×192 | PWA, apple-touch-icon |
| `512.png` | 512×512 | PWA (splash Android) |
| `512-mask.png` | 512×512 | PWA `purpose: maskable` (garder ~20% de marge de sécurité) |

Export en une commande (nécessite un outil de rendu SVG, ex. `rsvg-convert` ou `sharp`) :

```bash
for s in 192 512; do rsvg-convert -w $s -h $s favicon.svg -o ${s}.png; done
rsvg-convert -w 512 -h 512 favicon.svg -o 512-mask.png
```

Tant que les PNG ne sont pas générés, l'application reste fonctionnelle :
le Service Worker tolère leur absence et le `favicon.svg` s'affiche.
