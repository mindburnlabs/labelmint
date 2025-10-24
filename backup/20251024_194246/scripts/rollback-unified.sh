#!/bin/bash

# LabelMint Unified Deployment Rollback Script
# Safely rolls back from unified deployment to previous configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backup"
UNIFIED_COMPOSE="$PROJECT_ROOT/docker-compose.unified.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Show help
show_help() {
    cat << EOF
LabelMint Unified Deployment Rollback Script

This script safely rolls back from the unified Docker deployment to the previous
configuration, with data preservation and service verification.

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    rollback             Perform full rollback to previous configuration
    dry-run             Show what would be rolled back without making changes
    backup              Create backup of current unified deployment
    restore             Restore from a specific backup
    verify              Verify rollback integrity
    help                Show this help message

Options:
    --backup-dir DIR    Specify custom backup directory (default: ./backup)
    --force             Force rollback without confirmation prompts
    --preserve-data     Preserve database and storage data
    --stop-services     Stop all services before rollback
    --cleanup           Clean up unified configuration after rollback
    --backup-name NAME  Custom backup name for restoration

Examples:
    $0 rollback                         # Full rollback with confirmation
    $0 rollback --force                 # Force rollback without prompts
    $0 rollback --preserve-data         # Rollback but keep data
    $0 dry-run                         # Preview rollback actions
    $0 backup                          # Create backup of current state
    $0 restore --backup-name backup_20241024  # Restore specific backup

Backup Directory Structure:
    backup/
    ├── YYYYMMDD_HHMMSS/
    │   ├── docker-compose/           # Original compose files
    │   ├── infrastructure/           # Original infrastructure configs
    │   ├── k8s/                      # Original Kubernetes configs
    │   ├── .env*                     # Environment files
    │   └── rollback-info.json        # Rollback metadata

EOF
}

# Confirm action
confirm_action() {
    local message="$1"
    local default="${2:-n}"

    if [[ "${FORCE:-false}" == "true" ]]; then
        return 0
    fi

    echo -e "${YELLOW}$message${NC} [y/N]"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Find latest backup
find_latest_backup() {
    local backup_dir="$1"

    if [[ ! -d "$backup_dir" ]]; then
        error "Backup directory not found: $backup_dir"
        return 1
    fi

    local latest_backup
    latest_backup=$(find "$backup_dir" -maxdepth 1 -type d -name "????????_??????" | sort -r | head -1)

    if [[ -z "$latest_backup" ]]; then
        error "No backup directories found in $backup_dir"
        return 1
    fi

    echo "$latest_backup"
}

# Create backup
create_backup() {
    local backup_name="$1"
    local backup_path="$BACKUP_DIR/$backup_name"

    log "Creating backup: $backup_name"

    # Create backup directory
    mkdir -p "$backup_path"/{docker-compose,infrastructure,k8s,monitoring,scripts}

    # Backup Docker compose files
    log "Backing up Docker compose files..."
    find "$PROJECT_ROOT" -name "docker-compose*.yml" -not -path "./backup/*" -not -name "*.backup.*" | \
        while read -r file; do
            cp "$file" "$backup_path/docker-compose/"
        done

    # Backup infrastructure files
    log "Backing up infrastructure files..."
    if [[ -d "$PROJECT_ROOT/infrastructure" ]]; then
        cp -r "$PROJECT_ROOT/infrastructure" "$backup_path/"
    fi

    # Backup Kubernetes files
    log "Backing up Kubernetes files..."
    if [[ -d "$PROJECT_ROOT/k8s" ]]; then
        cp -r "$PROJECT_ROOT/k8s" "$backup_path/"
    fi

    # Backup environment files
    log "Backing up environment files..."
    find "$PROJECT_ROOT" -name ".env*" -not -path "./backup/*" | \
        while read -r file; do
            cp "$file" "$backup_path/"
        done

    # Backup scripts
    log "Backing up scripts..."
    find "$PROJECT_ROOT/scripts" -name "*.sh" -not -path "./backup/*" | \
        while read -r file; do
            cp "$file" "$backup_path/scripts/"
        done

    # Create rollback metadata
    cat > "$backup_path/rollback-info.json" << EOF
{
    "backup_name": "$backup_name",
    "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "docker_images": "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep labelmint | tr '\n' ';')",
    "volumes": "$(docker volume ls --format '{{.Name}}' | grep labelmint | tr '\n' ';')",
    "networks": "$(docker network ls --format '{{.Name}}' | grep labelmint | tr '\n' ';')"
}
EOF

    success "Backup created: $backup_path"
    echo "$backup_path"
}

