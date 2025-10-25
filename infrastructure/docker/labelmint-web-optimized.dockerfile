# Production-Optimized Multi-Stage Dockerfile for LabelMint Web Application
# ==============================================================================
# Optimized for security, size, and performance in production environments
# ==============================================================================

# ===========================================
# Base stage with common runtime dependencies
# ===========================================
FROM node:20-alpine AS base
LABEL maintainer="LabelMint DevOps <devops@labelmint.it>"
LABEL version="2.0.0"
LABEL description="LabelMint Web Application - Production Optimized"

# Install security updates and runtime dependencies
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        ca-certificates \
        tzdata \
        curl \
        dumb-init \
        && rm -rf /var/cache/apk/* \
    && update-ca-certificates

# Create non-root user with proper security context
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 --shell /bin/bash nodejs && \
    mkdir -p /app && \
    chown -R nodejs:nodejs /app

# Set working directory
WORKDIR /app

# ===========================================
# Dependencies stage - Optimized layer caching
# ===========================================
FROM base AS deps
# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Install pnpm globally with specific version
RUN npm install -g pnpm@9.15.1

# Copy package files with optimized caching
COPY package.json pnpm-lock.yaml* ./
COPY packages/web/package.json ./packages/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with security audit and frozen lockfile
RUN pnpm install --frozen-lockfile --prefer-frozen-lockfile --audit --strict-peer-dependencies

# Install production dependencies only
FROM base AS production-deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# ===========================================
# Builder stage with optimization flags
# ===========================================
FROM base AS builder
# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Install pnpm globally
RUN npm install -g pnpm@9.15.1

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Build arguments for version tracking and optimization
ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_BUILD_DATE
ARG NEXT_PUBLIC_COMMIT_BRANCH
ARG NEXT_PUBLIC_COMMIT_SHA
ARG BUILD_NUMBER

# Environment variables for optimized build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV ANALYZE=false
ENV NEXT_MINIMIZE=true
ENV TURBOPACK=1
ENV NEXT_WEBPACK_USEPOLLING=false

# Set build metadata
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION:-unknown}
ENV NEXT_PUBLIC_BUILD_DATE=${NEXT_PUBLIC_BUILD_DATE:-unknown}
ENV NEXT_PUBLIC_COMMIT_BRANCH=${NEXT_PUBLIC_COMMIT_BRANCH:-unknown}
ENV NEXT_PUBLIC_COMMIT_SHA=${NEXT_PUBLIC_COMMIT_SHA:-unknown}
ENV NEXT_PUBLIC_BUILD_NUMBER=${BUILD_NUMBER:-0}

# Build the application with optimizations
RUN pnpm run build:web

# ===========================================
# Production runner stage - Security Hardened
# ===========================================
FROM base AS runner
# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV LOG_LEVEL=warn

# Copy built application with correct permissions
COPY --from=builder --chown=nodejs:nodejs /app/packages/web/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/web/.next/static ./.next/static

# Copy package.json for runtime dependencies
COPY --from=production-deps --chown=nodejs:nodejs /app/packages/web/package.json ./package.json

# Create required directories with proper permissions
RUN mkdir -p /app/tmp /app/cache && \
    chown -R nodejs:nodejs /app/tmp /app/cache

# Switch to non-root user for security
USER nodejs

# Expose port
EXPOSE 3002

# Health check with proper timeout, retries, and detailed output
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f -s --max-time 5 http://localhost:3002/api/health || exit 1

# Use dumb-init for proper signal handling and zombie process cleanup
ENTRYPOINT ["dumb-init", "--"]

# Start the application with optimized Node.js flags
CMD ["node", "--max-old-space-size=2048", "--enable-source-maps", "server.js"]

# ===========================================
# Security scanning and metadata
# ===========================================
LABEL security.scan.enabled="true"
LABEL security.scan.type="vulnerability,configuration"
LABEL security.scan.frequency="daily"
LABEL org.label-schema.vendor="LabelMint"
LABEL org.label-schema.name="LabelMint Web Application"
LABEL org.label-schema.version=${NEXT_PUBLIC_APP_VERSION:-unknown}
LABEL org.label-schema.build-date=${NEXT_PUBLIC_BUILD_DATE:-unknown}
LABEL org.label-schema.vcs-ref=${NEXT_PUBLIC_COMMIT_SHA:-unknown}
LABEL org.label-schema.vcs-branch=${NEXT_PUBLIC_COMMIT_BRANCH:-unknown}