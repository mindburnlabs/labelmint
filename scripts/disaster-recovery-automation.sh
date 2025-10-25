#!/bin/bash
# LabelMint Disaster Recovery Automation Script
# ==============================================
# Comprehensive disaster recovery procedures for production environment
# Supports multiple failure scenarios and automated recovery processes

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_BUCKET="labelmint-backups-prod"
ENVIRONMENT="${ENVIRONMENT:-production}"
LOG_FILE="/tmp/labelmint-disaster-recovery-$(date +%Y%m%d_%H%M%S).log"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    send_slack_alert "🚨 LabelMint Disaster Recovery FAILED: $1"
    exit 1
}

# Send Slack notification
send_slack_alert() {
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$1\"}" \
            "${SLACK_WEBHOOK_URL}" || log "Failed to send Slack notification"
    fi
}

# Send Slack success notification
send_slack_success() {
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$1\"}" \
            "${SLACK_WEBHOOK_URL}" || log "Failed to send Slack notification"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if required tools are installed
    for tool in kubectl aws jq psql redis-cli terraform; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            error_exit "Required tool '$tool' is not installed"
        fi
    done

    # Check if we can connect to AWS
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error_exit "AWS credentials not configured or invalid"
    fi

    # Check if we can connect to Kubernetes cluster
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error_exit "Cannot connect to Kubernetes cluster"
    fi

    log "Prerequisites check passed"
}

# Get latest backup from S3
get_latest_backup() {
    local backup_type="$1"
    local pattern="$2"

    log "Finding latest ${backup_type} backup..."

    local latest_backup
    latest_backup=$(aws s3 ls "s3://${BACKUP_BUCKET}/${pattern}/" --recursive | sort | tail -1 | awk '{print $4}')

    if [[ -z "${latest_backup}" ]]; then
        error_exit "No ${backup_type} backup found in S3"
    fi

    echo "${latest_backup}"
}

# Download backup from S3
download_backup() {
    local backup_path="$1"
    local local_path="$2"

    log "Downloading backup: ${backup_path}"

    if ! aws s3 cp "s3://${BACKUP_BUCKET}/${backup_path}" "${local_path}"; then
        error_exit "Failed to download backup: ${backup_path}"
    fi

    log "Backup downloaded successfully: ${local_path}"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    local checksum_file="$2"

    log "Verifying backup integrity..."

    if [[ ! -f "${checksum_file}" ]]; then
        checksum_file="${backup_file}.sha256"
        download_backup "${backup_file}.sha256" "${checksum_file}"
    fi

    if ! sha256sum -c "${checksum_file}"; then
        error_exit "Backup integrity verification failed"
    fi

    log "Backup integrity verified successfully"
}

