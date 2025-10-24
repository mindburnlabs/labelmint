import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiService } from '../services/apiService';

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
  title?: string;
  description?: string;
  options?: string[];
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
  useApiService?: boolean;
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
  useApiService = true,
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

  // Fetch next task
  const fetchNextTask = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (useApiService) {
        // Use real API service
        try {
          const apiService = getApiService();
          const response = await apiService.getNextTask();
          
          if (response.success && response.task) {
            const apiTask = response.task;
            const task: Task = {
              id: apiTask.id,
              type: apiTask.type,
              sub_type: apiTask.sub_type,
              data: apiTask.data,
              categories: apiTask.categories || apiTask.options,
              points: apiTask.points,
              time_limit_seconds: apiTask.time_limit_seconds,
              config: apiTask.config,
              mediaUrl: apiTask.mediaUrl,
              mediaType: apiTask.mediaType,
              title: apiTask.title,
              description: apiTask.description,
              options: apiTask.options,
            };
            
            setTask(task);
            setSelectedAnswer(null);
            setShowEarning(false);
            setEarnedAmount(0);
            startTimer();
          } else {
            throw new Error('No tasks available');
          }
        } catch (apiError) {
          // If API service not initialized or fails, fall back to mock
          console.warn('API service unavailable, using mock data:', apiError);
          throw apiError;
        }
      } else {
        // Use mock data for development/testing
        const mockTask: Task = {
          id: `task-${Date.now()}`,
          type: 'classification',
          data: 'Sample task data',
          categories: ['option1', 'option2'],
          points: 100,
          time_limit_seconds: 300,
          title: 'Sample Classification Task',
          description: 'This is a sample task for testing',
        };

        setTask(mockTask);
        setSelectedAnswer(null);
        setShowEarning(false);
        setEarnedAmount(0);
        startTimer();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch task');
      setError(error);
      console.error('Failed to fetch task:', error);
      setTask(null);
    } finally {
      setIsLoading(false);
    }
  }, [startTimer, useApiService]);

  // Submit answer
  const submitAnswer = useCallback(async (answer: any) => {
    if (!task || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (useApiService) {
        // Use real API service
        try {
          const apiService = getApiService();
          const response = await apiService.submitTask(task.id, answer, timeSpent);

          if (response.success) {
            setEarnedAmount(response.pointsEarned);
            setShowEarning(true);

            // Wait to show earnings
            setTimeout(() => {
              resetTimer();
              onTaskComplete?.();
              fetchNextTask();
            }, 1500);
          } else {
            throw new Error('Failed to submit task');
          }
        } catch (apiError) {
          console.error('API submit error:', apiError);
          throw apiError;
        }
      } else {
        // Mock response for development/testing
        const mockEarnedAmount = task.points / 100;
        setEarnedAmount(mockEarnedAmount);
        setShowEarning(true);

        // Wait to show earnings
        setTimeout(() => {
          resetTimer();
          onTaskComplete?.();
          fetchNextTask();
        }, 1500);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit task');
      setError(error);
      console.error('Failed to submit task:', error);
      setIsSubmitting(false);
    }
  }, [task, isSubmitting, timeSpent, onTaskComplete, fetchNextTask, resetTimer, useApiService]);

  // Select answer
  const selectAnswer = useCallback((answer: string) => {
    setSelectedAnswer(answer);
    
    // Add haptic feedback if in Telegram
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      try {
        (window as any).Telegram.WebApp.HapticFeedback.selectionChanged();
      } catch (e) {
        // Silently fail if haptic feedback not available
      }
    }
  }, []);

  // Skip task
  const skipTask = useCallback(async () => {
    if (!task || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (useApiService) {
        // Use real API service
        try {
          const apiService = getApiService();
          await apiService.skipTask(task.id);
        } catch (apiError) {
          console.error('API skip error:', apiError);
          // Continue anyway to fetch next task
        }
      }

      resetTimer();
      fetchNextTask();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to skip task');
      setError(error);
      console.error('Failed to skip task:', error);
      setIsSubmitting(false);
    }
  }, [task, isSubmitting, fetchNextTask, resetTimer, useApiService]);

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