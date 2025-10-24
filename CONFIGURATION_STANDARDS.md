# LabelMint Configuration Standards Guide

## Overview

This document outlines the standardized configuration patterns and conventions used across the LabelMint repository to ensure consistency, maintainability, and reliability across all packages, services, and applications.

## Table of Contents

1. [TypeScript Configuration Standards](#typescript-configuration-standards)
2. [ESLint Configuration Standards](#eslint-configuration-standards)
3. [Build Tool Configuration Standards](#build-tool-configuration-standards)
4. [Environment Configuration Standards](#environment-configuration-standards)
5. [Monitoring Configuration Standards](#monitoring-configuration-standards)
6. [Package.json Standards](#packagejson-standards)
7. [Validation and Maintenance](#validation-and-maintenance)

## TypeScript Configuration Standards

### Configuration Hierarchy

We use a hierarchical TypeScript configuration system with specialized base configurations:

```
config/shared/
├── tsconfig.base.json          # Base configuration for all packages
├── tsconfig.service.json       # Backend services configuration
├── tsconfig.app.json          # Frontend applications configuration
└── tsconfig.package.json      # Shared packages configuration
```

### Target Versions

- **All packages**: `ES2022` (minimum)
- **Services**: CommonJS modules with Node.js resolution
- **Applications**: ESNext modules with bundler resolution
- **Packages**: ESNext modules with bundler resolution

### Module Resolution Standards

| Package Type | Module Resolution | Reason |
|-------------|-------------------|---------|
| Backend Services | `node` | Node.js runtime compatibility |
| Frontend Apps | `bundler` | Modern bundler optimization |
| Shared Packages | `bundler` | Tree-shaking support |

### Strict Mode Configuration

All configurations **must** have:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true
  }
}
```

### Path Mapping Standards

- Use consistent `@labelmint/*` paths for internal packages
- Use `@/*` for local application paths
- Define all shared package paths in base configuration

## ESLint Configuration Standards

### Flat Format Requirement

All ESLint configurations **must** use the flat config format (`eslint.config.js`).

### Configuration Hierarchy

```
config/shared/
├── eslint.config.js           # Base configuration for all packages
└── eslint.service.config.js   # Service-specific extensions
```

### Required Plugins

- `@typescript-eslint` - TypeScript support
- `react` - React support
- `react-hooks` - React hooks rules
- `import` - Import/export rules

### Standard Rules

All configurations must include:
- Consistent code formatting rules
- TypeScript-specific rules
- React best practices
- Import organization rules

## Build Tool Configuration Standards

### Next.js Applications

#### Base Configuration

All Next.js apps must extend `../../config/shared/next.config.base.js`:

```javascript
const baseConfig = require('../../config/shared/next.config.base.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...baseConfig,
  // App-specific configuration
};
```

#### Security Requirements

All Next.js apps must include these security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Vite Applications

#### Base Configuration Standards

All Vite configurations should include:
- Target `ES2022`
- Terser minification
- Source maps enabled
- Path aliases configured
- Manual chunks for vendor libraries

## Environment Configuration Standards

### File Naming Conventions

- `.env.template` - General template
- `.env.development.template` - Development template
- `.env.production.template` - Production template
- `.env.webapp.template` - Web application template
- `.env.service.template` - Service template

### Required Variables

All environments must define:
- `NODE_ENV`
- `APP_VERSION`
- Service-specific ports and URLs

### Security Standards

#### Production Environment Requirements

- No localhost or 127.0.0.1 references
- All secrets must use production values
- CORS must be restricted to production domains
- Rate limiting must be enabled and restrictive

#### Variable Naming

- Use `UPPER_SNAKE_CASE` for all variables
- Group related variables with consistent prefixes
- Include descriptive comments for complex configurations

### Environment-Specific Templates

#### Development
- Relaxed rate limiting (1000 requests/15min)
- Localhost origins allowed
- Development API endpoints
- Debug logging enabled

#### Production
- Strict rate limiting (100 requests/15min)
- Production-only origins
- Production API endpoints
- Error logging only

## Monitoring Configuration Standards

### Prometheus Configuration

#### Base Configuration

All monitoring setups should extend the shared configurations:
- `config/shared/prometheus.base.yml` - Global settings
- `config/shared/prometheus.jobs.yml` - Service definitions

#### Service Discovery Standards

- Use consistent job naming: `labelmint-{service-name}`
- Standard scrape intervals: 15s for apps, 30s for infrastructure
- Consistent metrics paths: `/metrics` or `/api/metrics`
- Standard timeouts: 10s for applications

#### Alerting Standards

All services must include:
- Health check endpoints
- Metrics endpoints
- Proper alerting labels
- Service discovery configuration

## Package.json Standards

### Build Script Standards

| Package Type | Build Command | Test Command |
|-------------|---------------|--------------|
| Next.js Apps | `next build` | `npm test` |
| Vite Apps | `vite build` | `vitest run` |
| Services | `tsc` | `jest` |
| Packages | `tsup` | `vitest run` |

### Dependency Organization

- Type definitions in `devDependencies`
- Production dependencies in `dependencies`
- Peer dependencies for optional packages
- Consistent version ranges across packages

### Version Management

- Use exact versions for critical dependencies
- Use compatible ranges for most dependencies
- Regularly audit and update dependencies
- Pin major versions in production

## Validation and Maintenance

### Automated Validation

Use the provided validation scripts:

```bash
# Validate all configurations
node scripts/validate-configs.js

# Check dependency consistency
node scripts/check-dependencies.js
```

### Regular Maintenance Tasks

1. **Monthly**: Run dependency updates and audit
2. **Quarterly**: Review and update configuration standards
3. **As needed**: Update shared configurations when adding new services

### Configuration Updates

When updating configurations:

1. Update shared base configurations first
2. Test changes across all affected packages
3. Update documentation
4. Run validation scripts
5. Commit changes with clear descriptions

## Troubleshooting

### Common Issues

#### TypeScript Resolution Errors
- Check module resolution configuration
- Verify path mappings in tsconfig.json
- Ensure consistent package names

#### ESLint Flat Config Issues
- Verify all legacy configs are converted
- Check import paths for shared configs
- Ensure required plugins are installed

#### Build Tool Configuration
- Verify base config extensions
- Check for conflicting settings
- Ensure all required dependencies are installed

### Getting Help

1. Check this documentation first
2. Run validation scripts for specific error messages
3. Review existing configurations for examples
4. Contact the development team for complex issues

## Examples

### Adding a New Service

1. Create service-specific TypeScript config extending `tsconfig.service.json`
2. Create ESLint config extending `eslint.service.config.js`
3. Add service to `prometheus.jobs.yml`
4. Create environment template using `.env.service.template`
5. Update validation scripts if needed

### Updating Shared Configuration

1. Modify base configuration in `config/shared/`
2. Test across all dependent packages
3. Update version numbers if breaking changes
4. Update this documentation
5. Communicate changes to the team

---

This standards document should be updated whenever configuration patterns change. All team members should follow these standards to ensure consistency across the LabelMint ecosystem.