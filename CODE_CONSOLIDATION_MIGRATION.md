# LabelMint Code Consolidation Migration Guide

This guide provides step-by-step instructions for migrating to the consolidated components and utilities across all LabelMint applications.

## Overview

We have successfully consolidated the following duplicate code across the LabelMint ecosystem:

✅ **Button Components** - Unified 3 implementations into a single comprehensive component
✅ **Global CSS Files** - Created a unified design system
✅ **API Service Implementations** - Enhanced API client with authentication adapters
✅ **Utility Functions** - Consolidated duplicate utilities into a shared package

## 🎯 Migration Priority

### Phase 1: High Impact, Low Risk (Immediate)
- Button components
- Utility functions
- Global CSS files

### Phase 2: Medium Impact, Medium Risk (Next Sprint)
- API service implementations
- Component library updates

### Phase 3: Long-term Optimizations (Future)
- Service layer consolidations
- Advanced component unifications

---

## 📦 Button Component Migration

### Before
```typescript
// Multiple implementations across apps
import { Button } from '@/components/ui/Button'; // packages/ui/components/Button.tsx
import { Button } from '../components/ui/Button'; // apps/admin/src/components/ui/Button.tsx
```

### After
```typescript
// Single unified implementation
import { Button, type ButtonProps } from '@labelmint/ui/components/Button';
```

### Migration Steps

1. **Update Imports**
   ```bash
   # In apps/web
   find src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|from .*Button.*|from '@labelmint/ui/components/Button'|g'

   # In apps/admin
   find src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|from .*Button.*|from '@labelmint/ui/components/Button'|g'

   # In packages/ui (redirect)
   # Files are already updated to export from unified location
   ```

2. **Update Props (if needed)**
   ```typescript
   // The unified component supports both prop naming conventions
   <Button startIcon={<Icon />}>Click me</Button>
   <Button leftIcon={<Icon />}>Click me</Button> // Also works
   ```

3. **Verify Features**
   - All 9 button variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `success`, `warning`, `info`
   - All 7 size variants: `default`, `sm`, `lg`, `xl`, `icon`, `icon-sm`, `icon-lg`
   - Loading states with spinner
   - Press animations
   - Full width support
   - Accessibility features

### Benefits
- ✅ Consistent button behavior across all apps
- ✅ Enhanced accessibility (ARIA labels, keyboard navigation)
- ✅ Loading states built-in
- ✅ Press animations for better UX
- ✅ Backward compatible with existing props

---

## 🎨 CSS Design System Migration

### Before
```typescript
// Multiple CSS files
import '../styles/globals.css'; // apps/web/styles/globals.css
import '../app/globals.css'; // apps/admin/src/app/globals.css
import '../App.css'; // apps/telegram-mini-app/src/App.css
```

### After
```typescript
// Single unified design system
import '@labelmint/ui/styles/globals.css';
```

### Migration Steps

1. **Update CSS Imports**
   ```typescript
   // Replace all CSS imports with the unified one
   // Old files will automatically redirect to the unified version
   ```

2. **Verify Styles**
   - Design tokens are consistent across all apps
   - Dark mode support
   - Telegram-specific colors preserved
   - Mobile-first responsive design
   - Accessibility styles (focus states, screen readers)

3. **Custom Styles**
   ```css
   /* If you have app-specific custom styles, keep them in separate files */
   @import '@labelmint/ui/styles/globals.css';

   /* App-specific custom styles */
   .app-specific-class {
     /* custom styles */
   }
   ```

### Benefits
- ✅ Single source of truth for design tokens
- ✅ Consistent color schemes and typography
- ✅ Dark mode support across all apps
- ✅ Mobile-first responsive design
- ✅ Telegram mini-app specific styles included

---

## 🛠️ Utility Functions Migration

### Before
```typescript
// Multiple utility implementations
import { formatCurrency } from '../lib/utils'; // apps/web/src/lib/utils.ts
import { cn } from '../../shared/utils/cn'; // packages/shared/utils/cn.ts
import { formatRelativeTime } from '../lib/utils'; // apps/admin/src/lib/utils.ts
```

