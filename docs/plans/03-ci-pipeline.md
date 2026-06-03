# Plan — Pipeline d'intégration continue (GitHub Actions)

> Statut : proposé · Cible : nouveau dossier `.github/workflows/`
> Objectif : exécuter automatiquement tests, lint et type-check à chaque PR ;
> c'est le gain à plus fort effet de levier du projet (surface sécurité large,
> 0 automatisation aujourd'hui).

## 1. Constat

- **Aucune CI** : pas de `.github/workflows/`.
- **Aucun linter / type checker** dans les deps ni en config (ni ruff, ni mypy,
  ni black, ni flake8).
- **Tests existants mais jamais exécutés en CI** : 24 fichiers pytest
  (~3 800 l.), `pyproject.toml` configure `pytest` (`asyncio_mode = "auto"`).
- **`conftest.py` est CI-friendly** : il stub les deps lourdes (SQLAlchemy,
  bcrypt, fastapi, pydantic…) quand absentes → les tests unitaires tournent
  **sans installation complète**. Atout majeur pour un job rapide.
- **Tests JS** : `tests/test_compare_js.py` pilote `node --input-type=module`
  (se skip si `node` absent) ; `tests/bombadil-spec.ts` (Antithesis) pour l'UI.
- **Python 3.11** (cf. README « 3.11+ »).
- Deps front : `@anthropic-ai/sdk`, `@antithesishq/bombadil` (package.json).

## 2. Stratégie

Pipeline en **jobs parallèles rapides** sur PR, plus un job lourd optionnel.
Tout doit rester vert sur une PR fraîche sans secrets.

### Étape préalable (outillage) — à committer avant les workflows
1. **Ajouter ruff + mypy** dans un `requirements-dev.txt` :
   ```
   pytest
   pytest-asyncio
   ruff
   mypy
   ```
2. **Config ruff** dans `pyproject.toml` :
   ```toml
   [tool.ruff]
   target-version = "py311"
   line-length = 100
   [tool.ruff.lint]
   select = ["E", "F", "I", "B", "UP", "C4"]  # erreurs, pyflakes, isort, bugbear, pyupgrade
   ignore = ["E501"]  # géré par formatter, on durcira plus tard
   ```
   > Démarrer permissif : `ruff check` ne doit pas exploser sur 83k lignes le
   > jour 1. Activer les règles par vagues.
3. **Config mypy** progressive (non bloquant d'abord) :
   ```toml
   [tool.mypy]
   python_version = "3.11"
   ignore_missing_imports = true
   check_untyped_defs = false   # on monte les exigences module par module
   ```

## 3. Workflows

### `.github/workflows/ci.yml` — sur `push` + `pull_request`
Jobs parallèles :

| Job | Contenu | Bloquant ? |
|---|---|---|
| `lint` | `ruff check .` + `ruff format --check .` | ✅ oui |
| `typecheck` | `mypy src core` (périmètre élargi par vagues) | ⚠️ non-bloquant au départ (`continue-on-error`) |
| `test-py` | matrice Python `3.11`/`3.12` : `pip install -r requirements-dev.txt` puis `pytest -q` | ✅ oui |
| `test-js` | `setup-node`, `npm ci`, exécuter les tests node portables | ✅ oui (skip si non applicable) |

Esquisse :
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11", cache: pip }
      - run: pip install ruff
      - run: ruff check .
      - run: ruff format --check .
  test-py:
    runs-on: ubuntu-latest
    strategy:
      matrix: { python-version: ["3.11", "3.12"] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "${{ matrix.python-version }}", cache: pip }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest -q --maxfail=1
  typecheck:
    runs-on: ubuntu-latest
    continue-on-error: true   # informatif tant que le typage n'est pas complet
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11", cache: pip }
      - run: pip install mypy
      - run: mypy src core
```

### `.github/workflows/coverage.yml` (option, sur PR)
- `pytest --cov=src --cov=core --cov=routes --cov-report=xml` + commentaire de
  couverture (sans bloquer). Établit une **baseline** et empêche les régressions.

### Décision : tests « light » vs « full »
- **Light (défaut, rapide)** : grâce aux stubs de `conftest.py`, on peut lancer
  `pytest` avec un minimum de deps → job < 2 min, idéal sur chaque PR.
- **Full (nightly / label `full-ci`)** : installe `requirements.txt` complet
  (chromadb-client, fastembed, caldav…) et lance la suite entière. Évite de
  ralentir chaque PR avec ~300 Mo de deps.

## 4. Garde-fous repo (à activer côté GitHub)
- **Branch protection** sur `main` : exiger `lint` + `test-py` verts avant merge.
- **Secret scanning** / push protection (déjà dispo via GitHub).
- Dependabot pour `pip` et `npm` (`.github/dependabot.yml`).

## 5. Roadmap d'adoption (éviter le mur rouge)
1. **Semaine 1** : workflow `ci.yml` avec `lint`+`test-py` ; ruff en mode minimal
   (`F`, `E9` seulement → ne casse presque rien).
2. **Semaine 2** : `ruff format` appliqué une fois en PR dédiée, puis
   `--check` bloquant. Activer `I` (isort), `B`, `UP`.
3. **Semaine 3+** : mypy non-bloquant → bloquant sur `src/` core (`llm_core`,
   `config`, `settings`) module par module via overrides `[[tool.mypy.overrides]]`.
4. Brancher la **Phase 0 du plan routes** (tests d'intégration `TestClient`) dans
   `test-py`.

## 6. Critères de succès
- Toute PR déclenche lint + tests ; merge bloqué si rouge.
- Temps de feedback PR < 3 min (job light).
- Baseline de couverture publiée et non-régressive.
- mypy étendu progressivement sans bloquer le flux au démarrage.
