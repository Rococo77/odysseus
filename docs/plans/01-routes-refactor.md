# Plan de refactor — couche `routes/`

> Statut : proposé · Cible : `routes/` (47 modules) + `app.py` câblage
> Objectif : réduire le couplage, supprimer les closures-monstres, standardiser
> l'accès DB et l'auth, rendre la couche testable — **sans changer le
> comportement observable des endpoints**.

## 1. Constat (preuves)

| Symptôme | Preuve | Impact |
|---|---|---|
| Closures géantes mono-fonction | `setup_email_routes()` 2 705 l. (`email_routes.py:432-3136`), `setup_cookbook_routes()` 1 906 l., `setup_gallery_routes()` ~1 700 l., `setup_document_routes()` ~1 200 l. | Helpers internes (`_pooled_connect`, `_list_emails_sync` 352 l.) intestables sans instancier le router |
| État capturé en closure | `email_routes.py:432-462` : 6 caches/pools (`_LIST_CACHE`, `_READ_CACHE`, `_IMAP_POOL`, `_pool_lock`…) | État caché, fuite mémoire si re-registration, non mockable |
| Couplage global caché | `email_routes.py:577` mute `_POOL_HOOKS["connect"]/["release"]` de `email_helpers.py` | Dépendance implicite entre 2 fichiers de 3 136 + 1 274 l. |
| Accès DB non standardisé | 22 fichiers font `db = SessionLocal()` + try/finally à la main ; 1 seul (`api_token_routes.py`) utilise `get_db_session()` ; **0** via `Depends()` | ~100+ blocs boilerplate dupliqués (29× dans gallery, 24× dans document) |
| Auth dupliquée | `src/auth_helpers.py:7-58` définit `get_current_user/require_user/require_privilege/owner_filter` **mais** `email_helpers.py:154-166` redéfinit `require_owner`/`require_user` | Deux sources de vérité |
| Signatures de factory hétérogènes | `setup_chat_routes(...)` prend 9 args ; `setup_email_routes()`, `setup_gallery_routes()`, `setup_api_token_routes()` en prennent 0 | Pas de convention d'injection |