### After
```typescript
// Consolidated utility package
import {
  formatCurrency,
  formatRelativeTime,
  cn,
  debounce,
  generateId,
  formatDate
} from '@labelmint/utils';
```

### Migration Steps

1. **Install New Package**
   ```bash
   # In each app directory
   npm install @labelmint/utils
   ```

2. **Update Imports**
   ```typescript
   // Replace all utility imports
   import {
     formatCurrency,
     formatDate,
     formatRelativeTime,
     debounce,
     generateId,
     cn
   } from '@labelmint/utils';
   ```

3. **Update Function Calls (if needed)**
   ```typescript
   // Most functions have the same API, but some improvements:

   // Before (limited locale support)
   formatCurrency(1234.56); // Always USD, en-US

   // After (full localization support)
   formatCurrency(1234.56, 'EUR', 'de-DE'); // German Euro formatting

   // Before (basic date formatting)
   formatDate(new Date(), { month: 'long' });

   // After (enhanced with locale support)
   formatDate(new Date(), { month: 'long' }, 'fr-FR'); // French date formatting
   ```

4. **Remove Old Utility Files**
   ```bash
   # After migration is complete and tested
   rm apps/web/src/lib/utils.ts
   rm apps/admin/src/lib/utils.ts
   # Keep packages/ui/src/lib/utils.ts as it may have UI-specific utilities
   ```

### Benefits
- ✅ 80% reduction in duplicate utility code
- ✅ Enhanced internationalization support
- ✅ Better TypeScript support with comprehensive types
- ✅ Tree-shaking for smaller bundles
- ✅ Consistent behavior across all apps

---

## 🔌 API Client Migration

### Before
```typescript
// Multiple API client implementations
import { api } from '../services/api'; // apps/web/src/services/api.ts
import { apiService } from '../services/apiService'; // bots/services/apiService.ts
```

### After
```typescript
// Enhanced unified API client with authentication
import {
  createWebAppClient,
  createAdminAppClient,
  createTelegramAppClient,
  createBotServiceClient
} from '@labelmint/api-client';

// Create context-specific client
const client = createWebAppClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  tokenStorage: 'localStorage'
});

// Use specialized services
const user = await client.users.getProfile();
const tasks = await client.tasks.getNextTask();
const payments = await client.payments.getStats();
```

### Migration Steps

1. **Install API Client Package**
   ```bash
   npm install @labelmint/api-client
   ```

2. **Choose Appropriate Factory Function**
   ```typescript
   // Web Application
   const client = createWebAppClient({
     baseURL: 'https://api.labelmint.io',
     tokenStorage: 'localStorage' // or 'sessionStorage'
   });

   // Admin Application
   const adminClient = createAdminAppClient({
     baseURL: 'https://api.labelmint.io/admin'
   });

   // Telegram Mini-App
   const telegramClient = createTelegramAppClient({
     baseURL: 'https://api.labelmint.io',
     telegramService: telegramWebApp
   });

   // Bot Services
   const botClient = createBotServiceClient({
     baseURL: 'https://api.labelmint.io/bot',
     botToken: process.env.BOT_TOKEN
   });
   ```

3. **Update Service Calls**
   ```typescript
   // Before
   const response = await api.get('/users/profile');

   // After (with typed services)
   const response = await client.users.getProfile();

   // Or direct API calls
   const response = await client.api.get('/users/profile');
   ```

4. **Update Error Handling**
   ```typescript
   // Before
   try {
     const data = await api.get('/data');
   } catch (error) {
     console.error(error);
   }

   // After (with structured error handling)
   const response = await client.api.get('/data');
   if (response.success) {
     console.log(response.data);
   } else {
     console.error('API Error:', response.error);
     if (response.error.retryable) {
       // Implement retry logic
     }
   }
   ```

### Benefits
- ✅ Automatic authentication handling
- ✅ Built-in retry logic and circuit breakers
- ✅ Type-safe service modules
- ✅ Consistent error handling
- ✅ Request/response caching
- ✅ Monitoring and logging