# Stop services
stop_services() {
    log "Stopping LabelMint unified services..."

    cd "$PROJECT_ROOT"

    # Stop unified compose services
    if [[ -f "$UNIFIED_COMPOSE" ]]; then
        docker-compose -f "$UNIFIED_COMPOSE" down --remove-orphans || true
    fi

    # Stop any remaining LabelMint containers
    local containers
    containers=$(docker ps -q --filter "name=labelmint" 2>/dev/null || true)
    if [[ -n "$containers" ]]; then
        docker stop $containers || true
        docker rm $containers || true
    fi

    success "Services stopped"
}

# Preserve data
preserve_data() {
    log "Preserving data volumes..."

    local data_volumes=(
        "labelmint_postgres_data"
        "labelmint_redis_data"
        "labelmint_redis_bots_data"
        "labelmint_minio_data"
        "labelmint_uploads_data"
        "labelmint_logs_data"
        "labelmint_prometheus_data"
        "labelmint_grafana_data"
        "labelmint_loki_data"
        "labelmint_tempo_data"
    )

    local preserved_count=0
    for volume in "${data_volumes[@]}"; do
        if docker volume ls -q --filter "name=$volume" | grep -q .; then
            log "Preserving volume: $volume"
            # Create backup timestamp
            local timestamp
            timestamp=$(date +%Y%m%d_%H%M%S)
            docker run --rm -v "$volume":/source -v "$BACKUP_DIR":/backup \
                alpine tar czf "/backup/${volume}_${timestamp}.tar.gz" -C /source .
            ((preserved_count++))
        fi
    done

    if [[ $preserved_count -gt 0 ]]; then
        success "Preserved $preserved_count data volumes"
    else
        warn "No data volumes found to preserve"
    fi
}

# Clean unified configuration
cleanup_unified_config() {
    log "Cleaning up unified configuration..."

    # Remove unified networks
    local networks=(
        "labelmint-labelmint-frontend"
        "labelmint-labelmint-backend"
        "labelmint-labelmint-data"
        "labelmint-labelmint-monitoring"
        "labelmint-labelmint-bots"
    )

    for network in "${networks[@]}"; do
        if docker network ls -q --filter "name=$network" | grep -q .; then
            log "Removing network: $network"
            docker network rm "$network" || true
        fi
    done

    # Archive unified files instead of removing
    local archive_dir="$BACKUP_DIR/unified_config_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$archive_dir"

    local unified_files=(
        "$UNIFIED_COMPOSE"
        "$PROJECT_ROOT/.env.unified.example"
        "$PROJECT_ROOT/DOCKER_MIGRATION_GUIDE.md"
        "$PROJECT_ROOT/INFRASTRUCTURE_CONSOLIDATION_ANALYSIS.md"
        "$PROJECT_ROOT/infrastructure/monitoring/unified-prometheus.yml"
    )

    for file in "${unified_files[@]}"; do
        if [[ -f "$file" ]]; then
            log "Archiving: $(basename "$file")"
            cp "$file" "$archive_dir/"
        fi
    done

    success "Unified configuration cleaned and archived"
}

