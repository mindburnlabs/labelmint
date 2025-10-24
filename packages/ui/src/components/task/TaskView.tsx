import React, { memo, useMemo } from 'react';
import { TaskContent } from './TaskContent';
import { TaskActions } from './TaskActions';
import { EarningAnimation } from './EarningAnimation';
import { useTaskManager } from '../../hooks/useTaskManager';
import { Card } from '../Card';
import { Button } from '../Button';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface TaskViewProps extends ComponentProps {
  onTaskComplete?: () => void;
  apiService?: {
    getNextTask: () => Promise<any>;
    submitTaskResponse: (taskId: string, response: any, timeSpent: number) => Promise<any>;
    skipTask: (taskId: string) => Promise<void>;
  };
  renderTask?: (task: any, onSelectAnswer: (answer: string) => void, selectedAnswer: string | null) => React.ReactNode;
  autoFetch?: boolean;
}

export const TaskView = memo<TaskViewProps>(({
  onTaskComplete,
  apiService,
  renderTask,
  autoFetch = true,
  className,
  ...props
}) => {
  const {
    task,
    isLoading,
    isSubmitting,
    timeSpent,
    selectedAnswer,
    showEarning,
    earnedAmount,
    error,
    fetchNextTask,
    submitAnswer,
    selectAnswer,
    skipTask,
    resetError,
    formatTime,
  } = useTaskManager({
    onTaskComplete,
    autoFetch,
  });

  // Memoize task renderer
  const taskRenderer = useMemo(() => {
    if (!task || renderTask) return renderTask;

    // Default classification task renderer
    return (task: any, onSelectAnswer: (answer: string) => void, selectedAnswer: string | null) => (
      <TaskContent
        title={task.title}
        description={task.description}
        imageUrl={task.type === 'image' ? task.data : undefined}
        imageAlt={task.imageAlt || 'Task image'}
      >
        {task.type === 'text' && (
          <div className="p-4 bg-muted rounded-lg mb-4">
            <p>{task.data}</p>
          </div>
        )}

        {/* Answer Options */}
        {task.options && (
          <div className="grid grid-cols-2 gap-3">
            {task.options.map((option: string, index: number) => (
              <Button
                key={index}
                variant={selectedAnswer === option ? 'default' : 'outline'}
                onClick={() => onSelectAnswer(option)}
                className="p-4 h-auto justify-start text-left"
                disabled={isSubmitting}
                aria-pressed={selectedAnswer === option}
                aria-describedby={`option-${index}-description`}
              >
                <span id={`option-${index}-description`} className="sr-only">
                  Select option {option}
                </span>
                {option}
              </Button>
            ))}
          </div>
        )}
      </TaskContent>
    );
  }, [task, renderTask, isSubmitting]);

  // Handle submission
  const handleSubmit = async () => {
    if (!task) return;

    let response: any;
    if (task.type === 'classification') {
      response = selectedAnswer;
    } else {
      response = { selectedAnswer };
    }

    await submitAnswer(response);
  };

  // Handle error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-full p-4', className)} {...props}>
        <Card className="p-8 text-center max-w-md" variant="elevated">
          <div className="mx-auto w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-error"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">
            {error.message || 'Failed to load task. Please try again.'}
          </p>

          <div className="flex gap-3 justify-center">
            <Button onClick={resetError} variant="outline">
              Dismiss
            </Button>
            <Button onClick={fetchNextTask}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show earning animation
  if (showEarning) {
    return (
      <EarningAnimation
        amount={earnedAmount}
        onComplete={fetchNextTask}
        className={className}
        {...props}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full p-4', className)} {...props}>
        <Card className="p-8 text-center" variant="ghost">
          <div className="animate-pulse space-y-4">
            <div className="w-12 h-12 bg-muted rounded-full mx-auto" />
            <div className="h-4 bg-muted rounded w-48 mx-auto" />
            <div className="h-3 bg-muted rounded w-32 mx-auto" />
          </div>
          <p className="text-muted-foreground mt-6">Loading next task...</p>
        </Card>
      </div>
    );
  }

  // No tasks available
  if (!task) {
    return (
      <div className={cn('flex items-center justify-center h-full p-4', className)} {...props}>
        <Card className="p-8 text-center max-w-sm" variant="elevated">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold mb-4">No tasks available</h2>
          <p className="text-muted-foreground mb-6">
            All tasks have been completed. Check back later for more tasks.
          </p>

          <Button onClick={fetchNextTask} aria-label="Refresh tasks">
            Refresh
          </Button>
        </Card>
      </div>
    );
  }

  // Render the task
  return (
    <div className={cn('flex flex-col h-full gap-4', className)} {...props}>
      {/* Task Content */}
      {taskRenderer(task, selectAnswer, selectedAnswer)}

      {/* Task Actions */}
      <TaskActions
        timeSpent={timeSpent}
        taskValue={task.points}
        isSubmitting={isSubmitting}
        canSubmit={task.type === 'classification' ? !!selectedAnswer : true}
        onSubmit={handleSubmit}
        onSkip={skipTask}
      />
    </div>
  );
});

TaskView.displayName = 'TaskView';