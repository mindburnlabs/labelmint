// Components
export { Button, buttonVariants } from './components/Button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/Card';
export { Input } from './components/Input';
export { TableRow, TableHead, TableCell } from './components/Table';

export { ErrorBoundary, useErrorHandler, withErrorBoundary } from './components/ErrorBoundary';
export { Tooltip } from './components/Tooltip';
export { Badge } from './components/Badge';
export { LoadingSpinner } from './components/LoadingSpinner';
export { Alert } from './components/Alert';
export { AnimatedContainer } from './components/AnimatedContainer';
export { LanguageSelector } from './components/LanguageSelector';
export { PerformanceMonitor } from './components/PerformanceMonitor';
export { Form } from './components/Form';
export { FormField } from './components/FormField';

// Task Components
export { TaskView } from './components/task/TaskView';
export { TaskTimer } from './components/task/TaskTimer';
export { TaskContent } from './components/task/TaskContent';
export { TaskActions } from './components/task/TaskActions';
export { EarningAnimation } from './components/task/EarningAnimation';

// Earnings Components
export { EarningsDashboard } from './components/earnings/EarningsDashboard';

// Wallet Components
export { WalletButton } from './components/wallet/WalletButton';
export { WalletModal } from './components/wallet/WalletModal';
export { TransactionHistory } from './components/wallet/TransactionHistory';
export { BalanceDisplay } from './components/wallet/BalanceDisplay';

// Payment Components
export { PaymentModal } from './components/payment/PaymentModal';
export { PaymentHistory } from './components/payment/PaymentHistory';
export { WithdrawalForm } from './components/payment/WithdrawalForm';

// Hooks
export { useTaskManager } from './hooks/useTaskManager';
export { useTonWallet } from './hooks/useTonWallet';
export { useSocket, useSocketEvent, useNotifications, useBalanceUpdates, useLeaderboard } from './hooks/useSocket';
export { useTranslation } from './hooks/useTranslation';
export { usePerformance } from './hooks/usePerformance';
export { useForm } from './lib/validation';

// Services
export { ApiService, initializeApiService, getApiService } from './services/apiService';
export type { ApiConfig, ApiError, TaskResponse, SubmitTaskResponse, UserProfile } from './services/apiService';
export { TonWalletService, initializeTonWalletService, getTonWalletService } from './services/tonWalletService';
export type {
  WalletBalance,
  Transaction,
  TonWalletConfig,
} from './services/tonWalletService';
export { SocketService, initializeSocketService, getSocketService } from './services/socketService';
export type {
  SocketConfig,
  SocketEvents,
  SocketEventName,
  SocketEventHandler,
} from './services/socketService';

// Performance monitoring
export { performanceMonitor, PerformanceMonitor as PerformanceMonitorClass, ImageOptimizer, CodeSplitter, MemoryOptimizer, MobileOptimizer } from './lib/performance';
export type { PerformanceMetrics, BundleAnalysis } from './lib/performance';

// Form validation
export { Validator, FormManager } from './lib/validation';
export type {
  ValidationRule as ValidationRuleType,
  ValidationResult,
  FormField as ValidationFormField,
  FormState
} from './lib/validation';

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
  FormValidation,
  GridProps,
  RowProps,
} from './types/common';

export type { Task, TaskSubmission, UseTaskManagerOptions, UseTaskManagerReturn } from './hooks/useTaskManager';
export type { EarningsData, EarningsDashboardProps } from './components/earnings/EarningsDashboard';
export type { UseTonWalletOptions, UseTonWalletReturn } from './hooks/useTonWallet';
export type { WalletButtonProps } from './components/wallet/WalletButton';
export type { WalletModalProps } from './components/wallet/WalletModal';
export type { TransactionHistoryProps } from './components/wallet/TransactionHistory';
export type { BalanceDisplayProps } from './components/wallet/BalanceDisplay';
export type { UseSocketOptions, UseSocketReturn } from './hooks/useSocket';
export type { PaymentModalProps } from './components/payment/PaymentModal';
export type { PaymentHistoryProps } from './components/payment/PaymentHistory';
export type { WithdrawalFormProps } from './components/payment/WithdrawalForm';
export type { TooltipProps } from './components/Tooltip';
export type { BadgeProps } from './components/Badge';
export type { LoadingSpinnerProps } from './components/LoadingSpinner';
export type { AlertProps } from './components/Alert';
export type { AnimatedContainerProps } from './components/AnimatedContainer';
export type { LanguageSelectorProps } from './components/LanguageSelector';
export type { UseTranslationReturn } from './hooks/useTranslation';
export type { PerformanceMonitorProps } from './components/PerformanceMonitor';
export type { UsePerformanceReturn } from './hooks/usePerformance';
export type { FormProps } from './components/Form';
export type { FormFieldProps as FormFieldComponentProps } from './components/FormField';

// Design System
export * from './lib/design-tokens';

// Utilities
export { cn } from './lib/utils';

// Accessibility
export * from './lib/accessibility';

// Re-export commonly used third-party components (simplified to avoid conflicts)
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@radix-ui/react-dialog';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@radix-ui/react-dropdown-menu';

export {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@radix-ui/react-toast';

export {
  TooltipProvider,
} from '@radix-ui/react-tooltip';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@radix-ui/react-select';