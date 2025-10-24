FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

WORKDIR /app

# Copy built application and node_modules
COPY --from=base --chown=botuser:nodejs /app/dist ./dist
COPY --from=base --chown=botuser:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=botuser:nodejs /app/package.json ./package.json
COPY --from=base --chown=botuser:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Switch to non-root user
USER botuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]