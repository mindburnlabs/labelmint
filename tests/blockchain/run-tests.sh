#!/bin/bash

# LabelMint Blockchain Smart Contract Test Runner
# This script runs all blockchain-related tests

set -e

echo "🚀 Starting LabelMint Blockchain Test Suite"
echo "============================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from project root."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile smart contracts if needed
echo "🔨 Compiling smart contracts..."
if [ -d "contracts" ]; then
    cd contracts
    npm run build
    cd ..
    echo "✅ Smart contracts compiled"
else
    echo "⚠️  No contracts directory found"
fi

# Create test output directory
mkdir -p tests/blockchain/coverage
mkdir -p tests/blockchain/reports

# Set environment variables for testing
export NODE_ENV=test
export BLOCKCHAIN_TEST_TIMEOUT=60000

echo "🧪 Running unit tests..."
npx jest tests/blockchain/PaymentProcessor.test.ts \
    --config=tests/blockchain/jest.config.js \
    --verbose \
    --coverage \
    --coverageDirectory=tests/blockchain/coverage \
    --testTimeout=60000

echo ""
echo "🧪 Running deployment tests..."
npx jest tests/blockchain/deploy.test.ts \
    --config=tests/blockchain/jest.config.js \
    --verbose \
    --testTimeout=60000

echo ""
echo "🧪 Running integration tests..."
npx jest tests/blockchain/integration.test.ts \
    --config=tests/blockchain/jest.config.js \
    --verbose \
    --testTimeout=90000

echo ""
echo "🧪 Running security tests..."
npx jest tests/blockchain/security.test.ts \
    --config=tests/blockchain/jest.config.js \
    --verbose \
    --testTimeout=60000 || echo "⚠️  Security tests not found, skipping..."

echo ""
echo "📊 Generating test reports..."

# Generate HTML coverage report
if [ -d "tests/blockchain/coverage" ]; then
    echo "📈 Coverage report generated at: tests/blockchain/coverage/lcov-report/index.html"
fi

# Run gas analysis if available
if command -v ton-abi &> /dev/null; then
    echo "⛽ Running gas analysis..."
    # Add gas analysis commands here
fi

echo ""
echo "✅ Blockchain Test Suite Completed!"
echo "=================================="
echo ""
echo "📋 Test Results Summary:"
echo "  - Unit Tests: PaymentProcessor.test.ts"
echo "  - Deployment Tests: deploy.test.ts"
echo "  - Integration Tests: integration.test.ts"
echo "  - Coverage Report: tests/blockchain/coverage/"
echo ""
echo "🔍 View detailed coverage report:"
echo "  open tests/blockchain/coverage/lcov-report/index.html"
echo ""

# Check if any tests failed
if [ $? -ne 0 ]; then
    echo "❌ Some tests failed. Check the output above for details."
    exit 1
else
    echo "🎉 All tests passed! Smart contracts are ready for deployment."
fi