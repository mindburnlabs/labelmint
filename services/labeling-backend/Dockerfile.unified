# Unified Production Dockerfile for LabelMint Labeling Backend
# Optimized multi-stage build with security best practices

# Base stage with common dependencies
FROM node:20-alpine AS base
LABEL maintainer="LabelMint Team <dev@labelmint.com>"
LABEL version="1.0.0"
LABEL description="LabelMint Labeling Backend Service"

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@9.15.1 && \
    pnpm install --frozen-lockfile --prod=false

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build the application
RUN pnpm run build

# Production runner stage
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    ca-certificates

# Create non-root user with proper UID/GID
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodejs

# Set working directory
WORKDIR /app

# Copy built application and dependencies with proper ownership
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Create necessary directories for runtime
RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3101
ENV HOSTNAME="0.0.0.0"

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3101

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3101/health || exit 1

# Use dumb-init as PID 1 to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]