// Components
export { Button, buttonVariants } from './components/Button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/Card';
export { Input } from './components/Input';
export { ErrorBoundary, useErrorHandler, withErrorBoundary } from './components/ErrorBoundary';

// Task Components
export { TaskView } from './components/task/TaskView';
export { TaskTimer } from './components/task/TaskTimer';
export { TaskContent } from './components/task/TaskContent';
export { TaskActions } from './components/task/TaskActions';
export { EarningAnimation } from './components/task/EarningAnimation';

// Earnings Components
export { EarningsDashboard } from './components/earnings/EarningsDashboard';

// Hooks
export { useTaskManager } from './hooks/useTaskManager';

// Types
export type {
  ComponentProps,
  AccessibilityProps,
  LoadingState,
  ErrorState,
  SizeVariant,
  ColorVariant,
  EventHandlers,
  ThemeProps,
  AnimationProps,
  FormFieldProps,
  ModalProps,
  NotificationItem,
  SkeletonProps,
  BreadcrumbItem,
  MenuItem,
  UploadFile,
  UploadProps,
  ProgressProps,
  TreeNode,
  DateRange,
  DateValue,
  ValidationRule,
  FormValidation,
  GridProps,
  RowProps,
} from './types/common';

export type { Task, TaskSubmission, UseTaskManagerOptions, UseTaskManagerReturn } from './hooks/useTaskManager';
export type { EarningsData, EarningsDashboardProps } from './components/earnings/EarningsDashboard';

// Design System
export * from './lib/design-tokens';

// Utilities
export { cn } from './lib/utils';

// Accessibility
export * from './lib/accessibility';

// Re-export commonly used third-party components
export * from '@radix-ui/react-dialog';
export * from '@radix-ui/react-dropdown-menu';
export * from '@radix-ui/react-toast';
export * from '@radix-ui/react-tooltip';
export * from '@radix-ui/react-select';
export * from '@radix-ui/react-checkbox';
export * from '@radix-ui/react-switch';
export * from '@radix-ui/react-tabs';
export * from '@radix-ui/react-progress';
export * from '@radix-ui/react-slider';
export * from '@radix-ui/react-avatar';
export * from '@radix-ui/react-label';