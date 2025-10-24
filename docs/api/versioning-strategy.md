# API Versioning Strategy

## Overview

The Telegram Labeling Platform API follows a structured versioning approach to ensure backward compatibility while enabling continuous innovation and improvement.

## Versioning Policy

### Semantic Versioning

We use semantic versioning (SemVer) for our API: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes that are not backward compatible
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and minor improvements that don't affect functionality

### Current Version

**Stable**: v1.2.0 (Latest stable release)
**Beta**: v2.0.0-beta (Preview of next major version)

## URL-Based Versioning

All API requests include the version in the URL path:

```
https://api.labelmint.it/v{major}/endpoint
```

**Examples:**
- `https://api.labelmint.it/v1/tasks` (Current stable version)
- `https://api.labelmint.it/v2/tasks` (Next major version - beta)

## Version Lifecycle

### Supported Versions

| Version | Status | Release Date | Support End | Breaking Changes |
|---------|--------|--------------|-------------|------------------|
| v1.0 | Deprecated | 2023-12-01 | 2024-06-01 | Yes |
| v1.1 | Maintained | 2024-01-01 | 2025-01-01 | No |
| v1.2 | Current | 2024-01-15 | 2025-07-15 | No |
| v2.0 | Beta | 2024-02-01 | Ongoing | Yes |

### Version Support Policy

1. **Current Version**: Full support, active development, and feature additions
2. **Maintained Versions**: Bug fixes and security updates only
3. **Deprecated Versions**: No new features, security fixes only for 6 months
4. **Retired Versions**: No support, endpoints may return 410 Gone

## Migration Path

### Upgrading Between Minor Versions

Minor versions are backward compatible. No changes required:

```bash
# v1.1 to v1.2 - No changes needed
curl -H "X-API-Key: your-key" https://api.labelmint.it/v1/tasks
```

### Upgrading Major Versions

Major versions require migration:

```javascript
// v1.x - Current approach
const response = await fetch('https://api.labelmint.it/v1/tasks', {
  headers: {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Signature': signature
  }
});

// v2.x - New approach (example)
const response = await fetch('https://api.labelmint.it/v2/tasks', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'X-Timestamp': timestamp,
    'X-Signature': signature
  }
});
```

## Breaking Changes Policy

A change is considered breaking if it includes:

1. **Removed Endpoints**: Deleting existing API endpoints
2. **Modified Request Schemas**: Changing required fields or data types
3. **Modified Response Schemas**: Removing fields or changing data types
4. **Authentication Changes**: Altering how authentication works
5. **Rate Limit Changes**: Reducing rate limits significantly
6. **Error Code Changes**: Modifying error response structure

### Breaking Change Notification Process

1. **90 Days Notice**: Announce upcoming breaking changes
2. **30 Days Warning**: Remind users of upcoming changes
3. **5 Days Grace**: Keep old version running briefly after new release
4. **Deprecation Headers**: Include deprecation warnings in API responses

```http
HTTP/1.1 200 OK
X-API-Version: 1.2
X-API-Deprecated: true
X-API-Sunset: 2024-06-01T00:00:00Z
X-API-Migration-Guide: https://docs.labelmint.it/migration/v1-to-v2
```

## Version-Specific Features

### v1.2 Features (Current)

- Triple authentication (API Key + Timestamp + Signature)
- Standard task creation and management
- Basic AI assistance
- Project management
- Webhook notifications
- Rate limiting

### v2.0 Beta Features (Upcoming)

- OAuth 2.0 authentication support
- GraphQL endpoint for complex queries
- Real-time WebSocket subscriptions
- Advanced AI model selection
- Batch processing improvements
- Enhanced analytics dashboard

## Version Headers

All API responses include version information:

```http
X-API-Version: 1.2.0
X-API-Stable: true
X-API-Latest: 1.2.0
X-API-Supported-Versions: 1.1,1.2
```

## Testing Multiple Versions

Use version headers to test new features:

```javascript
// Opt-in to beta features
const response = await fetch('https://api.labelmint.it/v1/tasks', {
  headers: {
    'X-API-Key': apiKey,
    'X-API-Version-Beta': '2.0'
  }
});
```

## Client Library Support

Official SDKs support multiple versions:

```javascript
// JavaScript SDK
import { DeligateAPI, APIv1, APIv2 } from 'labelmint-api-client';

const v1Client = new APIv1({ apiKey: 'key1' });
const v2Client = new APIv2({ apiKey: 'key2' });

// Use version-specific methods
const tasksV1 = await v1Client.tasks.list();
const tasksV2 = await v2Client.tasks.list({ include: ['analytics'] });
```

## Migration Guides

### v1 to v2 Migration Checklist

- [ ] Review breaking changes documentation
- [ ] Update authentication method if needed
- [ ] Test new endpoint structures
- [ ] Update error handling
- [ ] Verify webhook payload formats
- [ ] Update rate limit handling
- [ ] Test in staging environment
- [ ] Plan rollback strategy

## Best Practices

### For Developers

1. **Pin API Version**: Always specify the version in production code
2. **Monitor Deprecation**: Watch for deprecation headers
3. **Test Early**: Use beta endpoints to prepare for upgrades
4. **Handle Errors**: Gracefully handle version-specific error codes
5. **Stay Updated**: Subscribe to changelog notifications

### Version Pinning

```bash
# Good - Specific version
curl https://api.labelmint.it/v1/tasks

# Bad - No version (not supported)
curl https://api.labelmint.it/tasks
```

### Environment Configuration

```javascript
const config = {
  development: {
    apiVersion: '1.2',
    baseUrl: 'http://localhost:3001/api/v1'
  },
  staging: {
    apiVersion: '1.2',
    baseUrl: 'https://staging-api.labelmint.it/v1'
  },
  production: {
    apiVersion: '1.2',
    baseUrl: 'https://api.labelmint.it/v1'
  }
};
```

## Getting Help

- **Migration Guide**: [docs.labelmint.it/migration](https://docs.labelmint.it/migration)
- **Changelog**: [docs.labelmint.it/changelog](https://docs.labelmint.it/changelog)
- **Support**: api-support@labelmint.it
- **Community**: [GitHub Discussions](https://github.com/labelmint/api/discussions)

## Version Roadmap

### Q1 2024
- v1.3 release (minor features)
- v2.0 beta expansion

### Q2 2024
- v1.4 release (minor features)
- v2.0 release candidate

### Q3 2024
- v2.0 stable release
- v1.2 deprecation announcement

### Q4 2024
- v2.1 planning
- v1.0 retirement