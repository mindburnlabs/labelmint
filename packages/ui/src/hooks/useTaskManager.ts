import { useState, useEffect, useRef, useCallback } from 'react';

export interface Task {
  id: string;
  type: string;
  sub_type?: string;
  data: any;
  categories?: string[];
  points: number;
  time_limit_seconds?: number;
  config?: Record<string, any>;
  mediaUrl?: string;
  mediaType?: string;
}

export interface TaskSubmission {
  answer: any;
  timeSpent: number;
  taskId: string;
}

export interface UseTaskManagerOptions {
  onTaskComplete?: () => void;
  autoFetch?: boolean;
  timerInterval?: number;
}

export interface UseTaskManagerReturn {
  // State
  task: Task | null;
  isLoading: boolean;
  isSubmitting: boolean;
  timeSpent: number;
  selectedAnswer: string | null;
  showEarning: boolean;
  earnedAmount: number;
  error: Error | null;

  // Actions
  fetchNextTask: () => Promise<void>;
  submitAnswer: (answer: any) => Promise<void>;
  selectAnswer: (answer: string) => void;
  skipTask: () => Promise<void>;
  resetError: () => void;
  formatTime: (seconds: number) => string;
}

export function useTaskManager({
  onTaskComplete,
  autoFetch = true,
  timerInterval = 1000,
}: UseTaskManagerOptions = {}): UseTaskManagerReturn {
  // State
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showEarning, setShowEarning] = useState(false);
  const [earnedAmount, setEarnedAmount] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  // Format time helper
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Reset timer
  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    startTimeRef.current = Date.now();
    setTimeSpent(0);
  }, []);

  // Start timer
  const startTimer = useCallback(() => {
    resetTimer();
    intervalRef.current = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, timerInterval);
  }, [timerInterval, resetTimer]);

  // Fetch next task (to be implemented with actual API)
  const fetchNextTask = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // const response = await apiService.getNextTask();
      const mockTask: Task = {
        id: `task-${Date.now()}`,
        type: 'classification',
        data: 'Sample task data',
        categories: ['option1', 'option2'],
        points: 100,
        time_limit_seconds: 300,
      };

      setTask(mockTask);
      setSelectedAnswer(null);
      setShowEarning(false);
      setEarnedAmount(0);
      startTimer();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch task');
      setError(error);
      console.error('Failed to fetch task:', error);
      setTask(null);
    } finally {
      setIsLoading(false);
    }
  }, [startTimer]);

  // Submit answer (to be implemented with actual API)
  const submitAnswer = useCallback(async (answer: any) => {
    if (!task || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // TODO: Replace with actual API call based on task type
      // let response;
      // if (task.type === 'classification') {
      //   response = await apiService.submitTaskResponse(task.id, answer, timeSpent);
      // } else if (task.type === 'annotation') {
      //   response = await apiService.submitAnnotation(task.id, answer);
      // }
      // ... other task types

      // Mock response
      const mockEarnedAmount = task.points / 100;
      setEarnedAmount(mockEarnedAmount);
      setShowEarning(true);

      // Wait to show earnings
      setTimeout(() => {
        resetTimer();
        onTaskComplete?.();
        fetchNextTask();
      }, 1500);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit task');
      setError(error);
      console.error('Failed to submit task:', error);
      setIsSubmitting(false);
    }
  }, [task, isSubmitting, timeSpent, onTaskComplete, fetchNextTask, resetTimer]);

  // Select answer
  const selectAnswer = useCallback((answer: string) => {
    setSelectedAnswer(answer);
    // TODO: Add haptic feedback if in Telegram
    // telegramService.hapticSelection();
  }, []);

  // Skip task (to be implemented with actual API)
  const skipTask = useCallback(async () => {
    if (!task || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // TODO: Replace with actual API call
      // await apiService.skipTask(task.id);

      resetTimer();
      fetchNextTask();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to skip task');
      setError(error);
      console.error('Failed to skip task:', error);
      setIsSubmitting(false);
    }
  }, [task, isSubmitting, fetchNextTask, resetTimer]);

  // Reset error
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNextTask();
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoFetch, fetchNextTask]);

  return {
    // State
    task,
    isLoading,
    isSubmitting,
    timeSpent,
    selectedAnswer,
    showEarning,
    earnedAmount,
    error,

    // Actions
    fetchNextTask,
    submitAnswer,
    selectAnswer,
    skipTask,
    resetError,
    formatTime,
  };
}