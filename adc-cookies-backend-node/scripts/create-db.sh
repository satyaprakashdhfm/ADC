#!/usr/bin/env bash
#
# Creates the ADC Cookies PostgreSQL database (idempotent).
#
# The app's tables are created automatically on startup by initSchema() in
# src/db.js — this script only creates the database itself and assigns ownership,
# which requires PostgreSQL superuser rights.
#
# Usage:
#   ./scripts/create-db.sh
#
# It reads PGDATABASE / PGUSER from the backend .env (falling back to sensible
# defaults) and runs CREATE DATABASE as the "postgres" superuser via sudo, so it
# will prompt for your sudo password.
#
set -euo pipefail

# Resolve paths relative to this script so it works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Load PGDATABASE / PGUSER from .env if present.
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_NAME="${PGDATABASE:-adccookies}"
DB_OWNER="${PGUSER:-$USER}"

echo "Ensuring database '$DB_NAME' (owner '$DB_OWNER') exists..."

# Does the role exist? Create it if not (so ownership can be assigned).
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_OWNER'")"
if [[ "$ROLE_EXISTS" != "1" ]]; then
  echo "Role '$DB_OWNER' not found — creating it (LOGIN, CREATEDB)."
  sudo -u postgres psql -c "CREATE ROLE \"$DB_OWNER\" LOGIN CREATEDB;"
fi

# Does the database already exist?
DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")"
if [[ "$DB_EXISTS" == "1" ]]; then
  echo "Database '$DB_NAME' already exists — nothing to do."
else
  sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_OWNER\";"
  echo "Created database '$DB_NAME' owned by '$DB_OWNER'."
fi

echo "Done. Now run:  npm start   (tables are created + seeded on first boot)"
