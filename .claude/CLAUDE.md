# AI Application Factory — Project Context

## What This Project Is

An autonomous code generation pipeline. You describe a software product in plain English, and a network of AI agents breaks it down into modules, generates production-ready NestJS code for each one, validates the output across 5 quality dimensions in parallel, and writes the result to real files on disk.

The end goal is a system similar to Twenty CRM — where a full working NestJS monorepo application is the output, not just a code snippet in a database.

## Current State (what is built and working)

- **generator-agent** — NestJS app. Accepts `POST /api/jobs`, saves job to PostgreSQL, enqueues it into Redis via BullMQ, returns immediately. A background worker processes the job: calls Claude AI (or mock), sends generated code to validation-agent, updates job status.
- **validation-agent** — NestJS app. Accepts `POST /api/validate`. Runs 5 validators in parallel using `Promise.allSettled()`: SecurityValidator, ArchitectureValidator, PerformanceValidator, TypeScriptValidator, TestCoverageValidator. Returns a ValidationReport with scores and issues per validator.
- **shared** — Nx library. Contains `databaseConfig()`, `ValidationResult`, and `ValidationReport` types used by both agents.
- **Blue-green deployment** — `./deploy-green.sh` and `./rollback-blue.sh`. nginx routes all traffic. Green slot is built and health-checked before nginx switches. Zero downtime.
- **Unit tests** — SecurityValidator (8 cases), ValidationService (6 cases), JobService (5 cases).

## What Is Being Built Next

1. **planner-agent** — Takes `POST /api/products` with a product name and description. Uses Claude to decompose it into a list of modules. Creates one Job per module in generator-agent. Tracks overall product progress via a `Product` entity.
2. **file-writer-agent** — Takes validated generated code and writes it to actual `.ts` files in a scaffolded NestJS project on disk.
3. **orchestrator-agent** — Top-level coordinator that runs the full pipeline: planner → generator → validator → file-writer in sequence, with retry logic.

## Monorepo Structure

```
apps/
  generator-agent/        # Handles job creation and code generation
    src/job/
      job.controller.ts   # POST /api/jobs, GET /api/jobs, GET /api/jobs/:id
      job.service.ts      # TypeORM CRUD for Job entity
      job.processor.ts    # BullMQ worker — generate → validate → update
      job.entity.ts       # Job: id, clientName, requirement, status, generatedCode
      generator.service.ts # Claude API call or mock (USE_CLAUDE=true to use real)
  validation-agent/       # Parallel validation pipeline
    src/validation/
      validation.service.ts        # Orchestrates all 5 validators with Promise.allSettled
      validators/
        security.validator.ts
        architecture.validator.ts
        performance.validator.ts
        typescript.validator.ts
        test-coverage.validator.ts
shared/
  src/lib/
    database.config.ts    # Shared TypeORM config — used by all agents
    validation.types.ts   # ValidationResult, ValidationReport interfaces
nginx/
  nginx.conf              # Swapped by deploy scripts between blue/green upstreams
```

## Key Technical Decisions

- **Mock-first for Claude** — `USE_CLAUDE=false` by default. Set `USE_CLAUDE=true` + `CLAUDE_API_KEY` to use real API. Do not burn tokens during development.
- **BullMQ over direct HTTP** — jobs are async. POST returns immediately with `status: pending`. Client polls `GET /api/jobs/:id`.
- **Promise.allSettled for validation** — all 5 validators run in parallel. If one crashes, others still complete. Crashed validator is marked failed without taking down the report.
- **Blue-green via nginx exec** — config is written directly into the container with `docker compose exec -T nginx sh -c 'cat >'` to avoid VirtioFS bind-mount truncation bug on macOS Docker Desktop.
- **TYPEORM_SYNC=true in containers** — auto-creates tables. Never use in production with real data.
- **Postgres on port 5433** — avoids conflict with local Mac PostgreSQL running on 5432.

## Running the Project

```bash
# Start all services (blue slot + infrastructure)
docker compose up -d --build

# Deploy to green (zero downtime)
./deploy-green.sh

# Rollback to blue instantly
./rollback-blue.sh

# Run all unit tests
npx nx run-many --target=test --projects=generator-agent,validation-agent

# Build all apps
npx nx run-many --target=build --projects=generator-agent,validation-agent
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| USE_CLAUDE | false | Toggle real Claude API |
| CLAUDE_API_KEY | - | Anthropic API key |
| POSTGRES_HOST | localhost | DB host |
| POSTGRES_PORT | 5433 | 5433 to avoid conflict with local Mac postgres |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| VALIDATION_AGENT_URL | http://localhost:3001 | Where generator sends code for validation |

## Conventions

- All agents run on port 3000 internally. validation-agent uses 3001 locally (outside Docker) to avoid conflict with generator-agent.
- `process.env['KEY']` bracket notation required — TypeScript strict mode.
- No comments in code unless the WHY is non-obvious.
- Each agent has its own Dockerfile using multi-stage builds: deps → builder → runner.
- Nx manages builds, tests, and task dependencies across apps.
