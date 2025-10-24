import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCard } from '@frontend/components/TaskCard';
import { TaskFactory } from '@test/factories/TaskFactory';
import { UserFactory } from '@test/factories/UserFactory';
import type { Task, User } from '@shared/types/database';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      reload: vi.fn(),
      beforePopState: vi.fn(),
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      },
      pathname: '/tasks',
      query: {},
      asPath: '/tasks',
    };
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn((element) => {
    // Simulate intersection
    setTimeout(() => {
      callback([{ isIntersecting: true, target: element }]);
    }, 100);
  }),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock Image loading
global.Image = vi.fn().mockImplementation(() => ({
  onload: vi.fn(),
  onerror: vi.fn(),
  src: '',
})) as any;

describe('TaskCard', () => {
  let mockTask: Task;
  let mockUser: User;
  let mockOnAccept: ReturnType<typeof vi.fn>;
  let mockOnView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTask = TaskFactory.createPending({
      title: 'Classify Vehicle Images',
      description: 'Identify different types of vehicles in images',
      reward: 0.5,
      estimatedTime: 60,
      metadata: {
        imageUrl: 'https://example.com/image.jpg',
        categories: ['car', 'truck', 'motorcycle'],
        difficulty: 'easy',
      },
    });

    mockUser = UserFactory.createWorker({
      reputation: 85,
      accuracy: 0.92,
    });

    mockOnAccept = vi.fn();
    mockOnView = vi.fn();
  });

  describe('Rendering', () => {
    it('should render task information correctly', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('Classify Vehicle Images')).toBeInTheDocument();
      expect(screen.getByText(/Identify different types of vehicles/)).toBeInTheDocument();
      expect(screen.getByText('$0.50')).toBeInTheDocument();
      expect(screen.getByText('1 min')).toBeInTheDocument();
    });

    it('should show task image when available', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should show placeholder when no image', () => {
      const taskWithoutImage = TaskFactory.createPending({
        ...mockTask,
        metadata: { ...mockTask.metadata, imageUrl: undefined },
      });

      render(
        <TaskCard
          task={taskWithoutImage}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const placeholder = screen.getByTestId('task-image-placeholder');
      expect(placeholder).toBeInTheDocument();
    });

    it('should display difficulty badge', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByTestId('difficulty-badge')).toHaveClass('bg-green-100');
    });

    it('should display priority indicator for high priority tasks', () => {
      const highPriorityTask = TaskFactory.createPending({
        ...mockTask,
        priority: 'urgent',
      });

      render(
        <TaskCard
          task={highPriorityTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('URGENT')).toBeInTheDocument();
      expect(screen.getByTestId('priority-indicator')).toHaveClass('bg-red-500');
    });
  });

  describe('User Eligibility', () => {
    it('should show accept button for eligible users', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByText('Accept Task');
      expect(acceptButton).toBeInTheDocument();
      expect(acceptButton).not.toBeDisabled();
    });

    it('should disable accept button for ineligible users', () => {
      const ineligibleUser = UserFactory.createWorker({ reputation: 20 });

      render(
        <TaskCard
          task={mockTask}
          user={ineligibleUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByText('Accept Task');
      expect(acceptButton).toBeDisabled();
      expect(screen.getByText(/Reputation too low/)).toBeInTheDocument();
    });

    it('should show locked state for unverified users', () => {
      const unverifiedUser = UserFactory.createWorker({
        kycStatus: 'pending',
      });

      render(
        <TaskCard
          task={mockTask}
          user={unverifiedUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('🔒 KYC Required')).toBeInTheDocument();
      expect(screen.getByText('Complete verification to access this task')).toBeInTheDocument();
    });

    it('should show completed indicator for completed tasks', () => {
      const completedTask = TaskFactory.createCompleted({
        ...mockTask,
        status: 'completed',
        finalLabel: 'car',
      });

      render(
        <TaskCard
          task={completedTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('✅ Completed')).toBeInTheDocument();
      expect(screen.getByText('Final Answer: car')).toBeInTheDocument();
      expect(screen.queryByText('Accept Task')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onAccept when accept button is clicked', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByText('Accept Task');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockOnAccept).toHaveBeenCalledWith(mockTask.id);
      });
    });

    it('should call onView when view details is clicked', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const viewButton = screen.getByText('View Details');
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(mockOnView).toHaveBeenCalledWith(mockTask.id);
      });
    });

    it('should show task details modal on expand', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const expandButton = screen.getByLabelText('Expand task details');
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Task Instructions')).toBeInTheDocument();
        expect(screen.getByText(mockTask.instructions)).toBeInTheDocument();
        expect(screen.getByText('Categories')).toBeInTheDocument();
      });
    });

    it('should show timer for active tasks', () => {
      const activeTask = TaskFactory.createInProgress({
        ...mockTask,
        assignedTo: mockUser.id,
        startedAt: new Date(Date.now() - 30000), // 30 seconds ago
        timeLimit: 300, // 5 minutes
      });

      render(
        <TaskCard
          task={activeTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByTestId('task-timer')).toBeInTheDocument();
      expect(screen.getByText(/Time remaining/)).toBeInTheDocument();
    });
  });

  describe('Reward Display', () => {
    it('should display reward with appropriate formatting', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('$0.50')).toBeInTheDocument();
      expect(screen.getByTestId('reward-amount')).toHaveClass('text-green-600');
    });

    it('should show bonus indicator for high reward tasks', () => {
      const highRewardTask = TaskFactory.createPending({
        ...mockTask,
        reward: 5.0,
      });

      render(
        <TaskCard
          task={highRewardTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument();
    });

    it('should calculate potential earnings based on user stats', () => {
      const expertUser = UserFactory.createWorker({
        reputation: 98,
        accuracy: 0.99,
      });

      render(
        <TaskCard
          task={mockTask}
          user={expertUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByText(/\+2% Expert Bonus/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      expect(screen.getByRole('button', { name: /Accept task/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View details/ })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /Accept task/ });
      acceptButton.focus();
      expect(acceptButton).toHaveFocus();

      fireEvent.keyDown(acceptButton, { key: 'Enter' });
      expect(mockOnAccept).toHaveBeenCalled();
    });

    it('should have appropriate color contrast', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const rewardElement = screen.getByTestId('reward-amount');
      expect(rewardElement).toHaveClass('text-green-600');

      const priorityElement = screen.getByTestId('priority-badge');
      expect(priorityElement).toHaveClass('bg-gray-100');
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton while image loads', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const skeleton = screen.getByTestId('image-skeleton');
      expect(skeleton).toBeInTheDocument();
    });

    it('should show loading state on accept action', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          }}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByText('Accept Task');
      fireEvent.click(acceptButton);

      expect(screen.getByText('Accepting...')).toBeInTheDocument();
      expect(acceptButton).toBeDisabled();
    });
  });

  describe('Error States', () => {
    it('should show error when image fails to load', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const image = screen.getByRole('img');
      fireEvent.error(image);

      await waitFor(() => {
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });
    });

    it('should show error message when accept fails', async () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={async () => {
            throw new Error('Task not available');
          }}
          onView={mockOnView}
        />
      );

      const acceptButton = screen.getByText('Accept Task');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to accept task')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const card = screen.getByTestId('task-card');
      expect(card).toHaveClass('max-w-full');
    });

    it('should stack buttons on small screens', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const buttonContainer = screen.getByTestId('button-container');
      expect(buttonContainer).toHaveClass('flex-col');
    });
  });

  describe('Performance', () => {
    it('should lazy load images', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('should debounce expand actions', async () => {
      const { rerender } = render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
        />
      );

      const expandButton = screen.getByLabelText('Expand task details');

      // Rapid clicks
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Task Instructions')).toBeInTheDocument();
      });

      // Should only call once
      expect(screen.queryAllByText('Task Instructions')).toHaveLength(1);
    });
  });

  describe('Variants', () => {
    it('should render compact variant', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
          variant="compact"
        />
      );

      const card = screen.getByTestId('task-card');
      expect(card).toHaveClass('p-3');
    });

    it('should render detailed variant', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
          variant="detailed"
        />
      );

      expect(screen.getByText('Full Description')).toBeInTheDocument();
      expect(screen.getByText(mockTask.description)).toBeInTheDocument();
    });

    it('should render grid variant', () => {
      render(
        <TaskCard
          task={mockTask}
          user={mockUser}
          onAccept={mockOnAccept}
          onView={mockOnView}
          variant="grid"
        />
      );

      const card = screen.getByTestId('task-card');
      expect(card).toHaveClass('h-full');
    });
  });
});