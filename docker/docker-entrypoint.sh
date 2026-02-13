#!/bin/sh
set -e

echo "Running database migrations..."
node /app/apps/api/dist/migrate.js 2>&1 || {
  echo "Warning: Migration failed, retrying in 5 seconds..."
  sleep 5
  node /app/apps/api/dist/migrate.js 2>&1 || echo "Migration retry failed. Starting server anyway..."
}

echo "Starting OpenFrame API..."
exec "$@"
