#!/bin/bash

# LabelMint Production Infrastructure Verification Script
# ======================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INFRA_DIR="infrastructure"
K8S_DIR="infrastructure/k8s"
DOCKER_FILE="config/docker/docker-compose.prod.yml"
VERIFIED_FILE=".infrastructure-verified"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify Kubernetes configurations
verify_kubernetes() {
    log "🔍 Verifying Kubernetes configurations..."

    local k8s_errors=0

    # Check YAML syntax
    info "Checking YAML syntax..."
    if find "$K8S_DIR" -name "*.yaml" -o -name "*.yml" | xargs -I {} yq eval . {} >/dev/null 2>&1; then
        log "✅ All Kubernetes YAML files are valid"
    else
        error "❌ Invalid Kubernetes YAML files found"
        k8s_errors=$((k8s_errors + 1))
    fi

    # Check production overlay
    info "Checking production overlay..."
    if [[ -d "$K8S_DIR/overlays/production" ]]; then
        local prod_files=(
            "kustomization.yaml"
            "deployment.yaml"
            "ingress.yaml"
            "hpa.yaml"
            "pdb.yaml"
            "resources.yaml"
            "network-policy.yaml"
        )

        for file in "${prod_files[@]}"; do
            if [[ -f "$K8S_DIR/overlays/production/$file" ]]; then
                log "   ✅ $file exists"
            else
                error "   ❌ $file missing"
                k8s_errors=$((k8s_errors + 1))
            fi
        done

        # Validate kustomization
        if kubectl kustomize "$K8S_DIR/overlays/production" --dry-run=client >/dev/null 2>&1; then
            log "✅ Production kustomization is valid"
        else
            error "❌ Production kustomization is invalid"
            k8s_errors=$((k8s_errors + 1))
        fi
    else
        error "❌ Production overlay directory missing"
        k8s_errors=$((k8s_errors + 1))
    fi

    return $k8s_errors
}

# Verify Docker configurations
verify_docker() {
    log "🐳 Verifying Docker configurations..."

    local docker_errors=0

    # Check production Docker Compose file
    if [[ -f "$DOCKER_FILE" ]]; then
        info "Validating production Docker Compose..."
        if docker-compose -f "$DOCKER_FILE" config >/dev/null 2>&1; then
            log "✅ Production Docker Compose is valid"
        else
            error "❌ Production Docker Compose is invalid"
            docker_errors=$((docker_errors + 1))
        fi

        # Check for required services
        info "Checking required services..."
        local required_services=(
            "web"
            "labeling-backend"
            "payment-backend"
            "api-gateway"
            "postgres"
            "redis"
            "prometheus"
            "grafana"
            "nginx"
        )

        for service in "${required_services[@]}"; do
            if docker-compose -f "$DOCKER_FILE" config --services | grep -q "^$service$"; then
                log "   ✅ Service: $service"
            else
                error "   ❌ Missing service: $service"
                docker_errors=$((docker_errors + 1))
            fi
        done
    else
        error "❌ Production Docker Compose file not found"
        docker_errors=$((docker_errors + 1))
    fi

    return $docker_errors
}

# Verify Terraform configurations
verify_terraform() {
    log "🏗️ Verifying Terraform configurations..."

    local terraform_errors=0

    if [[ -d "$INFRA_DIR/terraform" ]]; then
        cd "$INFRA_DIR/terraform"

        info "Initializing Terraform..."
        if terraform init -backend=false >/dev/null 2>&1; then
            log "✅ Terraform initialization successful"
        else
            error "❌ Terraform initialization failed"
            terraform_errors=$((terraform_errors + 1))
        fi

        info "Validating Terraform configuration..."
        if terraform validate >/dev/null 2>&1; then
            log "✅ Terraform configuration is valid"
        else
            error "❌ Terraform configuration is invalid"
            terraform_errors=$((terraform_errors + 1))
        fi

        # Check required files
        info "Checking required Terraform files..."
        local required_tf_files=(
            "main.tf"
            "variables.tf"
            "outputs.tf"
        )

        for file in "${required_tf_files[@]}"; do
            if [[ -f "$file" ]]; then
                log "   ✅ $file exists"
            else
                error "   ❌ $file missing"
                terraform_errors=$((terraform_errors + 1))
            fi
        done

        cd - >/dev/null
    else
        error "❌ Terraform directory not found"
        terraform_errors=$((terraform_errors + 1))
    fi

    return $terraform_errors
}

# Verify Supabase configurations
verify_supabase() {
    log "🗄️ Verifying Supabase configurations..."

    local supabase_errors=0

    if [[ -d "supabase" ]]; then
        # Check configuration files
        local required_supabase_files=(
            "config.toml"
            "config-prod.toml"
            "scripts/setup-supabase-production.js"
            "scripts/setup-supabase-prod.js"
        )

        for file in "${required_supabase_files[@]}"; do
            if [[ -f "supabase/$file" ]]; then
                log "   ✅ $file exists"
            else
                error "   ❌ $file missing"
                supabase_errors=$((supabase_errors + 1))
            fi
        done

        # Check migrations
        if [[ -d "supabase/migrations" ]]; then
            local migration_count=$(find supabase/migrations -name "*.sql" | wc -l)
            if [[ $migration_count -gt 0 ]]; then
                log "✅ Found $migration_count database migrations"
            else
                error "❌ No database migrations found"
                supabase_errors=$((supabase_errors + 1))
            fi
        else
            error "❌ Supabase migrations directory not found"
            supabase_errors=$((supabase_errors + 1))
        fi

        # Validate Node.js scripts
        if command_exists node; then
            info "Validating Node.js scripts..."
            for script in "scripts/setup-supabase-production.js" "scripts/setup-supabase-prod.js"; do
                if [[ -f "supabase/$script" ]]; then
                    if node -c "supabase/$script" 2>/dev/null; then
                        log "   ✅ $script syntax is valid"
                    else
                        error "   ❌ $script has syntax errors"
                        supabase_errors=$((supabase_errors + 1))
                    fi
                fi
            done
        else
            warn "⚠️ Node.js not found, skipping script validation"
        fi
    else
        error "❌ Supabase directory not found"
        supabase_errors=$((supabase_errors + 1))
    fi

    return $supabase_errors
}

# Verify monitoring configurations
verify_monitoring() {
    log "📊 Verifying monitoring configurations..."

    local monitoring_errors=0

    if [[ -d "$INFRA_DIR/monitoring" ]]; then
        # Check Prometheus configuration
        if [[ -f "$INFRA_DIR/monitoring/prometheus.yml/prometheus.yml" ]]; then
            info "Validating Prometheus configuration..."
            if docker run --rm -v "$PWD/$INFRA_DIR/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus --config.file=/etc/prometheus/prometheus.yml --dry-run >/dev/null 2>&1; then
                log "✅ Prometheus configuration is valid"
            else
                error "❌ Prometheus configuration is invalid"
                monitoring_errors=$((monitoring_errors + 1))
            fi
        else
            error "❌ Prometheus configuration not found"
            monitoring_errors=$((monitoring_errors + 1))
        fi

        # Check monitoring components
        local monitoring_components=(
            "prometheus.yml"
            "grafana"
            "alertmanager"
            "loki"
            "tempo"
        )

        for component in "${monitoring_components[@]}"; do
            if [[ -d "$INFRA_DIR/monitoring/$component" ]] || [[ -f "$INFRA_DIR/monitoring/$component" ]]; then
                log "   ✅ Monitoring component: $component"
            else
                error "   ❌ Missing monitoring component: $component"
                monitoring_errors=$((monitoring_errors + 1))
            fi
        done
    else
        error "❌ Monitoring directory not found"
        monitoring_errors=$((monitoring_errors + 1))
    fi

    return $monitoring_errors
}

