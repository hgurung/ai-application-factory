#!/bin/bash
# rollback-blue.sh - switch nginx back to blue, stop green

set -e

echo "Rolling back to BLUE..."

echo "Step 1: Starting BLUE containers (if stopped)..."
docker compose up -d generator-agent-blue validation-agent-blue planner-agent-blue

echo "Step 2: Switching nginx back to BLUE..."

cat > nginx/nginx.conf << 'NGINXEOF'
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
  upstream planner_active {
    server planner-agent-blue:3000;
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
echo "nginx switched to BLUE"

echo "Step 3: Stopping GREEN containers..."
docker compose --profile green stop generator-agent-green validation-agent-green planner-agent-green

echo ""
echo "Rollback complete! BLUE is live again."
