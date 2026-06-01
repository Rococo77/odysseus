# Plan de migration — frontend vanilla JS → Nuxt 3 (Vue 3)

> Statut : proposé · Cible : `static/` → nouvelle app Nuxt
> Objectif : passer d'une SPA vanilla impérative à une app Nuxt 3 componentisée,
> réactive et typée, **sans interruption de service** (migration incrémentale).
>
> ⚠️ Chantier majeur : **~20-30 semaines** (5-7 mois) estimées, 1 senior ou
> 2-3 mid-level. À traiter comme un projet, pas comme une PR.

## 1. État des lieux (preuves)

| Dimension | Réalité actuelle |
|---|---|
| Stack | **Vanilla JS, modules ES6, aucun build step / bundler** |
| Volume | ~104k l. JS (130 fichiers) + `style.css` **34 359 l. / 1,08 Mo** + `index.html` **2 253 l.** |
| Serving | FastAPI sert le même `index.html` pour `/`, `/notes`, `/email`… ; nonce CSP injecté via `_serve_html_with_nonce()` (`app.py:664`) ; mount `/static` avec `_RevalidatingStatic` (no-cache) |
| Routing | SPA manuelle : `app.js` lit `location.pathname` et mappe via objet `_routeOpen` ; pas de History API ; navigation = toggle `.hidden` sur des modales |
| État | Dispersé : closures de module (40+ vars dans `chat.js`), `localStorage` (`storage.js`), namespace global (`window.themeModule`, `window.sessionModule`…). **Aucune réactivité** — re-render impératif manuel |
| API | **190+ `fetch()` éparpillés**, `credentials: 'same-origin'`, wrapper global qui redirige sur 401 (`app.js:55`). Pas de client centralisé. Streaming chat via `ReadableStream.getReader()` |
| CSS | Monolithique, sélecteurs globaux, thème piloté par variables CSS posées en JS (`document.documentElement.style.setProperty`) |
| Libs | Vendored dans `static/lib/` (3,3 Mo : xlsx, html2pdf, docx, mammoth, highlight, qrcode) + CDN (KaTeX, Mermaid) |
| PWA | `manifest.json` + `sw.js` (145 l., precache 64 fichiers, `CACHE_NAME` bumpé à la main), manifest par-route généré dynamiquement |
| Rendering | 100 % impératif (`innerHTML`, `createElement`) ; `chat.js` seul = **190+ `getElementById/querySelector`** |

## 2. Pourquoi migrer (et pourquoi prudemment)

**Bénéfices** : UI réactive (fin des re-renders manuels), composants réutilisables,
testabilité (Vitest + Playwright), état centralisé (Pinia), TypeScript, écosystème
et outillage modernes — ce qui adresse directement les douleurs du ROADMAP
(CSS « île de Calypso », scaffolding de tours copié-collé, états morts).

**Risque clé** : le frontend *fonctionne*. Une réécriture big-bang de 141k lignes
est le meilleur moyen de tout casser. La règle d'or : **strangler pattern,
fonctionnalité par fonctionnalité, l'ancien et le nouveau cohabitent.**

## 3. Décision d'architecture cible

- **Nuxt 3 + TypeScript**, rendu **SPA/CSR** (`ssr: false`) au moins au départ :
  l'app est derrière auth, locale, riche en état client → le SSR apporte peu et
  complique le nonce CSP et l'auth cookie. SSR évaluable plus tard.
- **Pinia** pour l'état (remplace closures de module + globals `window.*`).
- **Composables** pour l'API (`useApi`, `useAuth`, `useStream`) — un seul point
  d'entrée fetch avec gestion 401/erreurs/SSE.
- **FastAPI inchangé** côté `/api/*` : Nuxt ne remplace que la couche de présentation.
  C'est ce qui rend la migration incrémentale possible.

## 4. Stratégie de coexistence (le cœur du plan)

1. Nuxt buildé en statique (`nuxi generate`) et servi par FastAPI sous un préfixe
   (`/app`) **en parallèle** de l'`index.html` legacy (`/`).
2. On migre **un outil à la fois** (chat → sessions → … → editor). Tant qu'un outil
   n'est pas porté, on continue de servir sa version legacy.
3. Un reverse-proxy / routing FastAPI bascule progressivement les paths vers Nuxt.
4. Bascule finale : `/` → Nuxt, suppression du legacy une fois tout porté.

> Alternative si coexistence trop coûteuse : « big rewrite » sur branche dédiée
> longue durée — **déconseillé** vu le volume et l'absence de tests UI actuels.

## 5. Phases

