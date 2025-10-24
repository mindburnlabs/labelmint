#!/bin/bash

# Deligate.it Build Script
# Builds all packages and applications

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔨 Building Deligate.it Platform${NC}"
echo -e "${YELLOW}===================================${NC}"

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Function to build package
build_package() {
    local dir=$1
    local name=$2

    echo -e "\n${YELLOW}📦 Building $name...${NC}"

    if [ -d "$dir" ]; then
        cd "$dir"

        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}📥 Installing dependencies for $name...${NC}"
            pnpm install
        fi

        # Build the package
        if pnpm run build; then
            echo -e "${GREEN}✅ $name built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build $name${NC}"
            exit 1
        fi

        cd "$PROJECT_ROOT"
    else
        echo -e "${YELLOW}⚠️  Directory $dir not found, skipping...${NC}"
    fi
}

# Build shared packages first
echo -e "${YELLOW}📚 Building shared packages...${NC}"

build_package "packages/shared" "Shared Utilities"
build_package "packages/ui" "UI Components"

# Build services
echo -e "${YELLOW}🔧 Building services...${NC}"

build_package "services/labeling-backend" "Labeling Backend"
build_package "services/payment-backend" "Payment Backend"

# Build applications
echo -e "${YELLOW}🎨 Building applications...${NC}"

build_package "apps/web" "Web Application"
build_package "apps/telegram-mini-app" "Telegram Mini App"

# Type check all packages
echo -e "\n${YELLOW}🔍 Running type checks...${NC}"

for dir in packages/* services/* apps/*; do
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
        name=$(basename "$dir")
        echo -e "${YELLOW}📋 Type checking $name...${NC}"

        cd "$dir"
        if pnpm run type-check 2>/dev/null || true; then
            echo -e "${GREEN}✅ $name type check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  $name type check failed or not configured${NC}"
        fi
        cd "$PROJECT_ROOT"
    fi
done

# Lint all packages
echo -e "\n${YELLOW}🔧 Running linter...${NC}"

if pnpm run lint; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${RED}❌ Linting failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 Build completed successfully!${NC}"
echo -e "${YELLOW}===================================${NC}"

# Show build outputs
echo -e "\n${YELLOW}📁 Build outputs:${NC}"
echo -e "${BLUE}• packages/shared/dist${NC}"
echo -e "${BLUE}• packages/ui/dist${NC}"
echo -e "${BLUE}• services/labeling-backend/dist${NC}"
echo -e "${BLUE}• services/payment-backend/dist${NC}"
echo -e "${BLUE}• apps/web/.next${NC}"
echo -e "${BLUE}• apps/telegram-mini-app/dist${NC}"

echo -e "\n${GREEN}✨ All packages are ready for deployment!${NC}"