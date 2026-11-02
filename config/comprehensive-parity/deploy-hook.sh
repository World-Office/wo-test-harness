#!/bin/bash
set -e

echo "=== Comprehensive Parity Campaign - Post-Deployment Hook ==="
echo "Triggered by FINAL-001 completion"

# Build and deploy server to cloud.graphwiz.ai
cd /home/weiss/git/World-Office/server

# Rebuild Docker image
echo "Building Docker image..."
docker build -t worldoffice/documentserver:comprehensive-parity -f core/crates/wo-docserver/Dockerfile . 2>&1 | tail -5

# Deploy to production :8082
echo "Deploying to production..."
docker compose -f /home/weiss/opencloud-compose/docker-compose.yml down docserver-1 2>/dev/null || true
docker compose -f /home/weiss/opencloud-compose/docker-compose.yml up -d docserver-1 2>&1 | tail -3

# Deploy to staging :8086
echo "Deploying to staging..."
docker compose -f /home/weiss/opencloud-compose-staging/docker-compose.yml down docserver 2>/dev/null || true
docker compose -f /home/weiss/opencloud-compose-staging/docker-compose.yml up -d docserver 2>&1 | tail -3

# Deploy editor static to cloud.graphwiz.ai
echo "Deploying editor UI..."
cd /home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg
cp editor.js /home/weiss/editor-ui-ebae8fc3/word/
cp editor.js /home/weiss/editor-ui-ebae8fc3-staging/word/
echo "Editor UI deployed"

# Verify
echo "=== Verification ==="
curl -s -o /dev/null -w "Prod docserver: %{http_code}\n" http://192.168.42.42:8082/word/editor.js
curl -s -o /dev/null -w "Staging docserver: %{http_code}\n" http://192.168.42.42:8086/word/editor.js
curl -s -o /dev/null -w "cloud.graphwiz.ai: %{http_code}\n" https://editor.cloud.graphwiz.ai/word/editor.js

echo "=== Deployment Complete ==="
