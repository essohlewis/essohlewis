# 📈 Amoura — Observabilité

**Phase 6.** Santé, corrélation des logs et métriques pour exploiter la
plateforme en production (sondes de load-balancer/k8s, tableaux Grafana,
alerting).

---

## 1. Points de terminaison

| Endpoint | Auth | Rôle |
|---|---|---|
| `GET /healthz` | public | **Liveness** — le process répond (aucune dépendance, court-circuit avant session). Toujours `200`. |
| `GET /healthz/ready` | public | **Readiness** — vérifie BDD (critique), cache et disque. `200` si sain/dégradé, `503` si une dépendance critique tombe. |
| `GET /metrics` | jeton | **Métriques Prometheus** (text/plain). Protégé par `METRICS_TOKEN`. |

### Exemple readiness
```json
{
  "status": "ok",
  "checks": {
    "database": { "ok": true, "critical": true },
    "cache":    { "ok": true, "critical": false, "detail": "redis" },
    "storage":  { "ok": true, "critical": false, "detail": "writable" }
  },
  "duration_ms": 3.1,
  "request_id": "…"
}
```
Statut global : `ok` (tout passe) · `degraded` (composant non critique KO) ·
`unhealthy` (BDD injoignable → `503`).

### Accès aux métriques
```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" https://amoura.example/metrics
# ou  /metrics?token=$METRICS_TOKEN
```
`METRICS_TOKEN` vide ⇒ endpoint fermé (403).

---

## 2. Métriques exposées (jauges)

| Métrique | Sens |
|---|---|
| `amoura_up` | L'application répond (1). |
| `amoura_users_online` | Utilisateurs en ligne. |
| `amoura_active_subscriptions` | Abonnements actifs. |
| `amoura_outbox_pending` | E-mails/SMS en attente d'envoi. |
| `amoura_outbox_failed` | Messages en échec définitif (**à alerter**). |
| `amoura_reports_open` | Signalements de modération ouverts. |
| `amoura_verifications_pending` | Vérifications de profil en attente. |

> **Note d'implémentation.** PHP est « shared-nothing » : les *compteurs* en
> mémoire ne persistent pas entre requêtes. L'exposition privilégie donc des
> **jauges** dérivées de la base (valables à l'instant t). Pour des compteurs
> cumulés (req/s, erreurs), brancher un magasin partagé (APCu/Redis) — prévu.

### Alertes recommandées
- `amoura_outbox_failed > 0` (livraison e-mail/SMS cassée).
- `/healthz/ready` en `503` (BDD).
- `amoura_reports_open` au-dessus d'un seuil (retard de modération).

---

## 3. Corrélation des logs (request-id)

Chaque requête reçoit un **identifiant de corrélation** :
- réutilise l'en-tête entrant `X-Request-Id` (proxy/LB) s'il est plausible,
  sinon génère un UUID v4 ;
- renvoyé au client dans l'en-tête `X-Request-Id` ;
- injecté automatiquement dans **toutes** les lignes de `Services\Logger`
  (`request_id`), ainsi que dans le **journal d'accès** émis en fin de requête
  (`http_request` : méthode, chemin, statut, `duration_ms`).

Exemple de ligne (JSON, `storage/logs/app.log`) :
```json
{"ts":"2026-07-27T…","level":"info","message":"http_request",
 "context":{"method":"GET","path":"/discover","status":200,"duration_ms":12.4},
 "env":"production","request_id":"772ef414-4703-4cd7-beea-4a2cebb13221"}
```
→ tracer une requête de bout en bout revient à filtrer sur `request_id`.

---

## 4. Intégration exploitation

- **Kubernetes** : `livenessProbe` → `/healthz`, `readinessProbe` →
  `/healthz/ready`.
- **Prometheus** : `scrape` de `/metrics` avec le header d'autorisation.
- **Grafana/Loki** : ingérer `storage/logs/*.log` (JSON) ; corréler via
  `request_id`. En conteneur, rediriger vers `stdout`.

---

*Document vivant — étendre les jauges/alertes au fil des besoins. Amoura © 2026.*
