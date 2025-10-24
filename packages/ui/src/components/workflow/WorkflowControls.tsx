import React, { memo } from 'react';
import { Button } from '../Button';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface WorkflowControlsProps extends ComponentProps {
  onSave: () => void;
  onExecute: () => void;
  isExecuting: boolean;
  readOnly: boolean;
  canSave?: boolean;
  canExecute?: boolean;
  saveText?: string;
  executeText?: string;
  executingText?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export const WorkflowControls = memo<WorkflowControlsProps>(({
  onSave,
  onExecute,
  isExecuting,
  readOnly,
  canSave = true,
  canExecute = true,
  saveText = 'Save Workflow',
  executeText = 'Execute Workflow',
  executingText = 'Executing...',
  variant = 'default',
  className,
  ...props
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex gap-2', className)} {...props}>
        {!readOnly && canSave && (
          <Button
            onClick={onSave}
            size="sm"
            variant="outline"
            aria-label={saveText}
          >
            Save
          </Button>
        )}
        {!readOnly && canExecute && (
          <Button
            onClick={onExecute}
            disabled={isExecuting}
            loading={isExecuting}
            loadingText={executingText}
            size="sm"
            aria-label={executeText}
          >
            {isExecuting ? executingText : 'Run'}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex gap-2', className)} {...props}>
        {!readOnly && (
          <>
            <Button
              onClick={onSave}
              disabled={!canSave}
              size="sm"
              variant="secondary"
              aria-label={saveText}
            >
              Save
            </Button>
            <Button
              onClick={onExecute}
              disabled={!canExecute || isExecuting}
              loading={isExecuting}
              loadingText={executingText}
              size="sm"
              aria-label={executeText}
            >
              {isExecuting ? executingText : 'Run'}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)} {...props}>
      {!readOnly && (
        <>
          <Button
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            aria-label={saveText}
          >
            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
            </svg>
            {saveText}
          </Button>
          <Button
            onClick={onExecute}
            disabled={isExecuting}
            loading={isExecuting}
            loadingText={executingText}
            className="bg-green-600 hover:bg-green-700 text-white"
            aria-label={executeText}
          >
            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isExecuting ? executingText : executeText}
          </Button>
        </>
      )}
    </div>
  );
});

WorkflowControls.displayName = 'WorkflowControls';