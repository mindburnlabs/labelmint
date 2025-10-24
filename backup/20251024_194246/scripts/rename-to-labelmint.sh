#!/bin/bash

# Script to rename labelmint.it to LabelMint throughout the codebase
set -e

echo "🔄 Starting rename from labelmint.it to LabelMint..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Navigate to project root
cd "$(dirname "$0")/.."

print_status "Starting rename process..."

# Create a backup of important files before making changes
print_status "Creating backup of critical configuration files..."
cp package.json package.json.backup
cp README.md README.md.backup

# 1. Update package.json if it still has labelmint references
if grep -q "labelmint" package.json; then
    print_status "Updating package.json..."
    sed -i '' 's/labelmint/labelmint/g' package.json
    sed -i '' 's/labelmint\.it/labelmint/g' package.json
fi

# 2. Update environment files
print_status "Updating environment files..."
find . -name ".env*" -type f ! -path "*/node_modules/*" ! -path "*/.next/*" | while read -r file; do
    if grep -q "labelmint" "$file"; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 3. Update Docker and configuration files
print_status "Updating Docker configuration files..."
find . -name "docker-compose*.yml" -o -name "Dockerfile*" -o -name "*.yml" -o -name "*.yaml" | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 4. Update database files
print_status "Updating database files..."
find ./database -name "*.sql" -o -name "*.ini" -o -name "*.sh" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 5. Update migration files
print_status "Updating migration files..."
find ./supabase/migrations -name "*.sql" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 6. Update documentation files
print_status "Updating documentation files..."
find ./docs -name "*.md" -o -name "*.json" -o -name "*.yaml" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 7. Update script files
print_status "Updating script files..."
find ./scripts -name "*.js" -o -name "*.sh" -o -name "*.sql" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 8. Update infrastructure files
print_status "Updating infrastructure files..."
find ./infrastructure -name "*.tf" -o -name "*.tfvars" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.js" -o -name "*.toml" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 9. Update Kubernetes files
print_status "Updating Kubernetes files..."
find ./k8s -name "*.yaml" -o -name "*.yml" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 10. Update monitoring files
print_status "Updating monitoring files..."
find ./monitoring -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.conf" -o -name "*.sh" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 11. Update GitHub Actions
print_status "Updating GitHub Actions..."
find ./.github -name "*.yml" -o -name "*.yaml" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 12. Update TypeScript/JavaScript files in services and apps (excluding node_modules and .next)
print_status "Updating source code files..."
find ./services ./apps ./packages -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 13. Update root level files
print_status "Updating root level files..."
find . -maxdepth 1 -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" -o -name "*.js" -o -name "*.sh" -o -name "*.txt" -o -name "*.xml" 2>/dev/null | while read -r file; do
    if grep -q "labelmint" "$file" 2>/dev/null; then
        print_warning "Updating $file"
        sed -i '' 's/labelmint/labelmint/g' "$file"
        sed -i '' 's/labelmint\.it/labelmint/g' "$file"
    fi
done

# 14. Handle special cases - database URLs and connection strings
print_status "Updating database URLs and connection strings..."
grep -r "labelmint.it" . --include="*.env*" --include="*.js" --include="*.ts" --include="*.json" --include="*.yml" --include="*.yaml" --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    print_warning "Found labelmint.it in $file - please review manually"
done

# Clean up backup files
print_status "Cleaning up backup files..."
rm -f package.json.backup README.md.backup

print_status "✅ Rename process completed!"
print_warning "⚠️  Please review the changes carefully before committing."
print_warning "⚠️  Pay special attention to:"
print_warning "   - Database connection strings"
print_warning "   - API URLs and endpoints"
print_warning "   - Environment variable references"
print_warning "   - Any hardcoded URLs or references"

echo ""
print_status "Next steps:"
echo "1. Review the changes with: git diff"
echo "2. Test the application locally"
echo "3. Update any external references (documentation, repos, etc.)"
echo "4. Commit the changes"