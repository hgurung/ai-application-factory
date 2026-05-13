#!/bin/bash
# rollback-blue.sh - switch nginx back to blue, stop green

set -e

echo "Rolling back to BLUE..."

echo "Step 1: Starting BLUE containers (if stopped)..."
docker compose up -d generator-agent-blue validation-agent-blue

echo "Step 2: Switching nginx back to BLUE..."

# Write config directly into the container (bypasses VirtioFS bind-mount sync lag on macOS)
docker compose exec -T nginx sh -c 'cat > /etc/nginx/nginx.conf' << 'EOF'
events {
  worker_connections 1024;
}

http {
  upstream generator_active {
    server generator-agent-blue:3000;
  }
  upstream validation_active {
    server validation-agent-blue:3000;
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
    server generator-agent-blue:3000;
  }
  upstream validation_active {
    server validation-agent-blue:3000;
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
echo "nginx switched to BLUE"

echo "Step 3: Stopping GREEN containers..."
docker compose --profile green stop generator-agent-green validation-agent-green

echo ""
echo "Rollback complete! BLUE is live again."
