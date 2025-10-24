#!/bin/bash

# Update path references after directory consolidation

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Update file paths in all non-backup files
update_paths() {
    local old_path=$1
    local new_path=$2

    print_status "Updating references from '$old_path' to '$new_path'..."

    find . -type f \( -name "*.md" -o -name "*.ts" -o -name "*.js" -o -name "*.yml" -o -name "*.yaml" \) \
        -not -path "./node_modules/*" \
        -not -path "./.git/*" \
        -not -path "./backup/*" \
        -not -path "*.backup.*" \
        -exec grep -l "$old_path" {} \; | while read -r file; do

        # Create backup
        cp "$file" "$file.path-backup.$(date +%s)"

        # Replace paths
        sed -i.bak "s|$old_path|$new_path|g" "$file"

        print_status "Updated $file"
        # Remove sed backup
        rm -f "$file.bak"
    done
}

# Main updates
main() {
    print_status "Starting path reference updates..."

    # Update k8s references to infrastructure/k8s
    update_paths "k8s/" "infrastructure/k8s/"
    update_paths "\`k8s/" "\`infrastructure/k8s/"
    update_paths "k8s\\/" "infrastructure\\/k8s\\/"

    # Update monitoring references to infrastructure/monitoring
    update_paths "monitoring/" "infrastructure/monitoring/"
    update_paths "\`monitoring/" "\`infrastructure/monitoring/"
    update_paths "monitoring\\/" "infrastructure\\/monitoring\\/"

    # Update config references for moved files
    update_paths "docker-compose.yml" "config/docker-compose.yml"
    update_paths "hardhat.config.ts" "config/hardhat.config.ts"
    update_paths "jest.config.js" "config/jest.config.js"
    update_paths "k6.config.js" "config/k6.config.js"
    update_paths "playwright.config.ts" "config/playwright.config.ts"
    update_paths "vitest.config.ts" "config/vitest.config.ts"

    print_success "Path reference updates completed!"
    print_status "Backup files have been created with .path-backup suffix."
}

main "$@"