#!/bin/bash

# Environment Configuration Loader
# ================================
# This script loads environment-specific configuration files
# Usage: ./load-env.sh [development|production|testing]

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Function to display usage
usage() {
    echo "Usage: $0 [development|production|testing]"
    echo ""
    echo "Loads environment-specific configuration from:"
    echo "  - development: config/environment/.env.development"
    echo "  - production:  config/environment/.env.production"
    echo "  - testing:     config/environment/.env.testing"
    echo ""
    echo "Example: $0 development"
    exit 1
}

# Function to validate environment
validate_environment() {
    local env=$1
    case $env in
        development|production|testing)
            return 0
            ;;
        *)
            echo "Error: Invalid environment '$env'"
            echo "Valid environments: development, production, testing"
            return 1
            ;;
    esac
}

# Function to load environment file
load_environment_file() {
    local env=$1
    local env_file="$SCRIPT_DIR/.env.$env"

    if [[ ! -f "$env_file" ]]; then
        echo "Error: Environment file not found: $env_file"
        return 1
    fi

    echo "Loading environment: $env"
    echo "Environment file: $env_file"
    echo ""

    # Load the environment file
    set -a
    source "$env_file"
    set +a

    echo "✅ Environment loaded successfully"
    echo ""

    # Display key loaded variables (without sensitive values)
    echo "📋 Environment Summary:"
    echo "  NODE_ENV: ${NODE_ENV:-not set}"
    echo "  ENVIRONMENT: ${ENVIRONMENT:-not set}"
    echo "  POSTGRES_DB: ${POSTGRES_DB:-not set}"
    echo "  REDIS_PORT: ${REDIS_PORT:-not set}"
    echo "  WEB_PORT: ${WEB_PORT:-not set}"
    echo "  LOG_LEVEL: ${LOG_LEVEL:-not set}"

    # Check for required variables based on environment
    check_required_variables "$env"
}

# Function to check required variables
check_required_variables() {
    local env=$1
    local missing_vars=()

    # Base required variables
    local base_vars=("NODE_ENV" "POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")

    # Environment-specific variables
    case $env in
        production)
            base_vars+=("TON_API_KEY" "TELEGRAM_BOT_TOKEN_CLIENT" "TELEGRAM_BOT_TOKEN_WORKER")
            ;;
        development)
            base_vars+=("MINIO_ACCESS_KEY" "MINIO_SECRET_KEY")
            ;;
    esac

    # Check each variable
    for var in "${base_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done

    # Report missing variables
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo ""
        echo "⚠️  Warning: Missing required environment variables:"
        printf "  - %s\n" "${missing_vars[@]}"
        echo ""
        echo "Please set these variables before starting the application."
    else
        echo ""
        echo "✅ All required environment variables are set"
    fi
}

# Function to export environment for child processes
export_environment() {
    echo ""
    echo "🔧 Environment variables exported for current shell session"
    echo "Run this command to export to your current shell:"
    echo "  source $0 $1"
    echo ""
    echo "Or to load in another script:"
    echo "  source $SCRIPT_DIR/load-env.sh $1"
}

# Main execution
main() {
    local environment=${1:-development}

    # Validate arguments
    validate_environment "$environment"

    # Load the environment
    load_environment_file "$environment"

    # Export for child processes
    export_environment "$environment"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi