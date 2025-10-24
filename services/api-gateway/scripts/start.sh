#!/bin/bash

# LabelMint API Gateway Start Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting LabelMint API Gateway...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found, copying from .env.example${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please edit .env file with your configuration${NC}"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Create logs directory
mkdir -p logs

# Build the application
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}🔨 Building for production...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build complete${NC}"
    echo -e "${GREEN}🌟 Starting production server...${NC}"
    npm start
else
    echo -e "${GREEN}🌟 Starting development server...${NC}"
    npm run dev
fi