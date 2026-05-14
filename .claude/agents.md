# Agent Contracts

Each agent is an independent NestJS application with its own Dockerfile, database entities, and responsibility boundary. Agents communicate over HTTP and Redis queues — never by importing each other's code directly.

---

## generator-agent

**Port:** 3000 (container), 3000 (local)
**Dockerfile:** `apps/generator-agent/Dockerfile`
**Responsibility:** Accepts product requirements, enqueues generation jobs, tracks job lifecycle in PostgreSQL.

### API

#### POST /api/jobs
Submit a new code generation job. Returns immediately — job is queued.

```
Request:  { clientName: string, requirement: string }
Response: Job { id, clientName, requirement, status: "pending", generatedCode: null, ... }
```

#### GET /api/jobs
List all jobs, newest first.

#### GET /api/jobs/:id
Poll for job result. Status transitions: pending → generating → validating → done | failed.

### BullMQ Queue: `generation`

The `job.processor.ts` worker listens on this queue. For each job it:
1. Updates status to `generating`
2. Calls `GeneratorService.generate(requirement)` — mock or real Claude
3. Updates status to `validating`, saves `generatedCode`
4. POSTs to `validation-agent /api/validate`
5. Updates final status to `done` or `failed` based on `overallPassed`

### Entities
- **Job** — `id (uuid), clientName, requirement, status, generatedCode, errorMessage, createdAt, updatedAt`

### Environment
- `USE_CLAUDE=true` — enables real Claude API (default: false, uses mock)
- `CLAUDE_API_KEY` — Anthropic API key
- `VALIDATION_AGENT_URL` — where to POST generated code (default: http://localhost:3001)
- `REDIS_HOST`, `REDIS_PORT` — BullMQ connection

---

## validation-agent

**Port:** 3000 (container), 3001 (local)
**Dockerfile:** `apps/validation-agent/Dockerfile`
**Responsibility:** Runs 5 code quality validators in parallel, returns a scored report.

### API

#### POST /api/validate
Run all validators against generated code.

```
Request:  { jobId: string, code: string }
Response: ValidationReport {
  jobId: string,
  overallPassed: boolean,        // true only if ALL validators pass
  overallScore: number,          // 0-100, average of all validator scores
  results: ValidationResult[],   // one entry per validator
  validatedAt: Date
}
```

### Validators (run in parallel via Promise.allSettled)

| Validator | What it checks | Fail condition |
|-----------|---------------|----------------|
| SecurityValidator | eval(), hardcoded secrets, missing guards | Any issue found |
| ArchitectureValidator | NestJS module structure, decorators | Missing @Module, @Controller, @Injectable |
| PerformanceValidator | N+1 queries, missing pagination | findAll() without pagination |
| TypeScriptValidator | `any` types, missing return types | `any` used in code |
| TestCoverageValidator | Presence of test files | No `.spec.ts` reference in code |

Each validator returns: `{ validator, passed, score, issues[], suggestions[] }`

Score formula: `100 - (issues.length * 30) - (suggestions.length * 5)`, minimum 0.

### No database — stateless
validation-agent holds no state. It receives code, validates it, returns the report. The job status update happens in generator-agent after it receives the report.

---

## planner-agent (planned)

**Port:** 3002
**Dockerfile:** `apps/planner-agent/Dockerfile`
**Responsibility:** Decomposes a product description into a list of modules, creates one Job per module in generator-agent.

### API (planned)

#### POST /api/products
Submit a product for autonomous generation.

```
Request:  { name: string, description: string }
Response: Product { id, name, description, status: "planning", modules: [] }
```

#### GET /api/products/:id
Poll for overall product progress. Shows status of each module job.

### How it will work
1. Receives product description
2. Calls Claude with a decomposition prompt — returns list of module names
3. Creates a `Product` record in DB
4. POSTs one job to `generator-agent /api/jobs` per module
5. Stores job IDs on the Product entity
6. `GET /api/products/:id` aggregates all job statuses to compute overall product status

### Entities (planned)
- **Product** — `id, name, description, status, jobIds[], createdAt, updatedAt`

---

## file-writer-agent (planned)

**Port:** 3003
**Dockerfile:** `apps/file-writer-agent/Dockerfile`
**Responsibility:** Takes validated generated code and writes it to actual `.ts` files inside a scaffolded NestJS project on disk.

### How it will work
1. Listens on a `file-writing` BullMQ queue
2. Receives `{ productId, moduleName, code }` 
3. Scaffolds a NestJS project structure if it doesn't exist
4. Parses the generated code into separate files (controller, service, entity, module)
5. Writes files to `output/{productId}/{moduleName}/`
6. Updates job status to `written`

---

## orchestrator-agent (planned)

**Port:** 3004
**Responsibility:** Top-level coordinator. Runs the full pipeline — planner → generator → validator → file-writer — with retry logic and error recovery.

### How it will work
- Subscribes to job status change events via Redis pub/sub
- When a job reaches `done`, triggers file-writer
- When a job reaches `failed`, triggers retry or escalates
- Tracks overall product health and reports pipeline progress
