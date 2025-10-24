import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TaskView } from './TaskView';

const meta = {
  title: 'Components/Task/TaskView',
  component: TaskView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A comprehensive task viewing component that handles different task types, timers, and submissions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onTaskComplete: {
      action: 'taskCompleted',
      description: 'Called when a task is completed successfully',
    },
    autoFetch: {
      control: 'boolean',
      description: 'Whether to automatically fetch the next task',
    },
  },
  args: {
    onTaskComplete: fn(),
    autoFetch: false,
  },
} satisfies Meta<typeof TaskView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default loading state
export const Loading: Story = {
  args: {
    autoFetch: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView in loading state while fetching the next task.',
      },
    },
  },
};

// Classification task
export const ClassificationTask: Story = {
  args: {
    autoFetch: false,
    renderTask: (task, onSelectAnswer, selectedAnswer) => (
      <div className="p-4 space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm">What do you see in this image?</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {task.options?.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => onSelectAnswer(option)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedAnswer === option
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
              aria-pressed={selectedAnswer === option}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    ),
  },
  play: async ({ canvasElement, args }) => {
    // Simulate loading a task
    setTimeout(() => {
      const taskElement = canvasElement?.querySelector('[data-testid="task-content"]');
      if (taskElement) {
        // Mock task data would be set here
      }
    }, 1000);
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView displaying a classification task with multiple choice options.',
      },
    },
  },
};

// No tasks available
export const NoTasks: Story = {
  args: {
    autoFetch: false,
  },
  render: (args) => {
    // Simulate no tasks state
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-background rounded-lg border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">No tasks available</h2>
          <p className="text-muted-foreground mb-6">
            All tasks have been completed. Check back later for more tasks.
          </p>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Refresh
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView when no tasks are available.',
      },
    },
  },
};

// Error state
export const Error: Story = {
  render: (args) => {
    // Simulate error state
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-background rounded-lg border">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">
            Failed to load task. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 border border-border rounded-md">
              Dismiss
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView displaying an error state.',
      },
    },
  },
};

// Earning animation
export const EarningAnimation: Story = {
  render: (args) => {
    // Simulate earning animation
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-background rounded-lg border shadow-lg">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-4xl font-bold text-success mb-2">
            +$0.05
          </div>
          <div className="text-lg text-muted-foreground">
            Task completed!
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Added to your balance
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView showing the earning animation after task completion.',
      },
    },
  },
};

// Different task types
export const TaskTypes: Story = {
  render: () => (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Image Classification</h3>
        <TaskView
          autoFetch={false}
          renderTask={(task) => (
            <div className="space-y-4">
              <img
                src="https://via.placeholder.com/400x300/cccccc/666666?text=Sample+Image"
                alt="Sample task image"
                className="w-full rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                {['Cat', 'Dog', 'Bird', 'Fish'].map((option) => (
                  <button
                    key={option}
                    className="p-4 rounded-lg border hover:border-primary transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      </div>

      <div>
        <h3 className="font-semibold mb-2">Text Classification</h3>
        <TaskView
          autoFetch={false}
          renderTask={(task) => (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p>"This product is amazing! I love it so much!"</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['Positive', 'Negative', 'Neutral', 'Mixed'].map((option) => (
                  <button
                    key={option}
                    className="p-4 rounded-lg border hover:border-primary transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        story: 'TaskView displaying different types of tasks.',
      },
    },
  },
};

// Accessibility focus
export const Accessibility: Story = {
  args: {
    'aria-label': 'Task viewer container',
  },
  parameters: {
    docs: {
      description: {
        story: 'TaskView with proper accessibility attributes and keyboard navigation support.',
      },
    },
  },
};