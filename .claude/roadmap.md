# Roadmap

## Vision

Build an autonomous application factory — you describe a software product in plain English, and the system generates a complete, running NestJS application. The reference target is something like Twenty CRM: a full production codebase with entities, services, controllers, modules, and tests — all generated and validated by AI agents working in coordination.

---

## Phase 1 — Foundation (COMPLETE)

The pipeline exists end-to-end. A single module requirement can be submitted and processed autonomously.

- [x] Nx monorepo with generator-agent and validation-agent
- [x] generator-agent: job creation, TypeORM entity, status lifecycle
- [x] generator-agent: Claude AI integration with mock fallback (USE_CLAUDE flag)
- [x] validation-agent: 5 parallel validators with Promise.allSettled
- [x] BullMQ async job queue — POST returns immediately, worker processes in background
- [x] PostgreSQL for job persistence
- [x] Blue-green deployment with nginx (deploy-green.sh, rollback-blue.sh)
- [x] Unit tests: SecurityValidator, ValidationService, JobService
- [x] Shared library for types and database config
- [x] Docker multi-stage builds for all agents
- [x] .claude/ documentation folder (CLAUDE.md, agents.md, architecture.md, deployment.md)

---

## Phase 2 — Planner Agent (NEXT)

Make the system autonomous at the product level. Instead of submitting one module at a time manually, you describe a full product and the planner agent figures out what modules to build.

- [ ] `apps/planner-agent` — new NestJS app on port 3002
- [ ] `Product` entity: id, name, description, status, jobIds, createdAt
- [ ] Claude decomposition prompt: "Given this product description, list the NestJS modules needed"
- [ ] Mock decomposition (returns hardcoded module list when USE_CLAUDE=false)
- [ ] `POST /api/products` — creates product, calls Claude, submits one job per module
- [ ] `GET /api/products/:id` — aggregates all job statuses to show overall progress
- [ ] Add planner-agent to docker-compose (blue-green slots)
- [ ] nginx routing: `/api/products` → planner-agent
- [ ] Unit tests for decomposition service and product service

**What this unlocks:** You can say "build me a CRM" and the system creates contacts, deals, auth, and pipeline modules automatically — no manual job submission.

---

## Phase 3 — File Writer Agent

Make the output real. Currently generated code is a string in a database. This phase writes it to actual `.ts` files in a proper NestJS project structure on disk.

- [ ] `apps/file-writer-agent` — new NestJS app on port 3003
- [ ] Output scaffold: create standard NestJS project structure for a new product
- [ ] Code parser: split generated code into controller, service, entity, module files
- [ ] File writer: write parsed files to `output/{productId}/{moduleName}/`
- [ ] Register a `file-writing` BullMQ queue — triggered after validation passes
- [ ] `GET /api/products/:id/download` — zip the output folder and return it
- [ ] Add file-writer-agent to docker-compose with a volume mount for output

**What this unlocks:** At the end of a product generation run, you get a real downloadable NestJS project — not just database records.

---

## Phase 4 — Orchestrator Agent

Add intelligence to the pipeline coordination. Instead of agents calling each other directly in a chain, an orchestrator observes all events and manages the workflow.

- [ ] `apps/orchestrator-agent` — new NestJS app on port 3004
- [ ] Redis pub/sub: agents publish events (`job.completed`, `job.failed`, `product.planned`)
- [ ] Orchestrator subscribes to events and decides what happens next
- [ ] Retry logic: failed jobs are retried up to 3 times with exponential backoff
- [ ] Escalation: after 3 failures, product status set to `intervention-required`
- [ ] Dashboard endpoint: `GET /api/dashboard` — all products, all jobs, pipeline health
- [ ] Remove direct HTTP calls between agents — replace with event-driven flow

**What this unlocks:** The system handles failures gracefully. One bad module doesn't block the rest. The pipeline is observable and self-healing.

---

## Phase 5 — Product Quality

Harden the system for a real demo or handoff to a client.

- [ ] Authentication on all agent APIs (API key middleware)
- [ ] Rate limiting (prevent Claude token abuse)
- [ ] Real database migrations (replace TYPEORM_SYNC with TypeORM migrations)
- [ ] Integration tests for the full pipeline (planner → generator → validator → file-writer)
- [ ] CI pipeline: GitHub Actions — test → build → docker build on every push
- [ ] Proper secrets management (no passwords in docker-compose.yml)
- [ ] Monitoring: health check endpoints on all agents, structured JSON logging

---

## Reference Inspirations

- **Twenty CRM** (github.com/twentyhq/twenty) — open source CRM with clean NestJS backend. The kind of full codebase this factory should be able to generate.
- **AgentGPT / AutoGPT** — autonomous agent loops that decompose goals into tasks. The planner-agent follows this pattern.
- **Nx** — monorepo tooling that makes multi-agent projects manageable without the overhead of separate repos.
