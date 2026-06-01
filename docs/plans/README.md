# Plans techniques

Plans de refactor/évolution issus de l'analyse de la codebase.

| # | Plan | Effort | Dépend de |
|---|------|--------|-----------|
| [01](01-routes-refactor.md) | Refactor de la couche `routes/` (closures, `get_db`, auth) | Moyen-élevé | 03 (pour les tests) |
| [02](02-frontend-nuxt-migration.md) | Migration du frontend vanilla JS → Nuxt 3 | Élevé (5-7 mois) | 03 |
| [03](03-ci-pipeline.md) | Pipeline CI GitHub Actions (lint/test/typecheck) | Faible, fort levier | — |

**Ordre recommandé** : 03 (CI) → 01 (routes) → 02 (Nuxt, par tranches).
Le suivi opérationnel est dans les issues GitHub (label `epic`/`refactor`/`ci`/`frontend`).
