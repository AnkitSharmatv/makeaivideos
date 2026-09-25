# MakeAiVideos — working notes for coding agents

A self-hosted studio for generating images and videos from one prompt bar, using
the user's own provider API keys. Everything — accounts, encrypted keys, projects,
generated files — stays on the machine that runs it.

## Setup and run

```bash
pnpm install   # Node 20.9+, pnpm 10 (corepack enable)
pnpm dev       # http://localhost:3000
```

First visit creates the admin account. No env file is required; see `.env.example`
for the optional variables.

## Before you call any change done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

All four must pass. `pnpm test` covers provider request mapping, status
normalization, pricing and the server layer (crypto, accounts, SQLite repo).

## Never commit user data

`data/` (SQLite database, encrypted provider keys, uploads, generated media),
`.env.local` and `LICENSED-TO.txt` are gitignored and must stay that way. A
pre-commit guard enforces it — turn it on once per clone:

```bash
git config core.hooksPath .githooks
```

## Rules

- **Never touch `data/`.** It holds the user's SQLite database, their encrypted
  provider keys, their uploads and every generated file. Nothing in the repo may
  read, move or delete it except the code in `src/server/` that owns it.
- **Provider keys never reach the browser.** All provider traffic goes through
  server actions in `src/generation/` and `src/keys/`. Don't add a client fetch to
  a provider.
- **The catalog is the source of truth.** No component may hardcode a model list,
  aspect ratio, duration or price — those come from `ModelSpec`.
- **TypeScript strict, no `any`.** Plain CSS using the tokens in
  `src/design/tokens.css`; no Tailwind, no UI kit.
- **Don't log request bodies or headers.** They carry API keys and passwords.
  `logging.serverFunctions` is off in `next.config.ts` for exactly this reason.

## Layout

```
src/
  app/          routes: page.tsx, api/upload, api/files, api/thumb
  server/       db.ts (SQLite + schema), auth.ts, crypto.ts, keys.ts, repo.ts, files.ts
  auth/ keys/ data/   server actions the client calls
  providers/    types.ts (the one interface), index.ts (registry), kie/ fal/ higgsfield/
  generation/   actions.ts (submit/poll/cancel/estimate/completeRun), lifecycle.ts, pricing.ts, media.ts
  uploads/      per-provider upload backends
  stores/       zustand: session, ui, keys, projects, library, uploads, prompts, model, prompt, undo
  studio/       composer/, picker/, settings-rail/, gallery/, projects/, viewer/, models/, key-modal/
```

## Adding a model

Add one entry to `src/providers/<provider>/catalog.ts`: `id`, `kind`, declared
`settings[]` (the UI renders exactly these), `media[]` roles, `batch`, `price`, and
a `body()` that maps resolved settings into that provider's request shape. Record
what you verified against the provider's docs in that provider's `README.md`.
Nothing else changes — the picker, settings rail, cost hint and media slots all
read from the catalog.

## Updating an installed copy

See `UPDATE.md`. Back up `data/` first; migrations run forward automatically at boot.