**Points déjà sains à préserver :** Pydantic est bien adopté (`src/request_models.py`),
`HTTPException` est cohérent, des exception handlers custom existent
(`app.py:450-465`), des modules `*_helpers.py` compagnons existent déjà. Les
imports paresseux dans `email_routes` sont des optimisations de perf (pas des
cycles d'import) — **à documenter, pas à « corriger ».**

## 2. Principes directeurs

1. **Aucune régression de comportement** : chaque phase est couverte par des tests
   de caractérisation (golden) écrits *avant* le refactor.
2. **Strangler pattern** : on extrait progressivement, fichier par fichier, en
   gardant les `setup_*_routes()` comme façade stable pour `app.py`.
3. **Petites PR isolées** : une PR par fichier de route ou par phase transversale,
   jamais un big-bang.
4. **Phases transversales d'abord** (DB, auth) car elles débloquent le reste.

## 3. Phases

### Phase 0 — Filet de sécurité (préalable, bloquant)
- Écrire des **tests d'intégration `TestClient`** pour les endpoints les plus
  critiques (`/api/chat`, sessions, email list/send, gallery upload, documents)
  avec LLM/IMAP mockés. C'est le filet sans lequel le reste est dangereux.
- Geler les contrats : snapshot des schémas OpenAPI (`/openapi.json`) en fixture,
  test qui échoue si un path/param disparaît.
- **Dépend de** : pipeline CI (plan 03) pour exécuter ces tests automatiquement.

### Phase 1 — Dépendance DB unifiée `get_db()`
- Ajouter dans `core/database.py` :
  ```python
  def get_db():
      db = SessionLocal()
      try:
          yield db
      finally:
          db.close()
  ```
- Migrer les 22 fichiers de `db = SessionLocal(); try/finally` vers
  `db: Session = Depends(get_db)`. Mécanique, à faire 1 fichier/PR.
- Conserver `get_db_session()` (context manager) pour les usages hors-handler
  (pollers, tâches de fond).
- **Gain** : ~100 blocs boilerplate supprimés, ouverture/fermeture DB garantie,
  override trivial en test (`app.dependency_overrides[get_db]`).

### Phase 2 — Auth centralisée
- Faire de `src/auth_helpers.py` **la** source unique.
- Supprimer les redéfinitions de `email_helpers.py:154-166`. Si `require_owner`
  a besoin d'un `account_id` en query, le généraliser dans `auth_helpers` via une
  factory `require_owner(model_or_scope)` réutilisable.
- Exposer des dépendances FastAPI prêtes : `CurrentUser = Depends(require_user)`,
  `Owner = Depends(require_owner)`.

### Phase 3 — Casser les closures-monstres (cœur du refactor)
Ordre par ratio risque/valeur : **email → cookbook → gallery → document**.

Pour chaque, appliquer le même patron d'extraction :

1. **Extraire l'état** capturé (caches, pools) dans une classe service injectable.
   Ex. `services/email/imap_pool.py` → `ImapPool` (remplace `_IMAP_POOL` +
   `_pooled_connect/_release` + supprime le hack `_POOL_HOOKS`).
2. **Extraire les caches** dans un petit `TTLCache` réutilisable
   (`src/ttl_cache.py`) plutôt que des dicts ad-hoc + locks recopiés.
3. **Extraire les helpers de logique pure** (ex. `_list_emails_sync`,
   `_imap_search_quote`) en fonctions module-level testables.
4. **Réduire `setup_*_routes()`** à : instancier/recevoir les services, déclarer
   les handlers (qui délèguent aux services), `return router`. Cible < 300 l.
5. Les handlers reçoivent leurs deps via `Depends` (db, owner, service).

> Note : on **ne supprime pas** les imports paresseux de perf — on ajoute un
> commentaire `# deferred: perf, not a cycle` pour couper court à la confusion.

### Phase 4 — Convention d'injection homogène
- Standardiser les signatures de factory : soit tout via un objet `Deps`
  (container léger), soit toutes les deps en kwargs nommés explicites.
- Les routes « 0 arg » (`emoji`, `api_token`, `gallery`) qui vont chercher leurs
  deps en global doivent recevoir ce dont elles ont besoin explicitement.

### Phase 5 — Découpage des `*_routes.py` restants > 1 000 l.
- `email_routes.py` reste le plus gros même après extraction : le scinder par
  domaine d'endpoint (`email/list_routes.py`, `email/send_routes.py`,
  `email/triage_routes.py`) regroupés par un `setup_email_routes()` agrégateur.

## 4. Séquencement & dépendances

```
Plan CI (03) ──► Phase 0 (tests intégration) ──► Phase 1 (get_db)
                                                      │
                                                      ▼
                                              Phase 2 (auth)
                                                      │
                                                      ▼
                  Phase 3 (email ► cookbook ► gallery ► document)
                                                      │
                                                      ▼
                                       Phase 4 (injection) ► Phase 5 (split)
```

## 5. Critères de succès
- Plus aucun `setup_*_routes()` > 400 lignes.
- 0 occurrence de `db = SessionLocal()` dans `routes/` (hors pollers/fond).
- Une seule implémentation de `require_user`/`require_owner`.
- `_POOL_HOOKS` global supprimé.
- Couverture d'intégration sur les 6 flux critiques, exécutée en CI.

## 6. Risques
- **IMAP/email** : logique stateful complexe (pool, IDLE, caches) — risque de
  régression élevé. Mitigation : Phase 0 exhaustive sur email avant de toucher.
- **Refactor à grande échelle** : tenir la discipline « 1 fichier / PR » pour
  garder les diffs revus.
