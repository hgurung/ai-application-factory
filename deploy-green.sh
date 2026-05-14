#!/bin/bash
# deploy-green.sh - deploy new version to green, switch nginx, stop blue

set -e

echo "Starting blue-green deployment..."
echo "Step 1: Starting GREEN containers..."

docker compose --profile green up -d --build generator-agent-green validation-agent-green planner-agent-green

echo "Step 2: Waiting for GREEN to be healthy..."

MAX_RETRIES=10
COUNT=0
until docker compose exec generator-agent-green wget -q -O- http://localhost:3000/api > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "GREEN failed health check - rolling back"
    docker compose --profile green stop generator-agent-green validation-agent-green planner-agent-green
    exit 1
  fi
  echo "   Waiting... attempt ${COUNT}/${MAX_RETRIES}"
  sleep 3
done

echo "GREEN is healthy!"
echo "Step 3: Switching nginx to GREEN..."

# Update nginx.conf on the host to point to green upstreams
cat > nginx/nginx.conf << 'NGINXEOF'
events {
  worker_connections 1024;
}

http {
  upstream generator_active {
    server generator-agent-green:3000;
  }
  upstream validation_active {
    server validation-agent-green:3000;
  }
  upstream planner_active {
    server planner-agent-green:3000;
  }
  upstream file_writer {
    server file-writer-agent:3000;
  }

  server {
    listen 80;

    location /api/write {
      proxy_pass http://file_writer;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/products {
      proxy_pass http://planner_active;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/jobs {
      proxy_pass http://generator_active;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/validate {
      proxy_pass http://validation_active;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
      return 200 'nginx ok';
      add_header Content-Type text/plain;
    }
  }
}
NGINXEOF

# Rebuild nginx image with new config baked in, then recreate container
docker compose up -d --build nginx
echo "nginx switched to GREEN"

echo "Step 4: Stopping BLUE containers..."
docker compose stop generator-agent-blue validation-agent-blue planner-agent-blue

echo ""
echo "Deployment complete! GREEN is now live."
echo "Rollback anytime: ./rollback-blue.sh"
