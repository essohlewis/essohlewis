# 🚀 Amoura — Tests de charge & budget de performance

**Phase 1 (mise en production).** Outils reproductibles pour mesurer la tenue en
charge du HTTP et du temps réel (chat/signaling), et garde-fous chiffrés
(budget de performance) exploitables en CI.

---

## 1. Budget de performance

Le budget vit dans **`perf-budget.json`** (seuils indicatifs à ajuster selon
l'infrastructure cible). Il pilote le verdict des deux scripts.

| Domaine | Métrique | Seuil par défaut |
|---|---|---|
| HTTP | p95 / p99 / moyenne | 400 / 800 / 200 ms |
| HTTP | taux d'erreur (≥ 5xx) | 1 % |
| WebSocket — connexion | p95 / p99 (connexion → `ready`) | 500 / 1000 ms |
| WebSocket — remise | p95 / p99 (latence de message) | 250 / 600 ms |
| WebSocket — remise | messages perdus | 2 % |

Un dépassement fait **échouer** le script (code de sortie ≠ 0) → blocable en CI.

---

## 2. Test de charge HTTP

```bash
php scripts/loadtest.php --base=https://amoura.example \
    --requests=500 --concurrency=50 --paths=/,/login,/register
```

- Requêtes concurrentes via `curl_multi`, latences agrégées (p50/p95/p99),
  débit (req/s), répartition des statuts, taux d'erreur.
- Les redirections d'authentification (302) sont comptées comme des réponses
  valides (pas des erreurs).
- Verdict comparé à `perf-budget.json` → section `http.thresholds`.

## 3. Test de charge WebSocket / signaling

```bash
# Nécessite le serveur temps réel démarré (php websocket/server.php)
php scripts/ws_loadtest.php --host=127.0.0.1 --port=8090 \
    --connections=200 --messages=10
```

- Ouvre N connexions, **forge ses propres tickets** (`WsTicket` + `APP_KEY`) :
  aucun compte réel requis (IDs synthétiques ≥ 900000).
- Mesure la **latence de connexion** (connexion → `ready`) puis la **latence de
  remise** de messages entre paires d'utilisateurs (horloge de processus
  partagée → mesure de bout en bout précise).
- Verdict comparé à `perf-budget.json` → section `websocket.thresholds`.

> **Bug réel détecté par cet outil (Sprint +8)** : `ChatServer::onOpen`
> passait l'objet PSR-7 `Uri` à `parse_url()`, ce qui levait une `TypeError`
> et **faisait planter le serveur à chaque connexion**. Corrigé en lisant
> `getUri()->getQuery()`. C'est précisément la valeur d'un test de charge :
> exercer le vrai chemin de connexion.

---

## 4. Briques réutilisables (testées)

| Classe | Rôle |
|---|---|
| `Core\Benchmark\Metrics` | Percentiles (interpolation linéaire) + synthèse min/moy/max. |
| `Core\Benchmark\Budget` | Évaluation pass/fail d'une synthèse vs seuils. |
| `Core\Realtime\WsFrame` | Encodage/décodage de trames RFC 6455 (masquage client). |
| `Core\Realtime\Handshake` | Clé cliente + clé d'acceptation serveur (vecteur RFC vérifié). |

Couvertes par 15 tests unitaires (`BenchmarkTest`, `RealtimeFrameTest`).

---

## 5. Méthodologie & interprétation

1. **Tester au plus près de la prod** : mêmes ressources CPU/RAM, cache Redis
   actif, réplica de lecture branché, derrière le proxy TLS.
2. **Isoler les variables** : une montée en charge à la fois (connexions, débit).
3. **Chercher le point de rupture** : augmenter `--concurrency` /
   `--connections` jusqu'au dépassement du budget ; noter le palier.
4. **Profiler les points chauds** : requêtes de découverte/fil (déjà indexées,
   cf. migration 001), sérialisation JSON, publication sur le bus temps réel.
5. **Rejouer après chaque optimisation** pour confirmer le gain sans régression.

### Leviers de tuning déjà en place
- Index composites & requêtes `EXPLAIN`-vérifiées (Sprint +1).
- Cache Redis (sessions, rate-limit, réglages) + réplica de lecture (Sprint +6).
- Clustering WebSocket via bus Redis pub/sub pour l'horizontal (Sprint +3).
- File d'envoi asynchrone : sort e-mail/SMS du chemin critique (Sprint +7).

---

*Document vivant — à relancer à chaque itération majeure. Amoura © 2026.*