# Database recovery function
recover_database() {
    log "Starting database recovery..."

    # Get latest database backup
    local latest_backup
    latest_backup=$(get_latest_backup "database" "database")

    # Download backup
    local backup_file="/tmp/$(basename "${latest_backup}")"
    download_backup "${latest_backup}" "${backup_file}"

    # Verify backup integrity
    verify_backup "${backup_file}" "${backup_file}.sha256"

    # Get database connection details
    local db_url="${DATABASE_URL:-}"
    if [[ -z "${db_url}" ]]; then
        db_url=$(kubectl get secret labelmint-secrets -n "${ENVIRONMENT}" -o jsonpath='{.data.database-url}' | base64 -d)
    fi

    if [[ -z "${db_url}" ]]; then
        error_exit "Database URL not found"
    fi

    log "Connecting to database for recovery..."

    # Create temporary database for testing restore
    local temp_db="labelmint_recovery_$(date +%s)"
    psql "${db_url}" -c "CREATE DATABASE ${temp_db};" || {
        error_exit "Failed to create temporary recovery database"
    }

    # Restore database
    log "Restoring database from backup..."
    if ! pg_restore \
        --verbose \
        --no-acl \
        --no-owner \
        --dbname="${db_url}/${temp_db}" \
        "${backup_file}"; then
        psql "${db_url}" -c "DROP DATABASE IF EXISTS ${temp_db};"
        error_exit "Database restore failed"
    fi

    # Verify restored data
    log "Verifying restored data..."
    local tables_to_check=("users" "projects" "tasks" "wallets" "transactions")

    for table in "${tables_to_check[@]}"; do
        local count
        count=$(psql "${db_url}/${temp_db}" -t -c "SELECT COUNT(*) FROM ${table};" | xargs)
        log "Table ${table}: ${count} records restored"
    done

    # Backup current production database (if exists)
    log "Creating backup of current production database..."
    local backup_current="/tmp/current_production_backup_$(date +%Y%m%d_%H%M%S).sql"
    if pg_dump "${db_url}" --format=custom --file="${backup_current}" 2>/dev/null; then
        log "Current production database backed up to: ${backup_current}"
    else
        log "Warning: Could not backup current database (may not exist or be accessible)"
    fi

    # Drop production database and rename recovery database
    log "Swapping databases..."
    local prod_db=$(echo "${db_url}" | sed 's|.*/||')

    psql "${db_url%/*}" -c "DROP DATABASE IF EXISTS ${prod_db};"
    psql "${db_url%/*}" -c "ALTER DATABASE ${temp_db} RENAME TO ${prod_db};"

    # Cleanup
    rm -f "${backup_file}" "${backup_file}.sha256" "${backup_current}"

    log "Database recovery completed successfully"
}

