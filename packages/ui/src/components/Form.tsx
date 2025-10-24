import React, { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface FormProps {
  children: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
  noValidate?: boolean;
  autoComplete?: 'on' | 'off';
}

export function Form({
  children,
  onSubmit,
  className,
  noValidate = true,
  autoComplete = 'on',
}: FormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn('space-y-6', className)}
      noValidate={noValidate}
      autoComplete={autoComplete}
    >
      {children}
    </form>
  );
}

export default Form;
