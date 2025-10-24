# Dependency Management Policy

## Overview

This document outlines the dependency management strategy and standards for the LabelMint repository to ensure consistency, security, and maintainability across all packages.

## Package Manager

- **Primary Package Manager**: pnpm 9.15.1+
- **Workspace Configuration**: pnpm-workspace.yaml
- **Lock File**: Single pnpm-lock.yaml at root level
- **Prohibited**: package-lock.json files (should be removed from all packages)

## Version Standards

### Core Framework Versions
- **React**: 19.0.0+ (across all packages)
- **Next.js**: 15.0.0+ (for web applications)
- **TypeScript**: 5.7.2 (across all packages)
- **Node.js**: 20.0.0+ (engines requirement)

### Development Tools
- **ESLint**: 9.15.0+ (across all packages)
- **Vitest**: 4.0.3+ (for testing)
- **Hardhat**: 3.0.9+ (for smart contracts)
- **@faker-js/faker**: 10.1.0+
- **@testing-library/react**: 16.3.0+

## Security Guidelines

### Vulnerability Management
- Run `npm audit` regularly to check for vulnerabilities
- Update vulnerable dependencies immediately
- Focus on critical and high severity vulnerabilities
- Keep axios, nodemailer, ws, and jsonwebtoken updated

### Security-First Dependencies
- Use well-maintained libraries with active communities
- Review security advisories for all dependencies
- Implement dependency scanning in CI/CD pipeline

## Dependency Categorization

### Production Dependencies
- Runtime dependencies required for the application to function
- Must be listed in `dependencies` section

### Development Dependencies
- Build tools, testing frameworks, type definitions
- Must be listed in `devDependencies` section
- Includes all `@types/*` packages

### Peer Dependencies
- Dependencies expected to be provided by the consumer
- Use for shared libraries like React

## Workspace Management

### Package Structure
```
labelmint/
├── apps/           # Application packages
├── services/       # Backend service packages
├── packages/       # Shared library packages
└── config/         # Configuration packages
```

### Workspace Protocol
- Use `workspace:*` for internal dependencies
- Example: `"@labelmint/ui": "workspace:*"`

## Update Strategy

### Regular Updates
- Review and update dependencies monthly
- Prioritize security updates
- Test compatibility before applying updates

### Major Version Updates
- Requires thorough testing
- Update breaking changes documentation
- Consider impact on all dependent packages

### Automation
- Set up Dependabot for automated PRs
- Implement CI checks for dependency updates
- Use pnpm's audit and outdated commands

## Best Practices

### Adding New Dependencies
1. Check if similar dependency already exists
2. Verify compatibility with existing versions
3. Add to appropriate category (dependencies/devDependencies)
4. Update all affected packages if needed
5. Document the reason for adding the dependency

### Removing Dependencies
1. Verify the dependency is not used in any package
2. Remove from all package.json files
3. Run `pnpm install` to update lock file
4. Test that all functionality still works

### Duplicate Dependencies
- Avoid having multiple versions of the same library
- Use workspace protocol for internal packages
- Consolidate similar utility libraries

## Monitoring and Maintenance

### Regular Tasks
- [ ] Monthly dependency review
- [ ] Security audit with `npm audit`
- [ ] Check for outdated packages with `pnpm outdated`
- [ ] Update documentation when versions change

### CI/CD Integration
- Automated security scanning
- Dependency update PRs
- Version compatibility checks
- Build and test validation

## Package-Specific Requirements

### Web Applications (apps/*)
- React 19.0.0+
- Next.js 15.0.0+
- TypeScript 5.7.2
- ESLint 9.15.0+

### Services (services/*)
- Node.js 20.0.0+ compatible
- Security-vetted dependencies only
- Regular security updates for authentication libraries

### Shared Packages (packages/*)
- Peer dependencies for React
- Minimal production dependencies
- Comprehensive type definitions

## Emergency Procedures

### Critical Security Vulnerability
1. Immediately assess impact
2. Create emergency patch PR
3. Update all affected packages
4. Deploy with priority
5. Document incident and resolution

### Dependency Breakage
1. Identify affected packages
2. Roll back to working version if needed
3. Test alternative dependencies
4. Update all implementations
5. Communicate changes to team

## Contact and Ownership

- **Dependency Manager**: Development Team
- **Security Review**: Security Lead
- **Documentation Updates**: Technical Writer
- **CI/CD Integration**: DevOps Engineer

Last updated: $(date +%Y-%m-%d)
Version: 1.0.0