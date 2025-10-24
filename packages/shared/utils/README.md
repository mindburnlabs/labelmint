# @labelmint/utils

A comprehensive utility library for LabelMint applications, providing common functions for formatting, DOM manipulation, device detection, and more.

## Installation

```bash
npm install @labelmint/utils
```

## Features

- 🎨 **Formatting utilities** - Currency, dates, numbers, bytes
- ⏱️ **Async utilities** - Debounce, throttle functions
- 🌐 **DOM utilities** - Viewport detection, scrolling, clipboard
- 📱 **Device detection** - Mobile, tablet, browser detection
- 📝 **String utilities** - Text truncation, ID generation
- 🧮 **Math utilities** - Percentage calculations
- 🎯 **UI utilities** - className merging with Tailwind

## Quick Start

```typescript
import {
  formatCurrency,
  formatDate,
  debounce,
  cn,
  isMobile,
  isInViewport
} from '@labelmint/utils';

// Format currency
const price = formatCurrency(1234.56, 'USD', 'en-US'); // "$1,234.56"

// Format dates
const date = formatDate(new Date(), { month: 'long', day: 'numeric' });

// Debounce a function
const debouncedSearch = debounce((query: string) => {
  console.log('Searching:', query);
}, 300);

// Merge class names
const buttonClass = cn('px-4 py-2', isActive && 'bg-blue-500', isDisabled && 'opacity-50');

// Device detection
if (isMobile()) {
  console.log('Mobile device detected');
}

// Check if element is in viewport
if (isInViewport(element)) {
  console.log('Element is visible');
}
```

## API Reference

### Formatting Utilities

#### Currency

```typescript
import { formatCurrency, formatCurrencyCompact } from '@labelmint/utils';

formatCurrency(1234.56, 'USD', 'en-US'); // "$1,234.56"
formatCurrencyCompact(1234567, 'EUR', 'de-DE'); // "1,2M €"
```

#### Dates

```typescript
import {
  formatDate,
  formatDateTime,
  formatRelativeTime
} from '@labelmint/utils';

formatDate(new Date()); // "Jan 24, 2025"
formatDateTime(new Date()); // "Jan 24, 2025, 2:30 PM"
formatRelativeTime(new Date(Date.now() - 3600000)); // "1 hour ago"
```

#### Numbers

```typescript
import {
  formatNumber,
  formatPercentage,
  formatNumberWithSuffix
} from '@labelmint/utils';

formatNumber(1234567); // "1,234,567"
formatPercentage(0.254, 1); // "25.4%"
formatNumberWithSuffix(2500000); // "2.5M"
```

### Async Utilities

```typescript
import { debounce, throttle } from '@labelmint/utils';

// Debounce - waits for pause before executing
const debouncedSearch = debounce((query: string) => {
  // Search logic
}, 300);

// Throttle - limits execution frequency
const throttledScroll = throttle((event: Event) => {
  // Scroll handling
}, 100);
```

### DOM Utilities

```typescript
import {
  isInViewport,
  scrollIntoView,
  copyToClipboard,
  downloadFile
} from '@labelmint/utils';

// Viewport detection
if (isInViewport(element)) {
  // Element is visible
}

// Smooth scrolling
scrollIntoView(element, { behavior: 'smooth', block: 'center' });

// Copy to clipboard
await copyToClipboard('Text to copy');

// Download file
downloadFile('https://example.com/file.pdf', 'document.pdf');
```

### Device Detection

```typescript
import {
  isMobile,
  isTablet,
  isIOS,
  isAndroid,
  getDeviceType
} from '@labelmint/utils';

if (isMobile()) {
  console.log('Mobile device');
}

if (isIOS()) {
  console.log('iOS device');
}

const deviceType = getDeviceType(); // 'mobile' | 'tablet' | 'desktop'
```

### String Utilities

```typescript
import {
  generateId,
  generateUUID,
  truncateText,
  truncateTextWords
} from '@labelmint/utils';

// Generate IDs
const id = generateId('user'); // "user-1706092800000-abc123def"
const uuid = generateUUID(); // "550e8400-e29b-41d4-a716-446655440000"

// Truncate text
const short = truncateText('Very long text', 10); // "Very lo..."
const wordTruncated = truncateTextWords('Very long text', 10); // "Very long..."
```

### Math Utilities

```typescript
import {
  calculatePercentage,
  calculatePercentageChange,
  calculateProgress
} from '@labelmint/utils';

const percentage = calculatePercentage(25, 100); // 25
const change = calculatePercentageChange(100, 150); // 50
const progress = calculateProgress(50, 0, 100); // 50
```

### UI Utilities

```typescript
import { cn } from '@labelmint/utils';

// Merge class names with Tailwind
const className = cn(
  'base-class',
  isActive && 'active-class',
  { 'conditional-class': condition },
  'additional-class'
);
```

## Browser Support

All utilities are designed to work in modern browsers. Some features have fallbacks for older browsers:

- **Clipboard API**: Falls back to `execCommand` in older browsers
- **Internationalization**: Uses `Intl` API with language fallbacks
- **DOM APIs**: Includes feature detection where appropriate

## TypeScript Support

The library is fully typed with comprehensive TypeScript definitions:

```typescript
import { formatCurrency, ApiResponse } from '@labelmint/utils';

// Types are automatically inferred
const price: string = formatCurrency(1234.56);

// Generic functions preserve types
const debouncedFn = debounce<(value: string) => void>((value) => {
  console.log(value);
}, 300);
```

## Tree Shaking

The library supports tree shaking, so only the functions you use will be included in your bundle:

```typescript
// Only imports the specific functions used
import { formatCurrency, cn } from '@labelmint/utils';

// Or import specific modules
import { formatCurrency } from '@labelmint/utils/format';
import { cn } from '@labelmint/utils/ui';
```

## Performance Considerations

- **Debounce/Throttle**: Uses efficient timer management
- **DOM Utilities**: Minimal DOM queries with caching where appropriate
- **String Utilities**: Optimized for performance with large strings
- **Device Detection**: Caches detection results where possible

## Examples

### Formatted Dashboard Component

```typescript
import React from 'react';
import {
  formatCurrency,
  formatPercentage,
  formatRelativeTime,
  cn
} from '@labelmint/utils';

interface DashboardProps {
  revenue: number;
  growth: number;
  lastUpdate: Date;
  isDarkMode: boolean;
}

export function Dashboard({ revenue, growth, lastUpdate, isDarkMode }: DashboardProps) {
  return (
    <div className={cn(
      'p-6 rounded-lg border',
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <h2 className="text-xl font-bold mb-4">
        Revenue: {formatCurrency(revenue)}
      </h2>
      <div className={cn(
        'text-sm font-medium',
        growth > 0 ? 'text-green-600' : 'text-red-600'
      )}>
        {formatPercentage(growth / 100)} from last month
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Last updated: {formatRelativeTime(lastUpdate)}
      </div>
    </div>
  );
}
```

### Search Component with Debounce

```typescript
import React, { useState, useEffect } from 'react';
import { debounce } from '@labelmint/utils';

export function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  // Debounced search function
  const debouncedSearch = debounce(async (searchQuery: string) => {
    if (searchQuery.trim()) {
      const response = await fetch(`/api/search?q=${searchQuery}`);
      const data = await response.json();
      setResults(data.results);
    } else {
      setResults([]);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="w-full px-4 py-2 border rounded"
      />
      {/* Render results */}
    </div>
  );
}
```

## License

MIT © LabelMint Team