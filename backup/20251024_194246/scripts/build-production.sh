#!/bin/bash

# Production Build Script for labelmint.it
set -e

echo "🚀 Starting production build for labelmint.it..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Set NODE_ENV to production
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

print_status "Environment set to production"

# Clean previous builds
print_status "Cleaning previous builds..."
pnpm run clean

# Install dependencies
print_status "Installing dependencies..."
pnpm install --frozen-lockfile --prod=false

# Type checking
print_status "Running type check..."
pnpm run type-check

# Linting
print_status "Running linter..."
pnpm run lint

# Build the application
print_status "Building application..."
pnpm run build

# Check if build was successful
if [ -d ".next" ]; then
    print_status "✅ Build successful!"
else
    print_error "❌ Build failed!"
    exit 1
fi

# Generate build info
print_status "Generating build info..."
cat > .next/BUILD_INFO << EOF
Build Date: $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
Version: $(node -p "require('./package.json').version")
Node Version: $(node --version)
Environment: production
EOF

# Optimize for production
print_status "Optimizing for production..."

# Remove unnecessary files from .next
find .next -name "*.map" -delete 2>/dev/null || true
find .next -name "hot-reloader.js" -delete 2>/dev/null || true

print_status "✅ Production build complete!"
print_status "Build artifacts are in the .next directory"
print_status "To start the production server: pnpm start"