| Phase | Durée | Contenu |
|---|---|---|
| **0 — Filet E2E** | 1-2 sem | Playwright sur les parcours critiques (login, chat+stream, sessions, email, notes) **contre l'app legacy** → oracle de non-régression avant toute réécriture. S'appuie sur `tests/bombadil-spec.ts` existant. |
| **1 — Socle Nuxt** | 1-2 sem | Projet Nuxt 3 + TS, layout, Pinia, composables API (`useApi`/`useAuth`/`useStream`), portage de `storage.js` → store + composable, gestion cookie/401, nonce CSP via middleware Nuxt. |
| **2 — Chat (cœur)** | 4-6 sem | `chat.js`/`chatRenderer.js`/`slashCommands.js` → `components/Chat/*` + `stores/chat.ts`. **Streaming SSE** via composable. Le test le plus dur et le plus important. |
| **3 — Sessions & Memory** | 2-3 sem | `sessions.js`, `memory.js` → stores + `Sidebar/SessionList.vue`, `Memory/*`. |
| **4 — Outils** | 8-10 sem | Un par un : notes, calendar, email, gallery, tasks, admin, settings, compare, cookbook. Chaque modale monolithique → arbre de composants + store. |
| **5 — Thème & CSS** | 2-3 sem | `theme.js` → `useTheme` composable ; variables CSS gardées globales ; styles découpés en `scoped` par composant ; dérivation des couleurs de syntaxe → utilitaire. |
| **6 — PWA & déploiement** | 1-2 sem | Module PWA Nuxt (remplace `sw.js`), manifest par-route, intégration build dans le serving FastAPI + CI. |
| **7 — Tests & polish** | 2-4 sem | E2E complets, perf (bundle, lazy-load des modales), cross-browser/mobile, bascule finale, suppression du legacy. |

## 6. Patron de migration par module (répétable)
1. Écrire/valider le test E2E Playwright de la feature (Phase 0).
2. Modéliser l'état dans un store Pinia ; isoler les effets (fetch) dans des actions.
3. Découper la modale/panneau monolithique en composants (`v-for` remplace
   `map()+innerHTML`, refs Vue remplacent `getElementById`).
4. Brancher sur les composables API (zéro `fetch` direct, zéro `document.*`).
5. Servir la version Nuxt sous le préfixe, désactiver la version legacy de l'outil.
6. Re-jouer le test E2E → vert avant de passer au module suivant.

## 7. Points durs identifiés (et parades)

| Risque | Sév. | Parade |
|---|---|---|
| Couplage DOM impératif (190+ requêtes dans `chat.js`) | Haute | Refs/`Teleport`, jamais `document.*` dans le nouveau code |
| Rendu impératif monolithique (notes/calendar/email…) | Haute | Découpe en sous-composants, slots/props |
| Streaming SSE `/api/chat` | Moyenne | Composable `useStream` dédié émettant vers le store |
| `index.html` 2 253 l. (toutes modales pré-rendues) | Moyenne | Composants lazy-load → gain perf au passage |
| CSS 34k l. global + thème en JS | Moyenne | Garder vars globales, scoper le reste par composant, incrémental |
| `editor/` (87 fichiers, 512 Ko) | Haute | **Ne pas réécrire** : wrapper dans un composant Vue, porter en dernier |
| 190+ callsites fetch | Moyenne | Centraliser tôt (Phase 1), migrer au fil des modules |
| Ouverture de route différée (`loadSessions().finally`) | Moyenne | Navigation guards / setup async |

## 8. Dépendances avec les autres plans
- **CI (plan 03)** doit exister d'abord : ajouter jobs `build-nuxt` + E2E Playwright.
- Indépendant du **refactor routes (plan 01)** (back vs front) — peuvent avancer
  en parallèle ; les deux profitent du filet de tests.

## 9. Critères de succès
- Parité fonctionnelle vérifiée par E2E sur tous les parcours critiques.
- 0 `document.getElementById` / `fetch()` direct dans le code Nuxt.
- Bundle initial raisonnable (modales/outils en lazy-load).
- PWA (offline + install) fonctionnelle.
- Legacy `static/` supprimé en fin de Phase 7.

## 10. Recommandation
Vu l'ampleur (5-7 mois) et le fait que l'app **marche déjà**, ce chantier ne se
justifie que si l'équipe vise une vélocité front durable. Si l'objectif court terme
est surtout la stabilité/maintenabilité, **prioriser le plan CI (03) et le refactor
routes (01)**, et n'engager la migration Nuxt qu'ensuite, par tranches financées.
