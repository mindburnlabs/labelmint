import React, { forwardRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { ComponentProps, AccessibilityProps, FormFieldProps } from '../types/common';

const inputVariants = cva(
  'flex w-full rounded-md border border-input bg-background text-sm ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        destructive: 'border-destructive focus-visible:ring-destructive',
        success: 'border-green-500 focus-visible:ring-green-500',
        warning: 'border-yellow-500 focus-visible:ring-yellow-500',
        ghost: 'border-transparent bg-transparent focus-visible:ring-transparent focus-visible:bg-muted',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-3 py-2',
        lg: 'h-11 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants>,
    ComponentProps,
    AccessibilityProps,
    Pick<FormFieldProps, 'error' | 'required'> {
  label?: string;
  description?: string;
  helperText?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      size,
      label,
      description,
      helperText,
      error,
      required,
      startAdornment,
      endAdornment,
      containerClassName,
      id,
      disabled,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || `input-${React.useId()}`;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;
    const helperId = `${inputId}-helper`;

    const describedBy = [
      error ? errorId : null,
      description ? descriptionId : null,
      helperText ? helperId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(' ');

    const hasError = !!error;

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              hasError && 'text-destructive',
              required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
            )}
          >
            {label}
          </label>
        )}

        {description && (
          <p
            id={descriptionId}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        <div className="relative">
          {startAdornment && (
            <div className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
              {startAdornment}
            </div>
          )}

          <input
            type={type}
            id={inputId}
            className={cn(
              inputVariants({ variant: hasError ? 'destructive' : variant, size }),
              startAdornment && 'pl-10',
              endAdornment && 'pr-10',
              isFocused && 'ring-2 ring-ring ring-offset-2',
              className
            )}
            ref={ref}
            disabled={disabled}
            aria-invalid={ariaInvalid || hasError}
            aria-describedby={describedBy || undefined}
            aria-required={required}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {endAdornment && (
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
              {endAdornment}
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="text-sm text-destructive flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };