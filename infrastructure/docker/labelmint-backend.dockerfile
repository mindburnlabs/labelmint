# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Build arguments for version control
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels for metadata
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="LabelMint Backend" \
      org.label-schema.description="LabelMint Backend API Service" \
      org.label-schema.url="https://labelmint.com" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/labelmint/labelmint" \
      org.label-schema.vendor="LabelMint" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# Install build dependencies with minimal size
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    && apk add --no-cache -t .build-deps \
    git

# Set working directory
WORKDIR /app

# Copy package files with proper cache busting
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install pnpm globally and install dependencies
RUN npm install -g pnpm@8 && \
    pnpm install --frozen-lockfile --prod=false && \
    pnpm store prune

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application with optimizations
RUN NODE_OPTIONS="--max-old-space-size=4096" \
    pnpm build && \
    pnpm prune --prod

# Security scanning
RUN npm audit --audit-level high

# Production stage with minimal attack surface
FROM node:20-alpine AS production

# Security labels
LABEL maintainer="LabelMint Team <ops@labelmint.com>" \
      description="LabelMint Backend Production Image"

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    dumb-init \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S labelmint && \
    adduser -S labelmint -u 1001 -G labelmint

# Set working directory
WORKDIR /app

# Copy necessary files from builder with proper ownership
COPY --from=builder --chown=labelmint:labelmint /app/node_modules ./node_modules
COPY --from=builder --chown=labelmint:labelmint /app/dist ./dist
COPY --from=builder --chown=labelmint:labelmint /app/prisma ./prisma
COPY --from=builder --chown=labelmint:labelmint /app/package.json ./

# Create necessary directories with correct permissions
RUN mkdir -p \
    uploads \
    logs \
    tmp \
    .prisma \
    && chown -R labelmint:labelmint \
    uploads \
    logs \
    tmp \
    .prisma

# Switch to non-root user
USER labelmint

# Set environment variables for production
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC

# Expose port
EXPOSE 3000

# Add health check with proper timeout and retries
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the application with optimized Node.js settings
CMD ["node", "--max-old-space-size=1024", "dist/index.js"]