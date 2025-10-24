# LabelMint UI Components

A modern, accessible, and performant component library built for the LabelMint platform.

## Features

- 🎨 **Design System**: Comprehensive design tokens and theming
- ♿ **Accessible**: WCAG 2.1 AA compliant with full keyboard navigation
- ⚡ **Performant**: Optimized with React.memo, useMemo, and useCallback
- 📱 **Responsive**: Mobile-first design with responsive utilities
- 🔧 **Customizable**: Flexible theming and variant system
- 📚 **Storybook**: Interactive component documentation
- 🛡️ **TypeScript**: Full TypeScript support with strict typing
- 🎯 **Focused**: Minimal dependencies and bundle size

## Installation

```bash
npm install @labelmint/ui
```

## Setup

### Tailwind CSS Configuration

Add the UI package to your Tailwind config:

```js
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@labelmint/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        destructive: "hsl(var(--destructive))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### Global Styles

Import the global styles in your app:

```tsx
// src/app/globals.css or similar
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}
```

## Usage

### Basic Components

```tsx
import { Button, Card, Input } from '@labelmint/ui';

function App() {
  return (
    <Card className="p-6">
      <h2>Welcome to LabelMint</h2>
      <Input placeholder="Enter your email" className="mt-4" />
      <Button className="mt-4">Get Started</Button>
    </Card>
  );
}
```

### Task Components

```tsx
import { TaskView, useTaskManager } from '@labelmint/ui';

function TaskPage() {
  return (
    <TaskView
      onTaskComplete={() => console.log('Task completed')}
      autoFetch={true}
    />
  );
}
```

### Earnings Dashboard

```tsx
import { EarningsDashboard } from '@labelmint/ui';

function Dashboard() {
  const earnings = {
    balance: 125.50,
    totalEarned: 450.75,
    todayEarned: 23.00,
    weeklyEarnings: 142.50,
    tasksCompleted: 1248,
    accuracy: 94.5,
  };

  return (
    <EarningsDashboard
      earnings={earnings}
      showDetails={true}
      variant="default"
    />
  );
}
```

### Workflow Components

```tsx
import { WorkflowCanvas } from '@labelmint/ui';

function WorkflowEditor() {
  return (
    <WorkflowCanvas
      workflow={workflowData}
      onWorkflowChange={(w) => setWorkflow(w)}
      onSave={saveWorkflow}
      onExecute={executeWorkflow}
      showMiniMap={true}
    />
  );
}
```

## Error Boundaries

Wrap your app with error boundaries:

```tsx
import { ErrorBoundary } from '@labelmint/ui';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to your error tracking service
        console.error('Error caught:', error, errorInfo);
      }}
      showRetry={true}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

## Accessibility

All components come with built-in accessibility features:

- Full keyboard navigation
- ARIA labels and roles
- Focus management
- Screen reader support
- High contrast support

```tsx
import { Button } from '@labelmint/ui';

// Accessible button with custom ARIA
<Button
  aria-label="Close dialog"
  aria-describedby="close-description"
  onClick={handleClose}
>
  Close
</Button>
```

## Performance Optimization

The library includes several performance optimization hooks:

```tsx
import { useLazyLoad, usePerformanceMonitor } from '@labelmint/ui';

// Lazy load components
const LazyComponent = createLazyComponent(
  () => import('./HeavyComponent'),
  'HeavyComponent'
);

// Monitor performance
function MyComponent() {
  const { metrics, trackInteraction } = usePerformanceMonitor('MyComponent');

  return (
    <div onClick={trackInteraction}>
      Render time: {metrics.renderTime}ms
    </div>
  );
}
```

## Design Tokens

Access design tokens for consistent styling:

```tsx
import { colors, typography, spacing } from '@labelmint/ui';

const myStyles = {
  backgroundColor: colors.primary[500],
  fontSize: typography.fontSize.lg,
  padding: spacing[4],
};
```

## Storybook

View interactive component examples and documentation:

```bash
npm run storybook
```

## Testing

Components are tested for accessibility:

```bash
npm run test:a11y
```

## Available Components

### Core
- `Button` - Versatile button with variants and sizes
- `Card` - Flexible container with sections
- `Input` - Accessible form input with validation
- `ErrorBoundary` - Error handling component

### Task
- `TaskView` - Main task viewing component
- `TaskTimer` - Timer display for tasks
- `TaskContent` - Content wrapper for tasks
- `TaskActions` - Action buttons for tasks
- `EarningAnimation` - Success animation

### Earnings
- `EarningsDashboard` - Balance and earnings display

### Workflow
- `WorkflowCanvas` - Visual workflow editor
- `WorkflowControls` - Save/execute controls
- `WorkflowInfo` - Information panel
- `WorkflowMiniMap` - Overview minimap
- `NodeWrapper` - Reusable node container

## Customization

### Theming

Create custom themes by overriding CSS variables:

```css
.my-theme {
  --primary: 210 100% 50%;
  --secondary: 210 100% 96%;
  --radius: 0.75rem;
}
```

### Component Variants

Extend components with custom variants:

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(['base-styles'], {
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground',
      custom: 'bg-gradient text-white',
    },
  },
});
```

## Migration Guide

### From version 0.x to 1.0

1. Update imports: Many components have been reorganized
2. Check prop changes: Some props have been renamed for clarity
3. Review accessibility implementations: ARIA attributes may have changed

## Contributing

1. Follow the existing code style
2. Ensure TypeScript types are strict
3. Add tests for new components
4. Update Storybook stories
5. Check accessibility with axe-core

## License

MIT © LabelMint