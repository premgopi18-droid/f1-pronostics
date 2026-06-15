@AGENTS.md

# F1 Pronostics — Project Context

> Read this first, then read the spec file before doing anything product-related.

## Maintenance rule

When a decision is made in conversation, update `docs/product-specs.md` (the source of truth). Only update this file if the stack, status, or project structure changes.

## What this project is

Mobile-first PWA for friendly F1 prediction leagues. Users join private leagues, submit predictions before each GP weekend, earn points, and play strategic items against each other.

Built by two people (names TBD). UI language: French. Code language: English.

## Status

> **Foundation done — Next.js 16 + Supabase wired up, 16 tables migrées avec RLS. Prochaine étape : moteur de scoring (`lib/scoring/`) + route handlers.**

## Documentation (read these for details)

| File | Content |
|---|---|
| [docs/product-specs.md](docs/product-specs.md) | Full product specs — features, scoring rules, item rules, TBDs |
| [docs/data-model.md](docs/data-model.md) | Database schema — 16 tables, RLS policies, indexes, constraints |
| [docs/scoring-spec.md](docs/scoring-spec.md) | Scoring algorithm — pseudocode, worked example, edge cases |
| [docs/architecture.md](docs/architecture.md) | Code architecture — layer boundaries, patterns, execution model |

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js App Router + Tailwind CSS + shadcn/ui |
| Backend API | Next.js Route Handlers (same project) |
| Scheduled jobs | Vercel Cron Jobs |
| Database | PostgreSQL via Supabase (open source, self-hostable) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Push notifications | Web Push API |
| F1 data | Jolpica API (primary) + OpenF1 API (fallback) |
| Hosting | Vercel |

## Supabase project

| | |
|---|---|
| Project ID | `oegnropofqlzkuwleqtt` |
| Region | `eu-central-1` (Frankfurt) |
| URL | `https://oegnropofqlzkuwleqtt.supabase.co` |

Credentials are in `.env.local` (not committed).

## Git workflow

GitHub Flow : `main` toujours deployable, une branche par feature.

- Branche : `feat/<nom-court>` (ex: `feat/lib-data`, `feat/scoring-trigger`)
- Ne jamais pousser directement sur `main`
- PR pour merger, même en solo

## Naming conventions

- **Language**: all identifiers, types, functions, and variables in English — no exceptions
- **No abbreviations**: `positionsToScore` not `n`, `points` not `pts`, `results` not `res`
- **Casing**: camelCase for functions/variables, PascalCase for types/interfaces, SCREAMING_SNAKE_CASE for config constants, kebab-case for file names
- **Comments**: French is fine (UI is French, team is French)

## Key decisions

- PWA first, native app (Expo) possible later via same Supabase backend
- No proprietary lock-in — all open source, self-hostable
- No AI in the app at launch
- Scoring: Option B (exact + partial credit) — details in specs
- Items system: block pilot (offensive) + shield (defensive) — details in specs
- Supabase project name uses generic identifier (f1-pronostics) — not coupled to brand name
