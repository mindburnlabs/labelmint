#!/bin/bash

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"
REMOTE_DB_URL="${REMOTE_DB_URL:-}"

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        error "Supabase CLI is not installed. Please install it first:"
        echo "  macOS: brew install supabase/tap/supabase"
        echo "  Other: https://supabase.com/docs/guides/cli"
        exit 1
    fi

    # Check if logged in
    if ! supabase projects list &> /dev/null; then
        error "Not logged in to Supabase. Please run: supabase login"
        exit 1
    fi

    # Check required environment variables
    if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
        error "SUPABASE_PROJECT_REF environment variable is required"
        exit 1
    fi

    if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
        error "SUPABASE_ACCESS_TOKEN environment variable is required"
        exit 1
    fi

    success "Prerequisites check passed"
}

# Initialize Supabase project
init_supabase() {
    log "Initializing Supabase project..."

    if [[ ! -d "supabase" ]]; then
        supabase init
        success "Supabase project initialized"
    else
        warning "Supabase project already initialized"
    fi

    # Link to remote project if not already linked
    if [[ ! -f "supabase/.branches/_current_branch" ]]; then
        supabase link --project-ref "$SUPABASE_PROJECT_REF"
        success "Linked to remote Supabase project"
    fi
}

# Start local development
start_local() {
    log "Starting local Supabase development..."

    supabase start

    success "Local Supabase started successfully"
    log "Studio URL: http://localhost:54323"
    log "API URL: http://localhost:54321"
}

# Stop local development
stop_local() {
    log "Stopping local Supabase development..."

    supabase stop

    success "Local Supabase stopped"
}

# Generate migration from schema changes
generate_migration() {
    local name="${1:-new_migration}"

    log "Generating migration: $name"

    supabase db diff --use-migra --schema public > "supabase/migrations/$(date +%Y%m%d%H%M%S)_$name.sql"

    success "Migration generated: supabase/migrations/$(date +%Y%m%d%H%M%S)_$name.sql"
}

# Apply migrations locally
apply_migrations_local() {
    log "Applying migrations locally..."

    supabase db reset

    success "Local migrations applied"
}

# Push migrations to remote
push_migrations() {
    log "Pushing migrations to remote..."

    # Confirm before pushing to production
    read -p "This will push changes to PRODUCTION. Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        warning "Migration push cancelled"
        exit 0
    fi

    supabase db push

    success "Migrations pushed to remote"
}

# Pull remote schema
pull_schema() {
    log "Pulling remote schema..."

    supabase db diff --use-migra --schema public --remote > "supabase/migrations/$(date +%Y%m%d%H%M%S)_remote_schema.sql"

    success "Remote schema pulled"
}

# Generate types
generate_types() {
    local output_dir="${1:-./src/types}"

    log "Generating TypeScript types..."

    mkdir -p "$output_dir"

    # Generate database types
    supabase gen types typescript --local > "$output_dir/supabase.ts"

    success "TypeScript types generated in $output_dir/supabase.ts"
}

# Seed local database
seed_local() {
    log "Seeding local database..."

    if [[ -f "scripts/seed-database.sql" ]]; then
        supabase db reset < scripts/seed-database.sql
        success "Local database seeded"
    else
        warning "Seed file not found at scripts/seed-database.sql"
    fi
}

# Backup remote database
backup_remote() {
    local backup_file="${1:-backup_$(date +%Y%m%d_%H%M%S).sql}"

    log "Creating backup of remote database..."

    supabase db dump --data-only --db-url "$REMOTE_DB_URL" > "$backup_file"

    success "Backup created: $backup_file"
}

# Restore backup to local
restore_backup() {
    local backup_file="${1:-}"

    if [[ -z "$backup_file" ]]; then
        error "Backup file path is required"
        exit 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi

    log "Restoring backup from $backup_file..."

    supabase db reset < "$backup_file"

    success "Backup restored to local database"
}

# Reset local database
reset_local() {
    log "Resetting local database..."

    supabase db reset

    success "Local database reset"
}

# Show status
show_status() {
    log "Supabase Status:"
    echo

    supabase status
    echo

    if [[ -f "supabase/.branches/_current_branch" ]]; then
        echo "Linked Project: $(cat supabase/.branches/_current_branch)"
    fi

    echo "Current User: $(supabase projects list --format json | jq -r '.[] | select(.id == "'"$SUPABASE_PROJECT_REF"'") | .name')"
}

# Main menu
main() {
    case "${1:-}" in
        "init")
            check_prerequisites
            init_supabase
            ;;
        "start")
            check_prerequisites
            start_local
            ;;
        "stop")
            stop_local
            ;;
        "migrate"|"migration")
            generate_migration "${2:-}"
            ;;
        "push")
            check_prerequisites
            push_migrations
            ;;
        "pull")
            check_prerequisites
            pull_schema
            ;;
        "apply")
            apply_migrations_local
            ;;
        "types")
            generate_types "${2:-./src/types}"
            ;;
        "seed")
            seed_local
            ;;
        "backup")
            check_prerequisites
            backup_remote "${2:-}"
            ;;
        "restore")
            restore_backup "${2:-}"
            ;;
        "reset")
            reset_local
            ;;
        "status")
            show_status
            ;;
        *)
            echo "Supabase Database Management Script"
            echo
            echo "Usage: $0 {init|start|stop|migrate|push|pull|apply|types|seed|backup|restore|reset|status}"
            echo
            echo "Commands:"
            echo "  init              Initialize Supabase project"
            echo "  start             Start local development"
            echo "  stop              Stop local development"
            echo "  migrate [name]    Generate new migration"
            echo "  push              Push migrations to remote (PRODUCTION)"
            echo "  pull              Pull remote schema"
            echo "  apply             Apply migrations locally"
            echo "  types [dir]       Generate TypeScript types"
            echo "  seed              Seed local database"
            echo "  backup [file]     Backup remote database"
            echo "  restore [file]    Restore backup to local"
            echo "  reset             Reset local database"
            echo "  status            Show status"
            exit 1
            ;;
    esac
}

main "$@"