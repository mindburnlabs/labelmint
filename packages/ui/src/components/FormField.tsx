import React, { useState, useRef } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { cn } from '../lib/utils';

export interface FormFieldProps {
  name: string;
  label?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea';
  placeholder?: string;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  warning?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  helpText?: string;
  showPasswordToggle?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  rows?: number;
  cols?: number;
}

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  warning,
  required = false,
  disabled = false,
  className,
  inputClassName,
  labelClassName,
  errorClassName,
  helpText,
  showPasswordToggle = false,
  maxLength,
  minLength,
  pattern,
  autoComplete,
  autoFocus = false,
  rows = 3,
  cols,
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = type === 'number' ? Number(e.target.value) : e.target.value;
    onChange(newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getInputType = (): string => {
    if (type === 'password' && showPassword) return 'text';
    return type;
  };

  const renderInput = () => {
    const commonProps = {
      ref: inputRef,
      id: name,
      name,
      value: value || '',
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder,
      disabled,
      required,
      autoComplete,
      autoFocus,
      maxLength,
      minLength,
      pattern,
      className: cn(
        'w-full',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        warning && !error && 'border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500',
        isFocused && 'ring-2 ring-blue-500',
        inputClassName
      ),
    };

    if (type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          rows={rows}
          cols={cols}
          className={cn(commonProps.className, 'resize-vertical min-h-[80px]')}
        />
      );
    }

    return (
      <div className="relative">
        <Input
          {...commonProps}
          type={getInputType()}
        />
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={name}
          className={cn(
            'block text-sm font-medium',
            error && 'text-red-700 dark:text-red-400',
            warning && !error && 'text-yellow-700 dark:text-yellow-400',
            !error && !warning && 'text-gray-700 dark:text-gray-300',
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input */}
      {renderInput()}

      {/* Help Text */}
      {helpText && !error && !warning && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <div className={cn('flex items-center gap-2 text-sm text-red-600 dark:text-red-400', errorClassName)}>
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Warning Message */}
      {warning && !error && (
        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{warning}</span>
        </div>
      )}

      {/* Character Count */}
      {maxLength && (
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          {String(value || '').length}/{maxLength}
        </div>
      )}
    </div>
  );
}

export default FormField;