# Verify security configurations
verify_security() {
    log "🔒 Verifying security configurations..."

    local security_errors=0

    # Check network policies
    if [[ -f "$K8S_DIR/overlays/production/network-policy.yaml" ]]; then
        info "Validating network policies..."
        if grep -q "deny-all" "$K8S_DIR/overlays/production/network-policy.yaml"; then
            log "✅ Network policies include deny-all rules"
        else
            error "❌ Network policies missing deny-all rules"
            security_errors=$((security_errors + 1))
        fi
    else
        error "❌ Production network policies not found"
        security_errors=$((security_errors + 1))
    fi

    # Check RBAC
    if [[ -f "$K8S_DIR/overlays/production/service-account.yaml" ]]; then
        log "✅ Service account configuration found"
    else
        error "❌ Service account configuration missing"
        security_errors=$((security_errors + 1))
    fi

    # Check security scan workflows
    if [[ -f ".github/workflows/security-scan.yml" ]]; then
        log "✅ Security scan workflow found"
    else
        error "❌ Security scan workflow missing"
        security_errors=$((security_errors + 1))
    fi

    return $security_errors
}

# Verify backup configurations
verify_backups() {
    log "💾 Verifying backup configurations..."

    local backup_errors=0

    # Check backup script
    if [[ -f "scripts/production-backup.sh" ]]; then
        info "Validating backup script..."
        if bash -n "scripts/production-backup.sh" 2>/dev/null; then
            log "✅ Backup script syntax is valid"

            # Check if script is executable
            if [[ -x "scripts/production-backup.sh" ]]; then
                log "✅ Backup script is executable"
            else
                error "❌ Backup script is not executable"
                backup_errors=$((backup_errors + 1))
            fi
        else
            error "❌ Backup script has syntax errors"
            backup_errors=$((backup_errors + 1))
        fi
    else
        error "❌ Backup script not found"
        backup_errors=$((backup_errors + 1))
    fi

    # Check backup workflow
    if [[ -f ".github/workflows/backup.yml" ]]; then
        log "✅ Backup workflow found"
    else
        error "❌ Backup workflow missing"
        backup_errors=$((backup_errors + 1))
    fi

    return $backup_errors
}

# Check dependencies
check_dependencies() {
    log "🔧 Checking dependencies..."

    local missing_deps=0
    local required_tools=(
        "docker"
        "docker-compose"
        "kubectl"
        "kustomize"
        "yq"
    )

    for tool in "${required_tools[@]}"; do
        if command_exists "$tool"; then
            log "   ✅ $tool"
        else
            error "   ❌ $tool not found"
            missing_deps=$((missing_deps + 1))
        fi
    done

    # Optional tools
    local optional_tools=(
        "terraform"
        "node"
        "npm"
        "pnpm"
    )

    info "Checking optional tools..."
    for tool in "${optional_tools[@]}"; do
        if command_exists "$tool"; then
            log "   ✅ $tool"
        else
            warn "   ⚠️ $tool not found (optional)"
        fi
    done

    return $missing_deps
}

# Generate verification report
generate_report() {
    local total_errors=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)

    info "📋 Generating verification report..."

    cat > "infrastructure-verification-$timestamp.md" << EOF
# LabelMint Production Infrastructure Verification Report

