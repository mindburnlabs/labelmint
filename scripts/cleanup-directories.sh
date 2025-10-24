#!/bin/bash

# Directory Structure Cleanup Script for LabelMint
# This script consolidates duplicate directories and cleans up the repository structure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to create directory if it doesn't exist
ensure_dir() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        print_status "Created directory: $1"
    fi
}

# Function to backup directory before consolidation
backup_dir() {
    local dir=$1
    local backup_name="${dir}.backup.$(date +%Y%m%d_%H%M%S)"

    if [ -d "$dir" ]; then
        cp -r "$dir" "$backup_name"
        print_status "Backed up $dir to $backup_name"
    fi
}

# Function to merge directories
merge_dirs() {
    local source=$1
    local target=$2

    if [ ! -d "$source" ]; then
        print_warning "Source directory $source does not exist"
        return
    fi

    ensure_dir "$target"

    print_status "Merging $source into $target..."

    # Copy all contents from source to target
    find "$source" -mindepth 1 -type d | while read -r dir; do
        relative_path="${dir#$source/}"
        target_dir="$target/$relative_path"
        ensure_dir "$target_dir"
    done

    find "$source" -mindepth 1 -type f | while read -r file; do
        relative_path="${file#$source/}"
        target_file="$target/$relative_path"

        if [ -f "$target_file" ]; then
            # Handle file conflicts
            backup_file="${target_file}.conflict.$(date +%s)"
            mv "$target_file" "$backup_file"
            print_warning "Conflict detected: backed up existing $target_file to $backup_file"
        fi

        cp "$file" "$target_file"
    done

    print_success "Merged $source into $target"
}

# Function to update import paths in files
update_import_paths() {
    local old_path=$1
    local new_path=$2

    print_status "Updating import paths from '$old_path' to '$new_path'..."

    # Find all TypeScript and JavaScript files
    find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./scripts/*" | while read -r file; do
        if grep -q "$old_path" "$file"; then
            # Create backup
            cp "$file" "$file.import-backup.$(date +%s)"
            # Replace import paths
            sed -i.bak "s|$old_path|$new_path|g" "$file"
            print_status "Updated import paths in $file"
            # Remove the sed backup file
            rm -f "$file.bak"
        fi
    done
}

# Main execution
main() {
    print_status "Starting directory structure cleanup..."

    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi

    # 1. Consolidate test directories
    print_status "=== Consolidating Test Directories ==="
    backup_dir "test"
    backup_dir "tests"

    # Merge test/ into tests/
    if [ -d "test" ]; then
        merge_dirs "test" "tests"

        # Update import paths
        update_import_paths "from ['\"]test/" "from ['\"]tests/"
        update_import_paths "from ['\"]./test/" "from ['\"]./tests/"

        # Remove old directory
        rm -rf "test"
        print_success "Removed test/ directory"
    fi

    # 2. Consolidate AI agent directories
    print_status "=== Consolidating AI Agent Directories ==="
    backup_dir ".ai-agents"
    backup_dir "ai-agents"

    # Move ai-agents/orchestrator-system-prompt.md to .ai-agents/
    if [ -f "ai-agents/orchestrator-system-prompt.md" ]; then
        cp "ai-agents/orchestrator-system-prompt.md" ".ai-agents/"
        rm -rf "ai-agents"
        print_success "Consolidated AI agent directories into .ai-agents/"
    fi

    # 3. Consolidate infrastructure directories
    print_status "=== Consolidating Infrastructure Directories ==="
    backup_dir "infrastructure/k8s"
    backup_dir "k8s"

    # Merge k8s/ into infrastructure/k8s/
    if [ -d "k8s" ]; then
        merge_dirs "k8s" "infrastructure/k8s"

        # Remove old directory
        rm -rf "k8s"
        print_success "Removed k8s/ directory, merged into infrastructure/k8s/"
    fi

    backup_dir "infrastructure/monitoring"
    backup_dir "monitoring"

    # Merge monitoring/ into infrastructure/monitoring/
    if [ -d "monitoring" ]; then
        merge_dirs "monitoring" "infrastructure/monitoring"

        # Remove old directory
        rm -rf "monitoring"
        print_success "Removed monitoring/ directory, merged into infrastructure/monitoring/"
    fi

    # 4. Handle legacy src/ directory
    print_status "=== Cleaning Legacy src/ Directory ==="
    if [ -d "src" ]; then
        # Check if src/ is empty or only contains empty directories
        if [ -z "$(find src -type f -not -path "*/.*" 2>/dev/null)" ]; then
            backup_dir "src"
            rm -rf "src"
            print_success "Removed empty src/ directory"
        else
            print_warning "src/ directory contains files. Please review manually."
            find src -type f -not -path "*/.*" | head -10
        fi
    fi

    # 5. Create proper configuration structure
    print_status "=== Standardizing Configuration Files ==="

    # Move root-level config files to config/ directory
    config_files=(
        "docker-compose*.yml"
        "hardhat.config.ts"
        "jest.config.js"
        "k6.config.js"
        "playwright.config.ts"
        "vitest*.config.ts"
    )

    for pattern in "${config_files[@]}"; do
        for file in $pattern; do
            if [ -f "$file" ]; then
                mv "$file" "config/"
                print_status "Moved $file to config/"
            fi
        done
    done

    # 6. Remove empty directories
    print_status "=== Removing Empty Directories ==="
    find . -type d -empty -not -path "./.git/*" -not -path "./node_modules/*" | while read -r dir; do
        rmdir "$dir" 2>/dev/null || true
        print_status "Removed empty directory: $dir"
    done

    # 7. Create .gitkeep files where needed
    print_status "=== Creating .gitkeep Files ==="
    important_dirs=(
        "tests/e2e"
        "tests/integration"
        "tests/load"
        "tests/security"
        "tests/unit"
        "tests/visual"
        "logs"
        "uploads"
        "coverage"
    )

    for dir in "${important_dirs[@]}"; do
        if [ -d "$dir" ] && [ -z "$(find "$dir" -mindepth 1 -type f 2>/dev/null)" ]; then
            touch "$dir/.gitkeep"
            print_status "Created .gitkeep in $dir"
        fi
    done

    print_success "Directory structure cleanup completed!"
    print_status "Please review the changes and commit them when satisfied."
    print_status "Backup directories have been created with .backup suffix."
}

# Run main function
main "$@"