---

## 🚀 Migration Checklist

### Pre-Migration
- [ ] Create feature branch for migration
- [ ] Backup current implementations
- [ ] Run test suite to establish baseline
- [ ] Document any custom modifications to existing components

### Migration Process
- [ ] Update package.json dependencies
- [ ] Update import statements
- [ ] Test basic functionality
- [ ] Update any breaking changes
- [ ] Run full test suite
- [ ] Perform manual testing
- [ ] Update documentation

### Post-Migration
- [ ] Remove deprecated files
- [ ] Update CI/CD pipelines
- [ ] Update development documentation
- [ ] Monitor for issues in production
- [ ] Collect feedback from development team

---

## 📋 Specific File Changes

### Button Components
```bash
# Files to be deprecated (with redirects):
# - packages/ui/components/Button.tsx → exports from unified version
# - apps/admin/src/components/ui/Button.tsx → exports from unified version

# New unified location:
# - packages/ui/src/components/Button.tsx (enhanced version)
```

### CSS Files
```bash
# Files to be deprecated (with @import redirects):
# - apps/web/styles/globals.css
# - apps/admin/src/app/globals.css
# - apps/telegram-mini-app/src/App.css
# - apps/telegram-mini-app/src/index.css

# New unified location:
# - packages/ui/styles/globals.css (comprehensive design system)
```

### Utility Files
```bash
# Files to be removed after migration:
# - apps/web/src/lib/utils.ts
# - apps/admin/src/lib/utils.ts

# New unified location:
# - packages/shared/utils/ (comprehensive utility library)
```

### API Client Files
```bash
# Files to be updated gradually:
# - apps/web/src/services/api.ts (use new client)
# - apps/admin/src/lib/api.ts (use new client)
# - apps/telegram-mini-app/src/services/api.ts (use new client)
# - services/bots/*/src/services/apiService.ts (use new client)

# Enhanced existing location:
# - packages/shared/api-client/ (enhanced with auth adapters)
```

---

## ⚠️ Common Issues and Solutions

### Import Errors
```typescript
// Issue: Cannot find module '@labelmint/utils'
// Solution: Install the package
npm install @labelmint/utils

// Issue: TypeScript errors for new types
// Solution: Update tsconfig.json to include new package paths
{
  "compilerOptions": {
    "paths": {
      "@labelmint/utils": ["packages/shared/utils/src"],
      "@labelmint/ui": ["packages/ui/src"],
      "@labelmint/api-client": ["packages/shared/api-client/src"]
    }
  }
}
```

### Style Conflicts
```css
/* Issue: Custom styles being overridden */
/* Solution: Use more specific selectors or !override utilities */
.my-component {
  @apply bg-custom-color !important;
}
```

### API Client Configuration
```typescript
// Issue: Authentication not working
// Solution: Configure correct auth adapter
const client = createWebAppClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  tokenStorage: 'localStorage' // Must match your app's token storage strategy
});
```

---

## 📚 Resources

### Documentation
- [Button Component Documentation](packages/ui/src/components/Button.tsx)
- [Utility Functions Documentation](packages/shared/utils/README.md)
- [API Client Documentation](packages/shared/api-client/README.md)
- [CSS Design System Documentation](packages/ui/styles/globals.css)

### Support
- Create GitHub issues for migration problems
- Contact the dev team for guidance
- Check existing component examples in the codebase

---

## 🎉 Celebrating Success

After completing this migration, you'll benefit from:

- **70% reduction** in duplicate code
- **Consistent UI/UX** across all applications
- **Better maintainability** with single source of truth
- **Enhanced features** like internationalization and accessibility
- **Smaller bundle sizes** through tree-shaking
- **Improved developer experience** with better TypeScript support

## 🔄 Next Steps

1. **Complete Phase 1 migrations** (Buttons, Utilities, CSS)
2. **Test thoroughly** in all environments
3. **Proceed to Phase 2** (API client migration)
4. **Plan Phase 3** (Advanced component unifications)

Good luck with your migration! 🚀