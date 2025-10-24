#!/bin/bash

# Project Structure Validation Script
# Ensures the project structure remains consistent with the blueprint

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

echo -e "${BLUE}🔍 Validating Project Structure${NC}"
echo -e "${BLUE}===================================${NC}"

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Required directories structure
REQUIRED_DIRS=(
    "apps"
    "apps/web"
    "apps/telegram-mini-app"
    "apps/admin"
    "services"
    "services/labeling-backend"
    "services/payment-backend"
    "services/api-gateway"
    "packages"
    "packages/shared"
    "packages/ui"
    "packages/clients"
    "infrastructure"
    "infrastructure/docker"
    "infrastructure/k8s"
    "infrastructure/monitoring"
    "docs"
    "scripts"
    "scripts/dev"
    "scripts/build"
    "config"
    "config/shared"
    "config/databases"
    ".github/workflows"
)

# Required files
REQUIRED_FILES=(
    "package.json"
    "pnpm-workspace.yaml"
    "README.md"
    ".env.example"
    "TARGET_STRUCTURE.md"
    "config/shared/tsconfig.base.json"
    "config/shared/eslint.config.js"
    "config/shared/prettier.config.js"
    "config/databases/schema.prisma"
    "scripts/dev/start-all.sh"
    "scripts/build/build-all.sh"
    "infrastructure/docker/docker-compose.yml"
    "packages/shared/types/index.ts"
    "packages/shared/utils/index.ts"
    "packages/shared/validation/index.ts"
    "packages/shared/database/index.ts"
    "packages/ui/index.ts"
)

# Function to check directory
check_directory() {
    local dir=$1
    local required=${2:-true}

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ Directory exists: $dir${NC}"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Required directory missing: $dir${NC}"
            ((VALIDATION_ERRORS++))
        else
            echo -e "${YELLOW}⚠️  Optional directory missing: $dir${NC}"
            ((VALIDATION_WARNINGS++))
        fi
        return 1
    fi
}

# Function to check file
check_file() {
    local file=$1
    local required=${2:-true}

    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ File exists: $file${NC}"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Required file missing: $file${NC}"
            ((VALIDATION_ERRORS++))
        else
            echo -e "${YELLOW}⚠️  Optional file missing: $file${NC}"
            ((VALIDATION_WARNINGS++))
        fi
        return 1
    fi
}

# Function to check package.json structure
check_package_json() {
    local package_file=$1
    local expected_name=$2

    if [ -f "$package_file" ]; then
        local name=$(jq -r '.name' "$package_file" 2>/dev/null || echo "invalid")

        if [ "$name" = "$expected_name" ]; then
            echo -e "${GREEN}✅ Package name correct: $expected_name${NC}"
        else
            echo -e "${RED}❌ Package name incorrect in $package_file. Expected: $expected_name, Got: $name${NC}"
            ((VALIDATION_ERRORS++))
        fi
    fi
}

# Validate directories
echo -e "\n${YELLOW}📁 Checking required directories...${NC}"
for dir in "${REQUIRED_DIRS[@]}"; do
    check_directory "$dir" true
done

# Validate files
echo -e "\n${YELLOW}📄 Checking required files...${NC}"
for file in "${REQUIRED_FILES[@]}"; do
    check_file "$file" true
done

# Validate package.json files
echo -e "\n${YELLOW}📦 Checking package.json files...${NC}"

# Root package.json
check_package_json "package.json" "labelmint.it"

# Services
if [ -f "services/labeling-backend/package.json" ]; then
    check_package_json "services/labeling-backend/package.json" "@labelmint/labeling-backend"
fi

if [ -f "services/payment-backend/package.json" ]; then
    check_package_json "services/payment-backend/package.json" "@labelmint/payment-backend"
fi

# Apps
if [ -f "apps/web/package.json" ]; then
    check_package_json "apps/web/package.json" "@labelmint/web"
fi

if [ -f "apps/telegram-mini-app/package.json" ]; then
    check_package_json "apps/telegram-mini-app/package.json" "@labelmint/telegram-mini-app"
fi

# Packages
if [ -f "packages/shared/package.json" ]; then
    check_package_json "packages/shared/package.json" "@labelmint/shared"
fi

if [ -f "packages/ui/package.json" ]; then
    check_package_json "packages/ui/package.json" "@labelmint/ui"
fi

# Check workspace configuration
echo -e "\n${YELLOW}🔧 Checking workspace configuration...${NC}"
if [ -f "pnpm-workspace.yaml" ]; then
    if grep -q "apps/\|services/\|packages/\|config/" pnpm-workspace.yaml; then
        echo -e "${GREEN}✅ Workspace configuration looks correct${NC}"
    else
        echo -e "${RED}❌ Workspace configuration may be incorrect${NC}"
        ((VALIDATION_ERRORS++))
    fi
fi

# Check for forbidden directories
echo -e "\n${YELLOW}🚫 Checking for forbidden directories...${NC}"
FORBIDDEN_DIRS=(
    "telegram-labeling-platform"
    "backend"
    "labeling-platform"
    "src"
    "frontend"
)

for dir in "${FORBIDDEN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${RED}❌ Forbidden directory found: $dir${NC}"
        ((VALIDATION_ERRORS++))
    else
        echo -e "${GREEN}✅ No forbidden directory: $dir${NC}"
    fi
done

# Check TypeScript configurations
echo -e "\n${YELLOW}📝 Checking TypeScript configurations...${NC}"
if [ -f "config/shared/tsconfig.base.json" ]; then
    if grep -q "@labelmint/" config/shared/tsconfig.base.json; then
        echo -e "${GREEN}✅ TypeScript base config has correct path mappings${NC}"
    else
        echo -e "${YELLOW}⚠️  TypeScript base config may be missing path mappings${NC}"
        ((VALIDATION_WARNINGS++))
    fi
fi

# Check git status
echo -e "\n${YELLOW}📋 Checking git status...${NC}"
if [ -d ".git" ]; then
    if git diff --quiet HEAD; then
        echo -e "${GREEN}✅ No uncommitted changes${NC}"
    else
        echo -e "${YELLOW}⚠️  There are uncommitted changes${NC}"
        ((VALIDATION_WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository${NC}"
    ((VALIDATION_WARNINGS++))
fi

# Summary
echo -e "\n${BLUE}===================================${NC}"
echo -e "${BLUE}Validation Summary:${NC}"

if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed!${NC}"
    echo -e "${GREEN}🎉 Project structure is correct!${NC}"
else
    echo -e "${RED}❌ Found $VALIDATION_ERRORS error(s)${NC}"
    echo -e "${YELLOW}⚠️  Found $VALIDATION_WARNINGS warning(s)${NC}"
    echo -e "\n${RED}Please fix the errors before proceeding.${NC}"
    exit 1
fi

if [ $VALIDATION_WARNINGS -gt 0 ]; then
    echo -e "\n${YELLOW}💡 Consider addressing the warnings for better structure.${NC}"
fi

echo -e "\n${GREEN}🚀 Ready for development!${NC}"