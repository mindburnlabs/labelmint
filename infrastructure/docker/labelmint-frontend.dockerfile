# Build stage
FROM node:20-alpine AS builder

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
ARG VITE_API_URL
ARG VITE_COMMIT_SHA

# Labels
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="LabelMint Frontend" \
      org.label-schema.description="LabelMint Frontend Web Application" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.version=$VERSION

# Install build dependencies
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@8 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN VITE_API_URL=${VITE_API_URL} \
    VITE_COMMIT_SHA=${VITE_COMMIT_SHA} \
    pnpm build

# Production stage with nginx
FROM nginx:alpine AS production

# Security labels
LABEL maintainer="LabelMint Team <ops@labelmint.com>" \
      description="LabelMint Frontend Production Image"

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/* \
    && addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Copy custom nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create necessary directories
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s \
    --timeout=3s \
    --start-period=5s \
    --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]