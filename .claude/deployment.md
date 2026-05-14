# Deployment Guide

## Infrastructure Overview

All services run in Docker containers managed by Docker Compose. nginx sits in front and routes all traffic. Two identical application slots (blue and green) allow zero-downtime deployments.

```
Host port 80  →  nginx  →  generator-agent-{blue|green}:3000
                       →  validation-agent-{blue|green}:3000

Host port 5433  →  postgres:5432  (shared, not blue-green)
Host port 6379  →  redis:6379     (shared, not blue-green)
```

---

## Starting From Scratch

```bash
# 1. Clone and install
git clone git@github.com:hgurung/ai-application-factory.git
cd ai-application-factory
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env if needed (CLAUDE_API_KEY, etc.)

# 3. Start everything
docker compose up -d --build

# 4. Verify
curl http://localhost/health        # should return: nginx ok
curl http://localhost/api/jobs      # should return: []
```

---

## Normal Deployment (blue is live → deploy to green)

```bash
./deploy-green.sh
```

What this script does, step by step:
1. Builds green containers with latest code (`docker compose --profile green up -d --build`)
2. Health checks green — polls `GET /api` inside the container until it responds (up to 30s)
3. Writes new nginx config pointing to green directly into the container (bypasses VirtioFS)
4. Runs `nginx -t` inside the container to confirm config is valid before reloading
5. Reloads nginx gracefully — in-flight requests on blue finish, new requests go to green
6. Stops blue containers

If step 2 fails (green never becomes healthy), the script exits and blue stays live. Green is stopped automatically.

---

## Rollback (green is live → rollback to blue)

```bash
./rollback-blue.sh
```

What this script does:
1. Starts blue containers (they were stopped, not destroyed — their image is still cached)
2. Writes nginx config pointing back to blue directly into the container
3. Reloads nginx
4. Stops green containers

Rollback takes about 10-15 seconds. Blue comes back on the same image it was running before — no rebuild.

---

## Checking What's Running

```bash
# All containers and their status
docker compose ps

# Which slot nginx is currently routing to
docker compose exec nginx cat /etc/nginx/nginx.conf | grep "server generator"

# Live logs from the active generator
docker compose logs generator-agent-blue -f    # if blue is live
docker compose logs generator-agent-green -f   # if green is live

# Check BullMQ queue depth (jobs waiting to be processed)
docker compose exec redis redis-cli llen bull:generation:wait
```

---

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| USE_CLAUDE | No | false | Set to `true` to use real Claude API |
| CLAUDE_API_KEY | If USE_CLAUDE=true | - | Get from console.anthropic.com |
| POSTGRES_HOST | Yes | localhost | `postgres` inside Docker |
| POSTGRES_PORT | Yes | 5433 | Host port. Container port is always 5432 |
| POSTGRES_USER | Yes | agent | |
| POSTGRES_PASSWORD | Yes | password | Change in production |
| POSTGRES_DB | Yes | agentdb | |
| TYPEORM_SYNC | No | false | Set `true` to auto-create tables |
| REDIS_HOST | Yes | localhost | `redis` inside Docker |
| REDIS_PORT | Yes | 6379 | |
| VALIDATION_AGENT_URL | Yes | http://localhost:3001 | `http://validation-agent-blue:3000` inside Docker |

---

## Wiping and Starting Clean

```bash
# Stop everything and delete all data (postgres volume included)
docker compose down -v

# Then start fresh
docker compose up -d --build
```

Use this when you hit database errors like "role does not exist" or "relation does not exist" — these are caused by stale postgres volumes from a previous setup with different credentials.

---

## Common Issues

**nginx fails to start**
The nginx.conf references a container hostname that isn't running (e.g. `generator-agent-green` when green profile isn't active). Fix: check `nginx/nginx.conf` and make sure it points to the currently running slot (blue by default).

**"relation jobs does not exist"**
TypeORM sync hasn't run. Make sure `TYPEORM_SYNC=true` is set in the environment for generator-agent. Check with `docker compose exec generator-agent-blue env | grep TYPEORM`.

**BullMQ jobs stuck in queue**
The generator-agent processor is not running. Check logs: `docker compose logs generator-agent-blue`. Usually a Redis connection error or a startup crash.

**Port 5432 conflict on Mac**
Local PostgreSQL is using 5432. The Docker postgres is mapped to 5433 to avoid this — if you see connection refused on 5432, confirm your `.env` has `POSTGRES_PORT=5433`.

**deploy-green.sh health check fails**
Green containers started but the app isn't responding. Check: `docker compose logs generator-agent-green`. Common causes: TypeORM sync error, Redis connection error, port conflict.
