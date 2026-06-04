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
| Styling      | **Tailwind v4** (`@tailwindcss/vite`) | CSS-first `@theme` in `main.css`; palette → utilities |
| Language     | **TypeScript**                  | Typed API contract mirroring the Pydantic models |
| Markdown     | **marked** + **DOMPurify**      | Chat message rendering (sanitized) |
| Data         | FastAPI `/api/*` (port 7000)    | Untouched backend |

> Styling note: every page uses **Tailwind utilities** driven by the shared
> `@theme` palette (`bg-panel`, `text-muted`, `border-border`, …). A couple of
> tiny scoped rules remain only where a utility is unavailable (e.g. line-clamp
> in this Tailwind build).

## Layout

```
frontend/
├── app/
│   ├── app.vue                  # shell (top bar + <NuxtPage/>)
│   ├── pages/
│   │   ├── index.vue            # redirects to /tasks
│   │   ├── tasks.vue            # ⭐ 1st migrated
│   │   ├── sessions.vue         # ⭐ 2nd migrated
│   │   ├── memory.vue           # ⭐ 3rd migrated
│   │   ├── notes.vue            # ⭐ 4th migrated
│   │   ├── gallery.vue          # ⭐ 5th migrated
│   │   ├── calendar.vue         # ⭐ 6th migrated
│   │   └── chat.vue             # ⭐ 7th migrated (SSE streaming)
│   ├── components/
│   │   ├── tasks/               # TaskCard.vue, TaskForm.vue
│   │   ├── sessions/            # SessionRow.vue, SessionHistory.vue
│   │   ├── chat/                # MessageBubble.vue, ChatComposer.vue
│   │   ├── memory/              # MemoryCard.vue
│   │   ├── notes/               # NoteCard.vue, NoteForm.vue
│   │   ├── gallery/             # ImageCard.vue, ImageDetail.vue
│   │   └── calendar/            # EventModal.vue
│   ├── composables/
│   │   ├── useApi.ts            # typed $fetch wrapper (apiBase, mediaUrl, cookies)
│   │   ├── useTasks.ts · useSessions.ts · useMemory.ts
│   │   ├── useNotes.ts · useGallery.ts · useCalendar.ts
│   │   └── useChat.ts           # SSE stream parser over /api/chat_stream
│   ├── types/                   # tasks, sessions, memory, notes, gallery, calendar, chat
│   ├── utils/                   # schedule, sessions, memory, notes, calendar, markdown
│   └── assets/css/main.css      # Tailwind import + @theme palette
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

By default the desktop app expects the backend to be running separately (set
`NUXT_PUBLIC_API_BASE=http://127.0.0.1:7000` at build time). To ship a fully
self-contained app that launches the backend itself, build the **sidecar**:

```bash
pip install pyinstaller          # in the backend's Python env
bash scripts/build-sidecar.sh    # → src-tauri/binaries/odysseus-server-<triple>
npm run tauri:build -- -c src-tauri/tauri.sidecar.conf.json
```

The sidecar overlay (`src-tauri/tauri.sidecar.conf.json`) declares the bundled
binary as an `externalBin`. In release builds the Rust shell (`src-tauri/src/lib.rs`)
spawns it on startup (HOST=127.0.0.1, PORT=7000) and Tauri terminates it on exit.
Set `ODYSSEUS_NO_SIDECAR=1` to skip spawning (e.g. to target a remote API).
In **dev** no sidecar is spawned — the Nuxt proxy reaches your manually-run backend.

**Web bundle served by FastAPI under `/app`** (note the base URL):

```bash
NUXT_APP_BASE_URL=/app/ npm run generate   # → .output/public/
```

FastAPI auto-mounts `.output/public` at `/app` when it exists (guarded mount in
`app.py`), so the page becomes available at `http://localhost:7000/app/tasks`
next to the legacy `/tasks`.

## Desktop hardening

Configured in `src-tauri/` (Rust shell):

- **CSP** (`tauri.conf.json` → `app.security`): a strict production `csp`
  (`default-src 'self'`; `connect-src`/`img-src` limited to the backend at
  `127.0.0.1:7000` plus Tauri IPC) and a looser `devCsp` that also allows Vite
  HMR (`'unsafe-eval'`, `ws://localhost:3000`). Tauri injects per-build nonces
  into the bundled HTML's inline scripts/styles. If a strict-CSP build shows a
  blank window, relax `script-src`/`connect-src` for the blocked origin.
