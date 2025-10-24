#!/bin/bash

# Directory Structure Validation Script for LabelMint
# Validates that the directory cleanup was successful

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo -e "${BLUE}=== Directory Structure Validation ===${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
    ((WARNINGS++))
}

# Test functions
test_directory_exists() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        print_success "$description exists"
        return 0
    else
        print_fail "$description does not exist"
        return 1
    fi
}

test_directory_not_exists() {
    local dir=$1
    local description=$2

    if [ ! -d "$dir" ]; then
        print_success "$description successfully removed"
        return 0
    else
        print_fail "$description still exists"
        return 1
    fi
}

test_file_moved() {
    local file=$1
    local target_dir=$2
    local description=$3

    if [ -f "$target_dir/$(basename $file)" ]; then
        print_success "$description moved to $target_dir"
        return 0
    else
        print_fail "$description not found in $target_dir"
        return 1
    fi
}

# Main validation
main() {
    print_header

    echo "Testing Directory Consolidation Results..."
    echo "========================================"

    # 1. Test consolidated directories exist
    echo ""
    echo "1. Testing Consolidated Directories:"

    test_directory_exists "tests" "Consolidated test directory"
    test_directory_exists ".ai-agents" "Consolidated AI agents directory"
    test_directory_exists "infrastructure/k8s" "Consolidated Kubernetes configs"
    test_directory_exists "infrastructure/monitoring" "Consolidated monitoring configs"
    test_directory_exists "config" "Centralized config directory"

    # 2. Test old directories are removed
    echo ""
    echo "2. Testing Old Directories Removed:"

    test_directory_not_exists "test" "Old test directory"
    test_directory_not_exists "ai-agents" "Old AI agents directory"
    test_directory_not_exists "k8s" "Old k8s directory"
    test_directory_not_exists "monitoring" "Old monitoring directory"
    test_directory_not_exists "src" "Legacy src directory"

    # 3. Test specific configuration files moved
    echo ""
    echo "3. Testing Configuration File Migration:"

    config_files=("docker-compose.yml" "hardhat.config.ts" "jest.config.js" "k6.config.js" "playwright.config.ts" "vitest.config.ts")

    for file in "${config_files[@]}"; do
        if [ -f "config/$file" ]; then
            print_success "$file moved to config/"
        else
            print_warning "$file not found in config/ (may not have existed)"
        fi
    done

    # 4. Test backup directories exist
    echo ""
    echo "4. Testing Backup Directories:"

    backup_dirs=("test.backup.*" "k8s.backup.*" "monitoring.backup.*" "src.backup.*")

    for pattern in "${backup_dirs[@]}"; do
        if ls -d $pattern 1> /dev/null 2>&1; then
            print_success "Backup directory found: $pattern"
        else
            print_warning "No backup directory found for pattern: $pattern"
        fi
    done

    # 5. Test directory structure quality
    echo ""
    echo "5. Testing Directory Structure Quality:"

    # Check for empty directories
    empty_dirs=$(find . -type d -empty -not -path "./.git/*" -not -path "./node_modules/*" -not -path "*backup*" | wc -l)
    if [ "$empty_dirs" -lt 10 ]; then
        print_success "Minimal empty directories ($empty_dirs found)"
    else
        print_warning "Many empty directories found ($empty_dirs found)"
    fi

    # Check for .gitkeep files
    gitkeep_files=$(find . -name ".gitkeep" | wc -l)
    if [ "$gitkeep_files" -gt 0 ]; then
        print_success "Git keep files present ($gitkeep_files found)"
    fi

    # 6. Test that key content is present
    echo ""
    echo "6. Testing Key Content Presence:"

    # Test directories have content
    if [ "$(find tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l)" -gt 0 ]; then
        print_success "Test files found in consolidated tests/ directory"
    else
        print_warning "No test files found in tests/ directory"
    fi

    if [ "$(find .ai-agents -name "*.md" | wc -l)" -gt 0 ]; then
        print_success "AI agent prompts found in .ai-agents/ directory"
    else
        print_warning "No AI agent prompts found in .ai-agents/ directory"
    fi

    if [ "$(find infrastructure/k8s -name "*.yaml" -o -name "*.yml" | wc -l)" -gt 0 ]; then
        print_success "Kubernetes configs found in infrastructure/k8s/"
    else
        print_warning "No Kubernetes configs found in infrastructure/k8s/"
    fi

    if [ "$(find infrastructure/monitoring -name "*.yml" -o -name "*.yaml" -o -name "*.json" | wc -l)" -gt 0 ]; then
        print_success "Monitoring configs found in infrastructure/monitoring/"
    else
        print_warning "No monitoring configs found in infrastructure/monitoring/"
    fi

    # 7. Summary
    echo ""
    echo "========================================"
    echo "VALIDATION SUMMARY"
    echo "========================================"
    echo ""
    echo -e "Passed:  ${GREEN}$PASSED${NC}"
    echo -e "Failed:  ${RED}$FAILED${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo ""

    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 Directory structure validation PASSED!${NC}"
        echo "All consolidation tasks completed successfully."
        exit 0
    else
        echo -e "${RED}❌ Directory structure validation FAILED!${NC}"
        echo "Some issues need to be addressed."
        exit 1
    fi
}

main "$@"