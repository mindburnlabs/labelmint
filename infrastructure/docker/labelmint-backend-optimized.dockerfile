# Production-Optimized Multi-Stage Dockerfile for LabelMint Backend Services
# ==============================================================================
# Optimized for security, performance, and microservices architecture
# ==============================================================================

# ===========================================
# Base stage with common runtime dependencies
# ===========================================
FROM node:20-alpine AS base
LABEL maintainer="LabelMint DevOps <devops@labelmint.it>"
LABEL version="2.0.0"
LABEL description="LabelMint Backend Services - Production Optimized"

# Install security updates and runtime dependencies
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        ca-certificates \
        tzdata \
        curl \
        dumb-init \
        postgresql-client \
        redis-tools \
        && rm -rf /var/cache/apk/* \
    && update-ca-certificates

# Create non-root user with proper security context
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 --shell /bin/bash nodejs && \
    mkdir -p /app /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Set working directory
WORKDIR /app

# ===========================================
# Dependencies stage - Optimized layer caching
# ===========================================
FROM base AS deps
# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++ pkgconfig

# Install pnpm globally with specific version
RUN npm install -g pnpm@9.15.1

# Copy package files with optimized caching
COPY package.json pnpm-lock.yaml* ./
COPY services/labeling-backend/package.json ./services/labeling-backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with security audit and frozen lockfile
RUN pnpm install --frozen-lockfile --prefer-frozen-lockfile --audit --strict-peer-dependencies

# ===========================================
# Builder stage with optimization flags
# ===========================================
FROM base AS builder
# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++ pkgconfig

# Install pnpm globally
RUN npm install -g pnpm@9.15.1

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/labeling-backend/node_modules ./services/labeling-backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Build arguments for version tracking and optimization
ARG APP_VERSION
ARG BUILD_DATE
ARG COMMIT_BRANCH
ARG COMMIT_SHA
ARG BUILD_NUMBER

# Environment variables for optimized build
ENV NODE_ENV=production
ENV BUILD_OPTIMIZED=true

# Set build metadata
ENV APP_VERSION=${APP_VERSION:-unknown}
ENV BUILD_DATE=${BUILD_DATE:-unknown}
ENV COMMIT_BRANCH=${COMMIT_BRANCH:-unknown}
ENV COMMIT_SHA=${COMMIT_SHA:-unknown}
ENV BUILD_NUMBER=${BUILD_NUMBER:-0}

# Generate Prisma client with optimized flags
RUN cd services/labeling-backend && \
    pnpm db:generate && \
    pnpm run build

# ===========================================
# Production runner stage - Security Hardened
# ===========================================
FROM base AS runner
# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV LOG_LEVEL=warn
ENV ENABLE_METRICS=true
ENV WORKER_CONCURRENCY=10

# Install runtime-only dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata \
    dumb-init \
    postgresql-client \
    redis-tools \
    && rm -rf /var/cache/apk/*

# Copy built application with correct permissions
COPY --from=builder --chown=nodejs:nodejs /app/services/labeling-backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/services/labeling-backend/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/services/labeling-backend/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nodejs:nodejs /app/services/labeling-backend/prisma ./prisma

# Copy configuration files
COPY --chown=nodejs:nodejs infrastructure/docker/entrypoint-backend.sh /usr/local/bin/entrypoint.sh

# Create required directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/cache && \
    chown -R nodejs:nodejs /app/logs /app/uploads /app/cache && \
    chmod +x /usr/local/bin/entrypoint.sh

# Switch to non-root user for security
USER nodejs

# Expose port
EXPOSE 3001

# Health check with detailed monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f -s --max-time 5 \
        -H "User-Agent: LabelMint-HealthCheck/1.0" \
        http://localhost:3001/api/health || exit 1

# Use custom entrypoint for additional setup
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Start the application with optimized Node.js flags
CMD ["node", "--max-old-space-size=4096", "--enable-source-maps", "dist/index.js"]

# ===========================================
# Security scanning and metadata
# ===========================================
LABEL security.scan.enabled="true"
LABEL security.scan.type="vulnerability,configuration,runtime"
LABEL security.scan.frequency="daily"
LABEL org.label-schema.vendor="LabelMint"
LABEL org.label-schema.name="LabelMint Backend Services"
LABEL org.label-schema.version=${APP_VERSION:-unknown}
LABEL org.label-schema.build-date=${BUILD_DATE:-unknown}
LABEL org.label-schema.vcs-ref=${COMMIT_SHA:-unknown}
LABEL org.label-schema.vcs-branch=${COMMIT_BRANCH:-unknown}