# Redis recovery function
recover_redis() {
    log "Starting Redis recovery..."

    # Get latest Redis backup
    local latest_backup
    latest_backup=$(get_latest_backup "Redis" "redis")

    # Download backup
    local backup_file="/tmp/$(basename "${latest_backup}")"
    download_backup "${latest_backup}" "${backup_file}"

    # Verify backup integrity
    verify_backup "${backup_file}" "${backup_file}.sha256"

    # Get Redis connection details
    local redis_url="${REDIS_URL:-}"
    if [[ -z "${redis_url}" ]]; then
        redis_url=$(kubectl get secret labelmint-secrets -n "${ENVIRONMENT}" -o jsonpath='{.data.redis-url}' | base64 -d)
    fi

    if [[ -z "${redis_url}" ]]; then
        error_exit "Redis URL not found"
    fi

    # Extract Redis host and port
    local redis_host
    redis_host=$(echo "${redis_url}" | sed 's|redis://||' | cut -d':' -f1)
    local redis_port
    redis_port=$(echo "${redis_url}" | sed 's|redis://||' | cut -d':' -f2 | cut -d'/' -f1)

    log "Recovering Redis data to ${redis_host}:${redis_port}..."

    # Decompress backup if needed
    if [[ "${backup_file}" == *.gz ]]; then
        gunzip -c "${backup_file}" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi

    # Stop Redis (if running)
    log "Stopping Redis service..."
    kubectl scale deployment redis --replicas=0 -n "${ENVIRONMENT}" || true
    sleep 10

    # Clear Redis data directory
    log "Clearing Redis data directory..."
    kubectl exec -n "${ENVIRONMENT}" deployment/redis -- rm -rf /data/* || true

    # Copy backup file to Redis pod
    local redis_pod
    redis_pod=$(kubectl get pods -n "${ENVIRONMENT}" -l app=redis -o jsonpath='{.items[0].metadata.name}' || echo "")

    if [[ -n "${redis_pod}" ]]; then
        kubectl cp "${backup_file}" "${redis_pod}:/data/dump.rdb" -n "${ENVIRONMENT}"
    else
        log "Warning: Could not find Redis pod, attempting manual recovery"
    fi

    # Start Redis
    log "Starting Redis service..."
    kubectl scale deployment redis --replicas=1 -n "${ENVIRONMENT}"

    # Wait for Redis to be ready
    log "Waiting for Redis to be ready..."
    for i in {1..30}; do
        if redis-cli -h "${redis_host}" -p "${redis_port}" ping >/dev/null 2>&1; then
            log "Redis is ready"
            break
        fi
        if [[ $i -eq 30 ]]; then
            error_exit "Redis failed to start after recovery"
        fi
        sleep 2
    done

    # Verify Redis data
    local info
    info=$(redis-cli -h "${redis_host}" -p "${redis_port}" info keyspace)
    log "Redis keyspace info: ${info}"

    # Cleanup
    rm -f "${backup_file}"

    log "Redis recovery completed successfully"
}

# Kubernetes configuration recovery function
recover_kubernetes_config() {
    log "Starting Kubernetes configuration recovery..."

    # Get latest configuration backup
    local latest_backup
    latest_backup=$(get_latest_backup "Kubernetes configuration" "config")

    # Download backup
    local backup_file="/tmp/$(basename "${latest_backup}")"
    download_backup "${latest_backup}" "${backup_file}"

    # Verify backup integrity
    verify_backup "${backup_file}" "${backup_file}.sha256"

    # Extract backup
    local extract_dir="/tmp/k8s_config_recovery"
    mkdir -p "${extract_dir}"
    tar -xzf "${backup_file}" -C "${extract_dir}"

    # Apply configurations
    log "Applying Kubernetes configurations..."

    # Apply secrets (excluding sensitive data recreation)
    if [[ -f "${extract_dir}/secrets/secrets.yaml" ]]; then
        log "Restoring secrets configuration..."
        kubectl apply -f "${extract_dir}/secrets/secrets.yaml" -n "${ENVIRONMENT}" || {
            log "Warning: Some secrets may already exist"
        }
    fi

    # Apply configmaps
    if [[ -f "${extract_dir}/configmaps/configmaps.yaml" ]]; then
        log "Restoring configmaps..."
        kubectl apply -f "${extract_dir}/configmaps/configmaps.yaml" -n "${ENVIRONMENT}"
    fi

    # Apply services
    if [[ -f "${extract_dir}/services/services.yaml" ]]; then
        log "Restoring services..."
        kubectl apply -f "${extract_dir}/services/services.yaml" -n "${ENVIRONMENT}"
    fi

    # Apply ingress
    if [[ -f "${extract_dir}/ingress/ingress.yaml" ]]; then
        log "Restoring ingress configurations..."
        kubectl apply -f "${extract_dir}/ingress/ingress.yaml" -n "${ENVIRONMENT}"
    fi

    # Apply deployments last
    if [[ -f "${extract_dir}/deployments/deployments.yaml" ]]; then
        log "Restoring deployments..."
        kubectl apply -f "${extract_dir}/deployments/deployments.yaml" -n "${ENVIRONMENT}"
    fi

    # Cleanup
    rm -rf "${extract_dir}" "${backup_file}"

    log "Kubernetes configuration recovery completed successfully"
}

# Infrastructure recovery function
recover_infrastructure() {
    log "Starting infrastructure recovery..."

    cd "${PROJECT_ROOT}/infrastructure/terraform"

    # Initialize Terraform
    log "Initializing Terraform..."
    terraform init -backend-config="bucket=labelmint-terraform-state"

    # Select workspace
    terraform workspace select "${ENVIRONMENT}"

    # Check Terraform state
    log "Checking Terraform state..."
    if ! terraform state list >/dev/null 2>&1; then
        error_exit "Terraform state not found or corrupted"
    fi

    # Apply infrastructure
    log "Applying infrastructure configuration..."
    if ! terraform apply -auto-approve; then
        error_exit "Infrastructure recovery failed"
    fi

    log "Infrastructure recovery completed successfully"
}

# Application recovery function
recover_applications() {
    log "Starting application recovery..."

    # Wait for all deployments to be ready
    log "Waiting for deployments to be ready..."

    local deployments=("labelmint-web" "labelmint-backend" "labelmint-api-gateway")

    for deployment in "${deployments[@]}"; do
        log "Waiting for ${deployment} deployment..."
        kubectl rollout status deployment/"${deployment}" -n "${ENVIRONMENT}" --timeout=300s || {
            error_exit "Deployment ${deployment} failed to become ready"
        }
    done

    # Verify application health
    log "Verifying application health..."

    local app_url="https://labelmint.it"
    local api_url="https://api.labelmint.it"

    for i in {1..30}; do
        if curl -f -s "${app_url}/api/health" >/dev/null 2>&1 && \
           curl -f -s "${api_url}/api/health" >/dev/null 2>&1; then
            log "Applications are healthy"
            break
        fi

        if [[ $i -eq 30 ]]; then
            error_exit "Applications failed health checks"
        fi

        log "Waiting for applications to be healthy... ($i/30)"
        sleep 10
    done

    log "Application recovery completed successfully"
}

# Full disaster recovery function
full_disaster_recovery() {
    log "Starting full disaster recovery process..."

    send_slack_alert "🚨 LabelMint Disaster Recovery Started\nEnvironment: ${ENVIRONMENT}\nTime: $(date)"

    # Check prerequisites
    check_prerequisites

    # Recover infrastructure first
    recover_infrastructure

    # Recover Kubernetes configuration
    recover_kubernetes_config

    # Recover database
    recover_database

    # Recover Redis
    recover_redis

    # Recover applications
    recover_applications

    # Final verification
    log "Performing final verification..."

    # Run smoke tests
    if ! "${SCRIPT_DIR}/smoke-tests.sh" --environment="${ENVIRONMENT}"; then
        error_exit "Smoke tests failed after recovery"
    fi

    log "Full disaster recovery completed successfully"
    send_slack_success "✅ LabelMint Disaster Recovery COMPLETED\nEnvironment: ${ENVIRONMENT}\nTime: $(date)"
}

# Show usage
usage() {
    cat << EOF
LabelMint Disaster Recovery Automation Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    full-recovery              Perform complete disaster recovery
    recover-database           Recover only database
    recover-redis              Recover only Redis
    recover-kubernetes         Recover only Kubernetes configurations
    recover-infrastructure     Recover only infrastructure
    recover-applications       Recover only applications
    check-prerequisites        Check if all prerequisites are met

Environment Variables:
    ENVIRONMENT                Target environment (default: production)
    DATABASE_URL              Database connection URL
    REDIS_URL                 Redis connection URL
    SLACK_WEBHOOK_URL         Slack webhook for notifications
    AWS_ACCESS_KEY_ID         AWS access key
    AWS_SECRET_ACCESS_KEY     AWS secret key

Examples:
    $0 full-recovery
    $0 recover-database
    $0 check-prerequisites

Note: This script should only be run during actual disaster scenarios.
EOF
}

# Main execution
main() {
    local command="${1:-}"

    case "${command}" in
        "full-recovery")
            full_disaster_recovery
            ;;
        "recover-database")
            check_prerequisites
            recover_database
            ;;
        "recover-redis")
            check_prerequisites
            recover_redis
            ;;
        "recover-kubernetes")
            check_prerequisites
            recover_kubernetes_config
            ;;
        "recover-infrastructure")
            check_prerequisites
            recover_infrastructure
            ;;
        "recover-applications")
            check_prerequisites
            recover_applications
            ;;
        "check-prerequisites")
            check_prerequisites
            log "All prerequisites met"
            ;;
        "help"|"-h"|"--help")
            usage
            ;;
        *)
            echo "Error: Unknown command '${command}'"
            echo
            usage
            exit 1
            ;;
    esac
}

# Trap for cleanup
trap 'error_exit "Script interrupted"' INT TERM

# Run main function with all arguments
main "$@"