import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { ComponentProps, AccessibilityProps, LoadingState } from '../types/common';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success:
          'bg-green-600 text-white hover:bg-green-700 shadow-sm',
        warning:
          'bg-yellow-600 text-white hover:bg-yellow-700 shadow-sm',
        info: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-lg px-10 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-9 w-9',
        'icon-lg': 'h-11 w-11',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants>,
    ComponentProps,
    AccessibilityProps,
    LoadingState {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  leftIcon?: React.ReactNode; // Alias for startIcon for backward compatibility
  rightIcon?: React.ReactNode; // Alias for endIcon for backward compatibility
  pressAnimation?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      disabled,
      loading = false,
      loadingText,
      startIcon,
      endIcon,
      leftIcon, // Support legacy prop name
      rightIcon, // Support legacy prop name
      pressAnimation = true,
      children,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-expanded': ariaExpanded,
      'aria-pressed': ariaPressed,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? 'button' : 'button';

    // Support both new and legacy icon prop names
    const finalStartIcon = startIcon || leftIcon;
    const finalEndIcon = endIcon || rightIcon;

    // Show loading spinner
    if (loading) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, fullWidth }), className)}
          ref={ref}
          disabled={true}
          aria-label={loadingText || ariaLabel}
          aria-busy={true}
          {...props}
        >
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {loadingText || 'Loading...'}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, fullWidth }),
          pressAnimation &&
            'active:scale-95 active:shadow-sm active:shadow-black/5 transition-transform',
          className
        )}
        ref={ref}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-expanded={ariaExpanded}
        aria-pressed={ariaPressed}
        {...props}
      >
        {finalStartIcon && <span className="mr-2">{finalStartIcon}</span>}
        {children}
        {finalEndIcon && <span className="ml-2">{finalEndIcon}</span>}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };