# Odysseus — Frontend (Nuxt 4 + Tauri 2)

Next-generation desktop & web frontend for Odysseus, built as an **incremental
migration** ("strangler fig") off the legacy `static/` vanilla-JS UI. The same
codebase runs:

- **in the browser**, served by FastAPI under `/app` (alongside the old UI), and
- **as a native desktop app**, via a Tauri 2 shell that loads the static build.

The FastAPI backend and its `/api/*` contract are **unchanged** — this layer
only re-implements the UI.

## Stack

| Layer        | Choice                          | Why |
|--------------|---------------------------------|-----|
| Desktop shell| **Tauri 2** (Rust + OS webview) | Tiny binaries, native FS/notifs/tray, sidecar-ready |
| UI framework | **Nuxt 4** (Vue 3), `ssr: false`| SPA/static — works in browser *and* Tauri webview |
| Language     | **TypeScript**                  | Typed API contract mirroring the Pydantic models |
| Data         | FastAPI `/api/*` (port 7000)    | Untouched backend |

## Layout

```
frontend/
├── app/
│   ├── app.vue                  # shell (top bar + <NuxtPage/>)
│   ├── pages/
│   │   ├── index.vue            # redirects to /tasks
│   │   └── tasks.vue            # ⭐ pilot page
│   ├── components/tasks/        # TaskCard.vue, TaskForm.vue
│   ├── composables/
│   │   ├── useApi.ts            # typed $fetch wrapper (apiBase + cookies)
│   │   └── useTasks.ts          # reactive store over /api/tasks
│   ├── types/tasks.ts           # TS mirror of the Pydantic task models
│   ├── utils/schedule.ts        # human-readable schedule labels
│   └── assets/css/main.css      # design tokens (replaces 34k-line style.css)
├── nuxt.config.ts               # ssr:false, dev proxy → :7000, runtime apiBase
├── src-tauri/                   # Tauri 2 shell (Rust)
│   ├── tauri.conf.json          # devUrl :3000, frontendDist ../.output/public
│   ├── Cargo.toml · build.rs · src/{main,lib}.rs
│   └── capabilities/default.json
└── package.json
```

## Prerequisites

- Node 20+ and npm
- Rust toolchain (for the desktop build): https://rustup.rs
- **Linux only** — Tauri system libs:
  `sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev build-essential \
   libssl-dev libayatana-appindicator3-dev`
  (see https://v2.tauri.app/start/prerequisites/)

```bash
cd frontend
npm install
```

## Run — web (browser)

Start the FastAPI backend first (`uvicorn app:app --reload` on :7000), then:

```bash
npm run dev          # Nuxt dev server on http://localhost:3000
```

The dev server proxies `/api` → `http://127.0.0.1:7000` (see `nuxt.config.ts`),
so the browser talks to the live backend same-origin (no CORS in dev).
Open http://localhost:3000/tasks.

## Run — desktop (Tauri)

```bash
npm run tauri:dev    # builds the Rust shell, opens a native window on the dev server
```

## Build

**Desktop app** (default `/` base):

```bash
npm run tauri:build  # → src-tauri/target/release/bundle/
```

**Web bundle served by FastAPI under `/app`** (note the base URL):

```bash
NUXT_APP_BASE_URL=/app/ npm run generate   # → .output/public/
```

FastAPI auto-mounts `.output/public` at `/app` when it exists (guarded mount in
`app.py`), so the page becomes available at `http://localhost:7000/app/tasks`
next to the legacy `/tasks`.

## API base URL resolution

`useApi()` prefixes every call with `runtimeConfig.public.apiBase`:

- **web** (served by FastAPI): `apiBase = ''` → relative `/api/...`, same-origin.
- **desktop**: set `NUXT_PUBLIC_API_BASE=http://127.0.0.1:7000` at build time so
  the webview calls the local backend. This is cross-origin → enable CORS on
  FastAPI for the Tauri origin (`tauri://localhost` / `http://tauri.localhost`),
  or bundle the backend as a Tauri **sidecar** (future step).

## Migration roadmap (strangler)

1. ✅ **Tasks** — pilot (this PR): list, create/edit, delete, run-now,
   pause/resume, schedule labels.
2. ⬜ Sessions / chat list (read-heavy, validates streaming patterns)
3. ⬜ Notes, Calendar, Memory, Gallery — one page at a time
4. ⬜ Chat (largest; `static/js/chat.js` ~217 kB) — last, once patterns are proven
5. ⬜ Retire `static/` pages as each is migrated; eventually drop `style.css`
6. ⬜ Desktop hardening: tighten CSP, backend sidecar, auto-update, native menus

Each page is migrated behind `/app/<page>`; once at parity, the legacy route is
flipped to redirect there, then the old code is deleted.

## What was verified

- `npm run generate` — static build succeeds (`/tasks` prerendered).
- `npm run typecheck` — passes (TypeScript, no errors).
- `npm run tauri info` — config valid; Nuxt detected; devUrl/frontendDist wired.
  (Rust compile not run in CI container — missing webkit2gtk system libs.)
```
