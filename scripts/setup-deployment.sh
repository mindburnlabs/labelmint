#!/bin/bash

# LabelMint TON Smart Contract Deployment Setup Script
# This script prepares the environment for contract deployment

set -e

echo "🚀 LabelMint TON Deployment Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "🔍 Checking Prerequisites"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "18" ]; then
        print_error "Node.js version 18 or higher is required (found $(node -v))"
        exit 1
    fi
    print_status "Node.js: $(node -v)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
    print_status "npm: $(npm -v)"

    # Check TypeScript
    if ! command -v tsc &> /dev/null; then
        print_warning "TypeScript compiler not found globally, installing..."
        npm install -g typescript
    fi
    print_status "TypeScript: $(tsc -v)"

    # Check Docker (for containerized deployment)
    if command -v docker &> /dev/null; then
        print_status "Docker: $(docker --version)"
    else
        print_warning "Docker not found - containerized deployment won't be available"
    fi

    # Check kubectl (for Kubernetes deployment)
    if command -v kubectl &> /dev/null; then
        print_status "kubectl: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
    else
        print_warning "kubectl not found - Kubernetes deployment won't be available"
    fi
}

# Setup environment variables
setup_environment() {
    print_header "📝 Setting Up Environment"

    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
# LabelMint TON Deployment Configuration

# Network
NETWORK=testnet

# Deployer Wallet Mnemonic (required)
DEPLOYER_MNEMONIC=

# API Keys (optional)
TESTNET_API_KEY=
MAINNET_API_KEY=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/labelmint

# Contract Configuration
INITIAL_BALANCE=100000000
GAS_LIMIT=50000000

# Monitoring
POLLING_INTERVAL=30
ENABLE_MONITORING=true
EOF
        print_warning "Please edit .env file and add your DEPLOYER_MNEMONIC"
    else
        print_status ".env file already exists"
    fi

    # Source environment variables
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
        print_status "Environment variables loaded"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "📦 Installing Dependencies"

    # Install Node.js dependencies
    print_status "Installing Node.js dependencies..."
    npm install

    # Install TON development dependencies if not present
    if [ ! -d "node_modules/@ton" ]; then
        print_status "Installing TON development dependencies..."
        npm install --save-dev @ton/ton @ton/crypto @ton/core @ton/sandbox
    fi

    # Install TypeScript dependencies
    print_status "Installing TypeScript dependencies..."
    npm install --save-dev typescript @types/node ts-node

    # Install Jest for testing
    print_status "Installing testing dependencies..."
    npm install --save-dev jest @types/jest ts-jest
}

# Build smart contracts
build_contracts() {
    print_header "🔨 Building Smart Contracts"

    if [ -d "contracts" ]; then
        cd contracts
        print_status "Building contracts..."
        npm run build
        cd ..
        print_status "Smart contracts built successfully"
    else
        print_warning "No contracts directory found"
    fi
}

# Setup database schema
setup_database() {
    print_header "🗄️ Setting Up Database"

    # Create database tables if they don't exist
    print_status "Creating database schema..."

    # This would typically run migrations or schema setup
    if [ -f "services/payment-backend/src/database/schema.sql" ]; then
        print_status "Database schema file found"
        # Here you would run: psql $DATABASE_URL -f schema.sql
        print_warning "Please run database migrations manually"
    else
        print_warning "No database schema file found"
    fi
}

# Setup Kubernetes resources
setup_kubernetes() {
    print_header "☸️ Setting Up Kubernetes Resources"

    if command -v kubectl &> /dev/null; then
        # Create namespace if it doesn't exist
        kubectl create namespace labelmint --dry-run=client -o yaml | kubectl apply -f -
        print_status "Namespace 'labelmint' ready"

        # Apply secrets configuration
        if [ -f "infrastructure/ton-deployment.yaml" ]; then
            print_status "Kubernetes deployment configuration found"
            print_warning "Please update secrets in ton-deployment.yaml before applying"
            print_status "To deploy: kubectl apply -f infrastructure/ton-deployment.yaml"
        fi
    else
        print_warning "kubectl not available - skipping Kubernetes setup"
    fi
}

# Run tests
run_tests() {
    print_header "🧪 Running Tests"

    # Run smart contract tests
    if [ -f "tests/blockchain/run-tests.sh" ]; then
        print_status "Running blockchain tests..."
        chmod +x tests/blockchain/run-tests.sh
        ./tests/blockchain/run-tests.sh
    else
        print_warning "No blockchain tests found"
    fi
}

# Validate deployment readiness
validate_deployment() {
    print_header "✅ Validating Deployment Readiness"

    local errors=0

    # Check environment variables
    if [ -z "$DEPLOYER_MNEMONIC" ]; then
        print_error "DEPLOYER_MNEMONIC is required"
        errors=$((errors + 1))
    fi

    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL is required"
        errors=$((errors + 1))
    fi

    # Check contract files
    if [ ! -f "contracts/output/PaymentProcessor_PaymentProcessor.ts" ]; then
        print_error "Smart contract build artifacts not found"
        print_status "Run: npm run build:contracts"
        errors=$((errors + 1))
    fi

    # Check deployment script
    if [ ! -f "scripts/deploy-smart-contracts.ts" ]; then
        print_error "Deployment script not found"
        errors=$((errors + 1))
    fi

    if [ $errors -eq 0 ]; then
        print_status "Deployment validation passed! ✅"
        return 0
    else
        print_error "Deployment validation failed with $errors errors ❌"
        return 1
    fi
}

# Show deployment commands
show_deployment_commands() {
    print_header "🚀 Deployment Commands"

    echo ""
    print_status "To deploy to testnet:"
    echo "  NETWORK=testnet DEPLOYER_MNEMONIC=\"your mnemonic here\" npm run deploy:contracts"
    echo ""
    print_status "To deploy to mainnet:"
    echo "  NETWORK=mainnet DEPLOYER_MNEMONIC=\"your mnemonic here\" npm run deploy:contracts"
    echo ""
    print_status "To run tests before deployment:"
    echo "  npm run test:blockchain"
    echo ""
    print_status "To deploy with Kubernetes:"
    echo "  # First update secrets in infrastructure/ton-deployment.yaml"
    echo "  kubectl apply -f infrastructure/ton-deployment.yaml"
    echo ""
}

# Main execution
main() {
    print_header "Starting LabelMint TON Deployment Setup"
    echo ""

    check_prerequisites
    setup_environment
    install_dependencies
    build_contracts
    setup_database
    setup_kubernetes
    run_tests

    if validate_deployment; then
        show_deployment_commands
        print_header "🎉 Setup completed successfully!"
        echo ""
        print_status "You're ready to deploy your smart contracts!"
        echo ""
    else
        print_error "Setup failed - please fix the errors above"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "LabelMint TON Deployment Setup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --test         Run tests only"
        echo "  --build        Build contracts only"
        echo "  --deploy       Validate deployment readiness only"
        echo ""
        exit 0
        ;;
    --test)
        run_tests
        exit 0
        ;;
    --build)
        build_contracts
        exit 0
        ;;
    --deploy)
        validate_deployment
        exit $?
        ;;
    *)
        main
        ;;
esac