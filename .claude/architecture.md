# Architecture Decisions

This document explains the significant technical decisions made in this project — not what was built, but why it was built that way. Understanding the reasoning helps you make consistent decisions when extending the system.

---

## Why a monorepo (Nx) instead of separate repos per agent?

Each agent is a separate NestJS application, but they share types (`ValidationResult`, `ValidationReport`) and config (`databaseConfig`). With separate repos, sharing code means publishing npm packages, versioning them, and keeping them in sync — a lot of overhead for an early-stage system.

Nx monorepo gives us:
- Shared code in `shared/` imported as `@agent-pipeline/shared` — no publishing, no versioning
- One `package.json` — all agents use the same dependency versions
- `npx nx run-many --target=build` builds all apps in parallel with dependency awareness
- Each app still has its own Dockerfile and deploys independently

The tradeoff: the monorepo gets large as agents are added. This is acceptable until the team and codebase size justifies splitting.

---

## Why BullMQ (async queue) instead of direct HTTP between agents?

The first version called validation-agent synchronously during the HTTP request — the client waited the full generate + validate time (1-3 seconds) before getting a response. This causes problems at scale:

- **Timeout risk** — if Claude generation takes 10+ seconds, the HTTP connection times out
- **No retry** — if validation-agent is down, the job fails permanently
- **No backpressure** — 100 simultaneous requests all try to call Claude simultaneously

With BullMQ + Redis:
- `POST /api/jobs` returns in milliseconds — just saves to DB and enqueues
- Worker processes jobs at its own pace — naturally limits concurrency
- Built-in retry on failure — configurable attempts and backoff
- Queue is observable — you can see pending/active/failed jobs in Redis

The tradeoff: the API becomes asynchronous, so clients must poll `GET /api/jobs/:id` for results. This is the correct pattern for long-running operations.

---

## Why Promise.allSettled instead of Promise.all for validation?

`Promise.all` fails fast — if one validator throws, the entire validation fails and other validators never complete.

`Promise.allSettled` waits for every promise regardless of outcome. Each validator result is independently fulfilled or rejected. If the TypeScriptValidator crashes due to a bug, the other 4 validators still run and return their scores.

This matters because:
- Partial validation is better than no validation — a score of 4/5 validators is useful
- Validator bugs don't hide results from other validators
- Crashed validators are marked as failed in the report with an error message, not silently swallowed

---

## Why mock-first for Claude API?

Building and testing against the real Claude API:
- Burns tokens on every test run
- Requires internet connection
- Makes tests slow and non-deterministic (responses vary)
- Costs money during development

The mock generator returns a deterministic NestJS snippet instantly. It lets the entire pipeline (queue → generate → validate → status update) be tested end-to-end with no API key and no cost.

`USE_CLAUDE=true` switches to the real API for demo or production. The `GeneratorService` checks this flag once at startup and routes accordingly.

---

## Why blue-green deployment instead of rolling updates?

Rolling updates replace containers one at a time — during the rollout, you have a mix of old and new versions handling requests simultaneously. For a stateful system (database schema changes, breaking API changes) this creates data inconsistency risk.

Blue-green keeps two complete identical environments. At any moment, only one is live. The switch is a single nginx reload — atomic from the client's perspective. If something is wrong with green, rolling back is another nginx reload. The old blue environment is intact and ready.

The tradeoff: blue-green uses 2x infrastructure during the switchover window. For this project that's acceptable — containers are cheap and the window is seconds.

---

## Why write nginx config directly into the container instead of via bind mount?

Docker Desktop on macOS uses VirtioFS to sync files between the Mac host and the Linux VM running Docker. When a file is written on the Mac host, VirtioFS syncs it to the VM — but this sync has a timing window. nginx inside the container can read a partially-synced (truncated) file if it reloads during that window.

Writing directly via `docker compose exec -T nginx sh -c 'cat > /etc/nginx/nginx.conf'` bypasses the bind mount entirely — the data goes straight into the container's overlay filesystem, which is always consistent.

The host-side `nginx/nginx.conf` is also updated so the config survives container restarts (the bind mount is the source of truth on startup).

---

## Why PostgreSQL on port 5433?

macOS ships with PostgreSQL and it defaults to port 5432. If you're developing locally with a local Postgres instance running, Docker's postgres would conflict on 5432 and fail to start.

Port 5433 on the host maps to 5432 inside the container — so the container itself still uses the standard Postgres port. Only the host-side binding changes.

---

## Agent communication pattern

Agents communicate in two ways:

1. **HTTP** — for synchronous request/response. generator-agent calls validation-agent via HTTP to submit code for validation and get a report back. This is appropriate here because the validation result is needed immediately to determine the final job status.

2. **BullMQ (Redis)** — for async work. The generator-agent HTTP endpoint enqueues jobs to the `generation` queue. Workers process them independently. This decouples the API response time from the work time.

As more agents are added, the pattern will evolve:
- planner-agent → generator-agent: HTTP (create jobs)
- generator-agent → validation-agent: HTTP (validate code)  
- validation-agent → file-writer-agent: BullMQ (async file writing, no immediate response needed)
- orchestrator-agent → all: Redis pub/sub (observing events, not triggering direct calls)

---

## Database strategy

Currently all agents that need persistence connect to the same PostgreSQL instance. Each agent owns its own tables — generator-agent owns `jobs`, planner-agent will own `products`. No agent reads another agent's tables directly.

As the system scales, each agent would get its own database. The shared `databaseConfig()` in the `shared` library makes this easy to change — just point each agent's `POSTGRES_HOST` env var to a different instance.

`TYPEORM_SYNC=true` is used in all containers. This auto-creates and updates tables on startup based on entity definitions. This is acceptable in a development/demo project. In production with real user data, migrations would replace sync.