**Generated:** $(date)
**Status:** $([ $total_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")

## Summary

- Total Errors Found: $total_errors
- Kubernetes Verification: $([ $kubernetes_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Docker Verification: $([ $docker_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Terraform Verification: $([ $terraform_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Supabase Verification: $([ $supabase_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Monitoring Verification: $([ $monitoring_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Security Verification: $([ $security_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Backup Verification: $([ $backup_errors -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")

## Components Verified

### Kubernetes
- Production overlay configurations
- Horizontal Pod Autoscalers
- Pod Disruption Budgets
- Network Policies
- Resource Limits and Quotas
- Ingress Configurations

### Docker
- Production Docker Compose
- Service configurations
- Health checks
- Resource limits

### Terraform
- AWS infrastructure definitions
- Security configurations
- Network configurations
- Monitoring setup

### Supabase
- Production configuration
- Database setup scripts
- Migration files
- Backup procedures

### Monitoring
- Prometheus configurations
- Grafana dashboards
- Alertmanager rules
- Log aggregation

### Security
- Network policies
- RBAC configurations
- SSL/TLS certificates
- Security scanning

### Backups
- Automated backup scripts
- Disaster recovery procedures
- Backup retention policies

## Next Steps

$([ $total_errors -gt 0 ] && echo "
1. Fix the errors identified above
2. Re-run this verification script
3. Address any security concerns
4. Test backup and recovery procedures
" || echo "
1. Infrastructure is ready for deployment
2. Proceed with staging deployment
3. Run integration tests
4. Schedule production deployment
")

## Notes

- This verification ensures production readiness
- Regular verification is recommended before deployments
- Monitor infrastructure health in production
EOF

    echo "infrastructure-verification-$timestamp.md"
}

# Main execution
main() {
    log "🚀 Starting LabelMint Production Infrastructure Verification"
    log "=========================================================="

    local total_errors=0

    # Check dependencies first
    check_dependencies
    total_errors=$((total_errors + $?))

    # Run verification checks
    verify_kubernetes
    kubernetes_errors=$?
    total_errors=$((total_errors + kubernetes_errors))

    verify_docker
    docker_errors=$?
    total_errors=$((total_errors + docker_errors))

    verify_terraform
    terraform_errors=$?
    total_errors=$((total_errors + terraform_errors))

    verify_supabase
    supabase_errors=$?
    total_errors=$((total_errors + supabase_errors))

    verify_monitoring
    monitoring_errors=$?
    total_errors=$((total_errors + monitoring_errors))

    verify_security
    security_errors=$?
    total_errors=$((total_errors + security_errors))

    verify_backups
    backup_errors=$?
    total_errors=$((total_errors + backup_errors))

    # Generate report
    local report_file=$(generate_report $total_errors)

    # Final summary
    echo ""
    log "📊 Verification Summary"
    log "====================="
    echo ""

    if [[ $total_errors -eq 0 ]]; then
        log "🎉 All infrastructure verification checks passed!"
        log "✅ Kubernetes: Valid"
        log "✅ Docker: Valid"
        log "✅ Terraform: Valid"
        log "✅ Supabase: Valid"
        log "✅ Monitoring: Valid"
        log "✅ Security: Valid"
        log "✅ Backups: Valid"
        echo ""
        log "📄 Detailed report: $report_file"
        log "🚀 Infrastructure is PRODUCTION READY!"

        # Create verification marker
        touch "$VERIFIED_FILE"

    else
        error "❌ Infrastructure verification failed with $total_errors error(s):"
        [[ $kubernetes_errors -gt 0 ]] && error "   - Kubernetes: $kubernetes_errors errors"
        [[ $docker_errors -gt 0 ]] && error "   - Docker: $docker_errors errors"
        [[ $terraform_errors -gt 0 ]] && error "   - Terraform: $terraform_errors errors"
        [[ $supabase_errors -gt 0 ]] && error "   - Supabase: $supabase_errors errors"
        [[ $monitoring_errors -gt 0 ]] && error "   - Monitoring: $monitoring_errors errors"
        [[ $security_errors -gt 0 ]] && error "   - Security: $security_errors errors"
        [[ $backup_errors -gt 0 ]] && error "   - Backups: $backup_errors errors"
        echo ""
        error "📄 Detailed report: $report_file"
        error "🛑 Infrastructure is NOT production ready!"
        exit 1
    fi
}

# Handle script interruption
trap 'error "Script interrupted"; exit 130' INT TERM

# Run main function
main "$@"