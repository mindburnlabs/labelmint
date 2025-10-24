// Comprehensive form validation utilities for LabelMint

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  numeric?: boolean;
  positive?: boolean;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface FormField {
  name: string;
  value: any;
  rules: ValidationRule;
  touched: boolean;
  dirty: boolean;
}

export interface FormState {
  fields: Record<string, FormField>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * Validation utilities
 */
export class Validator {
  /**
   * Validate a single field
   */
  static validateField(value: any, rules: ValidationRule): string | null {
    // Required validation
    if (rules.required && (value === null || value === undefined || value === '')) {
      return 'This field is required';
    }

    // Skip other validations if value is empty and not required
    if (!rules.required && (value === null || value === undefined || value === '')) {
      return null;
    }

    // String length validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return `Must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `Must be no more than ${rules.maxLength} characters`;
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return 'Invalid format';
    }

    // Email validation
    if (rules.email && typeof value === 'string') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    // URL validation
    if (rules.url && typeof value === 'string') {
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
    }

    // Numeric validation
    if (rules.numeric) {
      const num = Number(value);
      if (isNaN(num)) {
        return 'Must be a number';
      }
    }

    // Positive number validation
    if (rules.positive) {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return 'Must be a positive number';
      }
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }

  /**
   * Validate multiple fields
   */
  static validateFields(fields: Record<string, FormField>): ValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    Object.entries(fields).forEach(([name, field]) => {
      const error = this.validateField(field.value, field.rules);
      if (error) {
        errors[name] = error;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Common validation rules
   */
  static rules = {
    required: { required: true },
    email: { email: true },
    url: { url: true },
    numeric: { numeric: true },
    positive: { positive: true },
    phone: {
      pattern: /^[\+]?[1-9][\d]{0,15}$/,
      message: 'Please enter a valid phone number',
    },
    password: {
      minLength: 8,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      message: 'Password must contain at least 8 characters with uppercase, lowercase, number, and special character',
    },
    username: {
      minLength: 3,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_]+$/,
      message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
    },
    tonAddress: {
      pattern: /^[A-Za-z0-9_-]{48}$/,
      message: 'Please enter a valid TON wallet address',
    },
    amount: {
      numeric: true,
      positive: true,
      custom: (value: any) => {
        const num = Number(value);
        if (num > 1000000) {
          return 'Amount cannot exceed 1,000,000';
        }
        return null;
      },
    },
  };

  /**
   * Sanitize input
   */
  static sanitize(value: any, type: 'string' | 'number' | 'email' | 'url'): any {
    if (value === null || value === undefined) return value;

    switch (type) {
      case 'string':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'email':
        return String(value).toLowerCase().trim();
      case 'url':
        return String(value).trim();
      default:
        return value;
    }
  }

  /**
   * Format validation error message
   */
  static formatError(fieldName: string, error: string): string {
    return `${fieldName}: ${error}`;
  }
}

/**
 * Form state management
 */
export class FormManager {
  private state: FormState;
  private listeners: Set<(state: FormState) => void> = new Set();

  constructor(initialFields: Record<string, { value: any; rules: ValidationRule }>) {
    this.state = {
      fields: Object.entries(initialFields).reduce((acc, [name, { value, rules }]) => {
        acc[name] = {
          name,
          value,
          rules,
          touched: false,
          dirty: false,
        };
        return acc;
      }, {} as Record<string, FormField>),
      isValid: false,
      isSubmitting: false,
      isDirty: false,
      errors: {},
      warnings: {},
    };

    this.validateForm();
  }

  /**
   * Subscribe to form state changes
   */
  subscribe(listener: (state: FormState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current form state
   */
  getState(): FormState {
    return { ...this.state };
  }

  /**
   * Update field value
   */
  setField(name: string, value: any): void {
    if (!this.state.fields[name]) return;

    this.state.fields[name] = {
      ...this.state.fields[name],
      value,
      dirty: true,
    };

    this.state.isDirty = Object.values(this.state.fields).some(field => field.dirty);
    this.validateForm();
    this.notifyListeners();
  }

  /**
   * Mark field as touched
   */
  touchField(name: string): void {
    if (!this.state.fields[name]) return;

    this.state.fields[name] = {
      ...this.state.fields[name],
      touched: true,
    };

    this.validateForm();
    this.notifyListeners();
  }

  /**
   * Get field value
   */
  getField(name: string): any {
    return this.state.fields[name]?.value;
  }

  /**
   * Get field error
   */
  getFieldError(name: string): string | null {
    return this.state.errors[name] || null;
  }

  /**
   * Check if field has error
   */
  hasFieldError(name: string): boolean {
    return name in this.state.errors;
  }

  /**
   * Check if field is touched
   */
  isFieldTouched(name: string): boolean {
    return this.state.fields[name]?.touched || false;
  }

  /**
   * Check if field is dirty
   */
  isFieldDirty(name: string): boolean {
    return this.state.fields[name]?.dirty || false;
  }

  /**
   * Reset field
   */
  resetField(name: string): void {
    if (!this.state.fields[name]) return;

    this.state.fields[name] = {
      ...this.state.fields[name],
      value: null,
      touched: false,
      dirty: false,
    };

    this.validateForm();
    this.notifyListeners();
  }

  /**
   * Reset entire form
   */
  resetForm(): void {
    Object.keys(this.state.fields).forEach(name => {
      this.state.fields[name] = {
        ...this.state.fields[name],
        value: null,
        touched: false,
        dirty: false,
      };
    });

    this.state.isDirty = false;
    this.validateForm();
    this.notifyListeners();
  }

  /**
   * Set submitting state
   */
  setSubmitting(isSubmitting: boolean): void {
    this.state.isSubmitting = isSubmitting;
    this.notifyListeners();
  }

  /**
   * Get form values
   */
  getValues(): Record<string, any> {
    const values: Record<string, any> = {};
    Object.entries(this.state.fields).forEach(([name, field]) => {
      values[name] = field.value;
    });
    return values;
  }

  /**
   * Validate form
   */
  private validateForm(): void {
    const result = Validator.validateFields(this.state.fields);
    this.state.isValid = result.isValid;
    this.state.errors = result.errors;
    this.state.warnings = result.warnings;
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

/**
 * React hook for form management
 */
export function useForm(initialFields: Record<string, { value: any; rules: ValidationRule }>) {
  const [formManager] = useState(() => new FormManager(initialFields));
  const [state, setState] = useState<FormState>(formManager.getState());

  useEffect(() => {
    const unsubscribe = formManager.subscribe(setState);
    return unsubscribe;
  }, [formManager]);

  return {
    ...state,
    setField: formManager.setField.bind(formManager),
    touchField: formManager.touchField.bind(formManager),
    getField: formManager.getField.bind(formManager),
    getFieldError: formManager.getFieldError.bind(formManager),
    hasFieldError: formManager.hasFieldError.bind(formManager),
    isFieldTouched: formManager.isFieldTouched.bind(formManager),
    isFieldDirty: formManager.isFieldDirty.bind(formManager),
    resetField: formManager.resetField.bind(formManager),
    resetForm: formManager.resetForm.bind(formManager),
    setSubmitting: formManager.setSubmitting.bind(formManager),
    getValues: formManager.getValues.bind(formManager),
  };
}

export default Validator;
