/**
 * Common TypeScript interfaces for the UI package
 */

// Base API response interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    version: string;
  };
}

// Common component props
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
  'data-testid'?: string;
}

// Loading state
export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
}

// Error state
export interface ErrorState {
  hasError: boolean;
  error?: Error | string;
  errorText?: string;
}

// Size variants
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Color variants
export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

// Position types
export type Position = 'relative' | 'absolute' | 'fixed' | 'sticky' | 'static';

// Alignment types
export type Alignment = 'start' | 'center' | 'end' | 'stretch';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';

// Responsive value
export type ResponsiveValue<T> = T | Partial<Record<'sm' | 'md' | 'lg' | 'xl', T>>;

// Event handlers
export interface EventHandlers {
  onClick?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onKeyUp?: (event: React.KeyboardEvent) => void;
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
}

// Accessibility props
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-busy'?: boolean;
  'aria-atomic'?: boolean;
  role?: string;
  tabIndex?: number;
}

// Theme props
export interface ThemeProps {
  theme?: 'light' | 'dark' | 'system';
  variant?: ColorVariant;
  size?: SizeVariant;
}

// Animation props
export interface AnimationProps {
  animate?: boolean;
  animationDuration?: number;
  animationDelay?: number;
  animationEasing?: string;
}

// Form related types
export interface FormFieldProps {
  name: string;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  group?: string;
}

// Table types
export interface TableColumn<T = unknown> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface TablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
}

// Modal/Dialog types
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: SizeVariant;
  closable?: boolean;
  maskClosable?: boolean;
  destroyOnClose?: boolean;
  footer?: React.ReactNode;
}

// Notification/Toast types
export interface NotificationItem {
  id: string | number;
  type: ColorVariant;
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  action?: React.ReactNode;
}

// Skeleton types
export interface SkeletonProps {
  loading: boolean;
  children?: React.ReactNode;
  paragraph?: boolean | { rows?: number; width?: string | Array<string> };
  title?: boolean | { width?: string };
  avatar?: boolean | { size?: SizeVariant; shape?: 'circle' | 'square' };
  active?: boolean;
  round?: boolean;
}

// Breadcrumb types
export interface BreadcrumbItem {
  title: React.ReactNode;
  path?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// Menu types
export interface MenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  children?: MenuItem[];
  type?: 'item' | 'divider' | 'group';
}

// File upload types
export interface UploadFile {
  uid: string;
  name: string;
  status: 'uploading' | 'done' | 'error' | 'removed';
  url?: string;
  size?: number;
  type?: string;
  lastModified?: number;
  response?: unknown;
  error?: Error;
  percent?: number;
  originFileObj?: File;
}

export interface UploadProps {
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  disabled?: boolean;
  listType?: 'text' | 'picture' | 'picture-card';
  fileList?: UploadFile[];
  onPreview?: (file: UploadFile) => void;
  onRemove?: (file: UploadFile) => void | boolean | Promise<void | boolean>;
  beforeUpload?: (file: File, FileList: File[]) => boolean | Promise<void>;
  onChange?: (info: { file: UploadFile; fileList: UploadFile[] }) => void;
}

// Progress types
export interface ProgressProps {
  percent: number;
  status?: 'normal' | 'exception' | 'active' | 'success';
  format?: (percent?: number, successPercent?: number) => React.ReactNode;
  type?: 'line' | 'circle' | 'dashboard';
  size?: SizeVariant;
  strokeColor?: string | { from: string; to: string }[];
  trailColor?: string;
  strokeWidth?: number;
  showInfo?: boolean;
}

// Tree types
export interface TreeNode {
  key: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  disableCheckbox?: boolean;
  selectable?: boolean;
  checkable?: boolean;
  children?: TreeNode[];
  isLeaf?: boolean;
  switcherIcon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Date picker types
export interface DateRange {
  start: Date;
  end: Date;
}

export type DateValue = Date | DateRange | null;

// Validation types
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: unknown) => string | undefined;
  message?: string;
}

export interface FormValidation<T = unknown> {
  [K in keyof T]?: ValidationRule | ValidationRule[];
}

// Grid system types
export interface GridProps {
  span?: number | ResponsiveValue<number>;
  offset?: number | ResponsiveValue<number>;
  order?: number | ResponsiveValue<number>;
  push?: number | ResponsiveValue<number>;
  pull?: number | ResponsiveValue<number>;
}

export interface RowProps {
  gutter?: number | [number, number] | ResponsiveValue<number | [number, number]>;
  justify?: 'start' | 'end' | 'center' | 'space-around' | 'space-between' | 'space-evenly';
  align?: 'top' | 'middle' | 'bottom' | 'stretch';
  wrap?: boolean;
}