# Restore from backup
restore_from_backup() {
    local backup_path="$1"

    log "Restoring from backup: $(basename "$backup_path")"

    if [[ ! -d "$backup_path" ]]; then
        error "Backup directory not found: $backup_path"
        return 1
    fi

    # Stop current services first
    stop_services

    # Restore Docker compose files
    if [[ -d "$backup_path/docker-compose" ]]; then
        log "Restoring Docker compose files..."
        cp "$backup_path/docker-compose"/*docker-compose*.yml "$PROJECT_ROOT/"
    fi

    # Restore infrastructure
    if [[ -d "$backup_path/infrastructure" ]]; then
        log "Restoring infrastructure files..."
        rm -rf "$PROJECT_ROOT/infrastructure"
        cp -r "$backup_path/infrastructure" "$PROJECT_ROOT/"
    fi

    # Restore Kubernetes files
    if [[ -d "$backup_path/k8s" ]]; then
        log "Restoring Kubernetes files..."
        rm -rf "$PROJECT_ROOT/k8s"
        cp -r "$backup_path/k8s" "$PROJECT_ROOT/"
    fi

    # Restore environment files
    if [[ -n $(find "$backup_path" -name ".env*" 2>/dev/null) ]]; then
        log "Restoring environment files..."
        find "$backup_path" -name ".env*" -exec cp {} "$PROJECT_ROOT/" \;
    fi

    # Restore scripts
    if [[ -d "$backup_path/scripts" ]]; then
        log "Restoring scripts..."
        cp "$backup_path/scripts"/*.sh "$PROJECT_ROOT/scripts/"
    fi

    success "Restore completed from backup"
}

# Verify rollback integrity
verify_rollback() {
    log "Verifying rollback integrity..."

    local verification_failed=0

    # Check for essential files
    local essential_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/.env"
    )

    for file in "${essential_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Essential file missing: $file"
            verification_failed=1
        fi
    done

    # Check Docker compose can parse
    if [[ -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        cd "$PROJECT_ROOT"
        if ! docker-compose config &>/dev/null; then
            error "Docker compose configuration is invalid"
            verification_failed=1
        fi
    fi

    # Check environment variables
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
        local required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")
        for var in "${required_vars[@]}"; do
            if [[ -z "${!var:-}" ]]; then
                error "Required environment variable missing: $var"
                verification_failed=1
            fi
        done
    fi

    if [[ $verification_failed -eq 0 ]]; then
        success "Rollback integrity verified"
        return 0
    else
        error "Rollback integrity verification failed"
        return 1
    fi
}

# Start restored services
start_restored_services() {
    log "Starting restored services..."

    cd "$PROJECT_ROOT"

    # Check if main docker-compose exists
    if [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        warn "Main docker-compose.yml not found, skipping service start"
        return 0
    fi

    # Start services
    if docker-compose up -d; then
        success "Services started successfully"
    else
        error "Failed to start services"
        return 1
    fi

    # Wait for critical services
    local critical_services=("postgres" "redis")
    for service in "${critical_services[@]}"; do
        log "Waiting for $service to be ready..."
        local max_attempts=30
        local attempt=1

        while [[ $attempt -le $max_attempts ]]; do
            if docker-compose exec -T "$service" pg_isready &>/dev/null || \
               docker-compose exec -T "$service" redis-cli ping &>/dev/null; then
                success "$service is ready"
                break
            fi

            if [[ $attempt -eq $max_attempts ]]; then
                warn "$service failed to become ready within expected time"
            fi

            sleep 2
            attempt=$((attempt + 1))
        done
    done
}

# Generate rollback report
generate_rollback_report() {
    local backup_name="$1"
    local rollback_status="$2"

    log "Generating rollback report..."

    local report_file="$BACKUP_DIR/rollback_report_$(date +%Y%m%d_%H%M%S).md"

    cat > "$report_file" << EOF
# LabelMint Rollback Report

## Rollback Information
- **Backup Name**: $backup_name
- **Rollback Date**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- **Status**: $rollback_status
- **Performed by**: $(whoami)

## Pre-Rollback State
- **Git Commit**: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')
- **Git Branch**: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')

## Services Status
\`\`\`
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running")
\`\`\`

## Volumes Status
\`\`\`
$(docker volume ls --filter "name=labelmint" 2>/dev/null || echo "No LabelMint volumes found")
\`\`\`

## Networks Status
\`\`\`
$(docker network ls --filter "name=labelmint" 2>/dev/null || echo "No LabelMint networks found")
\`\`\`

## Next Steps
1. Verify all services are functioning correctly
2. Update CI/CD pipelines to use old configuration
3. Notify team of the rollback
4. Document the cause of the rollback
5. Plan fixes before attempting re-migration

## Contact Information
- **Support**: devops@labelmint.com
- **Documentation**: LabelMint Infrastructure Wiki
- **Runbooks**: LabelMint Operations Runbooks

---
**Report Generated**: $(date)
EOF

    success "Rollback report created: $report_file"
}

# Main rollback function
perform_rollback() {
    local backup_name="$1"

    log "Starting LabelMint deployment rollback..."

    # Find backup if not specified
    if [[ -z "$backup_name" ]]; then
        backup_path=$(find_latest_backup "$BACKUP_DIR")
        backup_name=$(basename "$backup_path")
        log "Using latest backup: $backup_name"
    else
        backup_path="$BACKUP_DIR/$backup_name"
    fi

    # Confirm rollback
    if ! confirm_action "Are you sure you want to rollback to backup '$backup_name'? This will stop all current services and restore previous configuration."; then
        warn "Rollback cancelled by user"
        exit 0
    fi

    local rollback_status="failed"

    # Create backup of current state before rollback
    log "Creating backup of current unified deployment..."
    local pre_rollback_backup
    pre_rollback_backup=$(create_backup "pre_rollback_$(date +%Y%m%d_%H%M%S)")

    # Execute rollback steps
    if {
        stop_services &&
        [[ "${PRESERVE_DATA:-false}" == "true" ]] && preserve_data &&
        restore_from_backup "$backup_path" &&
        verify_rollback &&
        start_restored_services
    }; then
        rollback_status="success"

        # Clean up unified configuration if requested
        if [[ "${CLEANUP:-false}" == "true" ]]; then
            cleanup_unified_config
        fi

        success "Rollback completed successfully!"
    else
        error "Rollback failed! Check logs above for details."
        error "Pre-rollback backup saved at: $pre_rollback_backup"
        exit 1
    fi

    # Generate report
    generate_rollback_report "$backup_name" "$rollback_status"

    # Show service URLs
    echo
    log "Service URLs after rollback:"
    echo "  Web Application:       http://localhost:3000"
    echo "  Labeling Backend:      http://localhost:3001"
    echo "  Payment Backend:       http://localhost:3003"
    echo "  Grafana:               http://localhost:3000 (if configured)"
    echo "  MinIO Console:         http://localhost:9001 (if configured)"
}

# Dry run rollback
dry_run_rollback() {
    local backup_name="$1"

    log "Performing dry run rollback..."

    # Find backup if not specified
    if [[ -z "$backup_name" ]]; then
        backup_path=$(find_latest_backup "$BACKUP_DIR")
        backup_name=$(basename "$backup_path")
    else
        backup_path="$BACKUP_DIR/$backup_name"
    fi

    if [[ ! -d "$backup_path" ]]; then
        error "Backup not found: $backup_name"
        return 1
    fi

    echo
    log "Rollback Plan for backup: $backup_name"
    echo "================================"

    echo "Files to be restored:"
    find "$backup_path" -type f -name "*.yml" -o -name "*.yaml" -o -name ".env*" | \
        sed "s|$backup_path/|  - |" | sort

    echo
    echo "Directories to be restored:"
    find "$backup_path" -mindepth 1 -type d | \
        sed "s|$backup_path/|  - |" | sort

    echo
    echo "Services to be stopped:"
    docker ps --filter "name=labelmint" --format "  - {{.Names}}" 2>/dev/null || echo "  - No LabelMint containers running"

    echo
    echo "Networks to be removed:"
    docker network ls --filter "name=labelmint" --format "  - {{.Name}}" 2>/dev/null || echo "  - No LabelMint networks found"

    echo
    warn "This is a dry run - no changes will be made"
    warn "Run with 'rollback' command to execute the rollback"
}

# Main execution
main() {
    local command="rollback"
    local backup_name=""
    local force="false"
    local preserve_data="false"
    local cleanup="false"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            rollback|dry-run|backup|restore|verify|help)
                command="$1"
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --force)
                force="true"
                export FORCE="true"
                shift
                ;;
            --preserve-data)
                preserve_data="true"
                export PRESERVE_DATA="true"
                shift
                ;;
            --cleanup)
                cleanup="true"
                export CLEANUP="true"
                shift
                ;;
            --backup-name)
                backup_name="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Set default backup directory
    BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backup}"

    # Execute command
    case $command in
        "rollback")
            perform_rollback "$backup_name"
            ;;
        "dry-run")
            dry_run_rollback "$backup_name"
            ;;
        "backup")
            create_backup "manual_backup_$(date +%Y%m%d_%H%M%S)"
            ;;
        "restore")
            if [[ -z "$backup_name" ]]; then
                error "Backup name required for restore. Use --backup-name NAME"
                exit 1
            fi
            restore_from_backup "$BACKUP_DIR/$backup_name"
            verify_rollback
            start_restored_services
            ;;
        "verify")
            verify_rollback
            ;;
        "help")
            show_help
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Trap to handle interrupts
trap 'error "Rollback interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"