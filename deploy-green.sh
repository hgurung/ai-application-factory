#!/bin/bash
# deploy-green.sh - deploy new version to green, switch nginx, stop blue

set -e

echo "Starting blue-green deployment..."
echo "Step 1: Starting GREEN containers..."

docker compose --profile green up -d --build generator-agent-green validation-agent-green

echo "Step 2: Waiting for GREEN to be healthy..."

MAX_RETRIES=10
COUNT=0
until docker compose exec generator-agent-green wget -q -O- http://localhost:3000/api > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "GREEN failed health check - rolling back"
    docker compose --profile green stop generator-agent-green validation-agent-green
    exit 1
  fi
  echo "   Waiting... attempt ${COUNT}/${MAX_RETRIES}"
  sleep 3
done

echo "GREEN is healthy!"
echo "Step 3: Switching nginx to GREEN..."

# Write config directly into the container (bypasses VirtioFS bind-mount sync lag on macOS)
docker compose exec -T nginx sh -c 'cat > /etc/nginx/nginx.conf' << 'EOF'
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

  server {
    listen 80;

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
EOF

# Also update the host-side file so it matches (for next container restart)
cat > nginx/nginx.conf << 'EOF'
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

  server {
    listen 80;

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
EOF

docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
echo "nginx switched to GREEN"

echo "Step 4: Stopping BLUE containers..."
docker compose stop generator-agent-blue validation-agent-blue

echo ""
echo "Deployment complete! GREEN is now live."
echo "Rollback anytime: ./rollback-blue.sh"
