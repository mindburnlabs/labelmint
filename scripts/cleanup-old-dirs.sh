#!/bin/bash

# Cleanup old directories after restructuring
# This script removes old backend directories and source files

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 Cleaning up old directories...${NC}"
echo -e "${BLUE}===================================${NC}"

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Directories to remove
OLD_DIRS=(
    "telegram-labeling-platform"
    "backend"
    "labeling-platform"
    "src"
    "frontend"
)

# Files to remove
OLD_FILES=(
    "next-env.d.ts"
    "next.config.js"
    "postcss.config.js"
    "tailwind.config.js"
    "tsconfig.json"
    "eslint.config.js"
    "COMPLIANCE.md"
    "DEPLOYMENT.md"
    "Dockerfile"
    "PRODUCTION_README.md"
    "VERIFY_STRUCTURE.md"
)

# Function to safely remove directory
remove_directory() {
    local dir=$1

    if [ -d "$dir" ]; then
        echo -e "${YELLOW}🗑️  Removing directory: $dir${NC}"

        # Check if directory has important files
        if [ -f "$dir/.gitkeep" ] || [ -f "$dir/README.md" ]; then
            echo -e "${YELLOW}⚠️  Directory $dir contains important files, skipping...${NC}"
            return
        fi

        # Create backup before removing
        if [ "$1" = "telegram-labeling-platform" ] || [ "$1" = "backend" ]; then
            echo -e "${YELLOW}💾 Creating backup of $dir...${NC}"
            mv "$dir" "$dir.backup.$(date +%Y%m%d_%H%M%S)"
        else
            rm -rf "$dir"
            echo -e "${GREEN}✅ Removed $dir${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Directory $dir not found${NC}"
    fi
}

# Function to safely remove file
remove_file() {
    local file=$1

    if [ -f "$file" ]; then
        echo -e "${YELLOW}🗑️  Removing file: $file${NC}"

        # Check if it's a config file that might be needed
        if [[ "$file" == *.config.* ]] || [[ "$file" == ".env"* ]]; then
            echo -e "${YELLOW}💾 Creating backup of $file...${NC}"
            mv "$file" "$file.backup.$(date +%Y%m%d_%H%M%S)"
        else
            rm "$file"
            echo -e "${GREEN}✅ Removed $file${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  File $file not found${NC}"
    fi
}

# Remove old directories
echo -e "\n${YELLOW}📁 Removing old directories...${NC}"
for dir in "${OLD_DIRS[@]}"; do
    remove_directory "$dir"
done

# Remove old files
echo -e "\n${YELLOW}📄 Removing old files...${NC}"
for file in "${OLD_FILES[@]}"; do
    remove_file "$file"
done

# Clean up any remaining node_modules in root
if [ -d "node_modules" ] && [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 Root package.json found, keeping node_modules${NC}"
fi

# Clean up any backup files older than 7 days
echo -e "\n${YELLOW}🗑️  Cleaning up old backups...${NC}"
find . -name "*.backup.*" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
find . -name "*.backup.*" -type f -mtime +7 -delete 2>/dev/null || true

# Show final directory structure
echo -e "\n${GREEN}✅ Cleanup completed!${NC}"
echo -e "${BLUE}===================================${NC}"
echo -e "\n${YELLOW}📁 Current directory structure:${NC}"
tree -L 2 -I 'node_modules|.next|.git|dist|build|coverage|*.backup.*' --dirsfirst

echo -e "\n${GREEN}🎉 Restructuring completed successfully!${NC}"
echo -e "${YELLOW}💡 Tip: Use './scripts/dev/start-all.sh' to start the new environment${NC}"