- **Native menu + system tray** (`src-tauri/src/lib.rs`): an app menu
  (Edit/View + "Check for Updates…"), and a tray icon with Show / Check for
  Updates / Quit; left-clicking the tray reveals the window.
- **Auto-update** (`tauri-plugin-updater`): wired but **inert until configured**.
  To enable:
  1. `npm run tauri signer generate -- -w ~/.tauri/odysseus.key`
  2. Put the **public** key in `tauri.conf.json` → `plugins.updater.pubkey`
     and set `plugins.updater.endpoints` to your update manifest URL.
  3. Build with the private key in the environment so artifacts are signed:
     `TAURI_SIGNING_PRIVATE_KEY=... TAURI_SIGNING_PRIVATE_KEY_PASSWORD=... npm run tauri:build`
     (`bundle.createUpdaterArtifacts` is already `true`).
  Never commit the private key. "Check for Updates…" (menu/tray) downloads,
  installs and restarts when a newer signed release is found.

## API base URL resolution

`useApi()` prefixes every call with `runtimeConfig.public.apiBase`:

- **web** (served by FastAPI): `apiBase = ''` → relative `/api/...`, same-origin.
- **desktop**: set `NUXT_PUBLIC_API_BASE=http://127.0.0.1:7000` at build time so
  the webview calls the local backend. This is cross-origin → FastAPI already
  allows the Tauri webview origins (`tauri://localhost`, `http://tauri.localhost`)
  by default in `app.py` (override via `ALLOWED_ORIGINS`). The backend can be run
  separately or bundled as a Tauri **sidecar** (see Build above).

## Migration roadmap (strangler)

1. ✅ **Tasks** — pilot (this PR): list, create/edit, delete, run-now,
   pause/resume, schedule labels.
2. ✅ **Sessions** — chat list: search, sort, folder grouping, star/rename/
   archive/delete, read-only history preview.
3. ✅ **Memory** — flat CRUD (list, create, inline edit, pin, delete) with
   search, category filter, sort. First Tailwind-styled page.
4. ✅ **Notes** — board with notes & checklists: create/edit, pin, archive,
   delete, item toggle, label filter, search, active/archived views.
   (Reminders/drag-reorder still legacy.)
5. ✅ **Gallery** — paginated image library: search, tag/model/album/favorites
   filters, sort, upload, favorite, rename, tag, album assign, rotate, delete.
   (AI tagging, image editor, bulk zip stay legacy.)
6. ✅ **Calendar** — month grid with per-calendar filter, event create/edit/
   delete (all-day & timed, raw RRULE); backend expands recurring occurrences.
   (CalDAV sync, import/export, LLM quick-parse stay legacy.)
7. ✅ **Chat** — SSE streaming over `/api/chat_stream`: session sidebar, new
   chat, markdown rendering (marked + DOMPurify), chat/agent/web/research/bash
   toggles, file attachments (`/api/upload` + thumbnails), character presets
   (`/api/presets`), agent tool-call display, **streamed documents**, **research
   progress + sources/findings**, web/RAG **source citations**, **memories
   used**, token metrics, stop.
8. ⬜ Retire `static/` pages as each is migrated; eventually drop `style.css`
9. ✅ Desktop integration: CORS for Tauri origins, backend sidecar, strict CSP,
   native menu + system tray, auto-update wiring (see "Desktop hardening").

**All primary pages are now migrated.** Each runs behind `/app/<page>`; once at
parity, the legacy route is flipped to redirect there, then the old code is deleted.

## What was verified

- `npm run generate` — static build succeeds (Chat, Tasks, Sessions, Memory,
  Notes, Gallery, Calendar prerendered; Tailwind utilities from the `@theme` palette).
- `npm run typecheck` — passes (TypeScript, no errors).
- `npm run tauri build --no-bundle` — release Rust shell compiles against
  webkit2gtk and produces a native binary (sidecar spawn code included).
- CORS preflight — Tauri origins allowed with credentials; others rejected.
```
