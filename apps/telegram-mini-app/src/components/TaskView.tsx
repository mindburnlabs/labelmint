import React, { useState, useEffect, useRef, useCallback } from 'react';
import { telegramService } from '../services/telegram';
import apiService from '../services/api';
import { useEarnings } from '../hooks/useEarnings';
import { Button, Card, Typography, Alert } from '@telegram-apps/telegram-ui';
import { ErrorBoundary } from '@labelmint/ui';
import type { LabelingTask } from 'shared';

// Import new task type components
import { BoundingBoxTask } from './tasks/BoundingBoxTask';
import { TranscriptionTask } from './tasks/TranscriptionTask';
import { SentimentAnalysisTask } from './tasks/SentimentAnalysisTask';
import { RLHFTask } from './tasks/RLHFTask';

interface TaskViewProps {
  onTaskComplete?: () => void;
}

export const TaskView: React.FC<TaskViewProps> = ({ onTaskComplete }) => {
  const [task, setTask] = useState<LabelingTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showEarning, setShowEarning] = useState(false);
  const [earnedAmount, setEarnedAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  const { earnings, addEarnings } = useEarnings();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      // Process offline queue when back online
      if (offlineQueue.length > 0) {
        processOfflineQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue]);

  // Process offline queue
  const processOfflineQueue = async () => {
    for (const item of offlineQueue) {
      try {
        await item.action();
        setOfflineQueue(prev => prev.filter(q => q.id !== item.id));
      } catch (error) {
        console.error('Failed to process queued item:', error);
      }
    }
  };

  // Fetch next task
  const fetchNextTask = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getNextTask();

      if (response.success && response.data?.task) {
        setTask(response.data.task);
        startTimeRef.current = Date.now();
        setTimeSpent(0);
        setSelectedAnswer(null);
        setShowEarning(false);
        setEarnedAmount(0);

        // Start timer
        intervalRef.current = setInterval(() => {
          setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
      } else {
        // No tasks available
        setTask(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch task:', error);
      setError(error.message || 'Failed to load task');
      setTask(null);
      setRetryCount(prev => prev + 1);

      // Auto-retry for network errors
      if ((error.code === 'NETWORK_ERROR' || error.message?.includes('fetch')) && retryCount < 3) {
        setTimeout(() => {
          fetchNextTask();
        }, 2000 * Math.pow(2, retryCount)); // Exponential backoff
      }
    } finally {
      setIsLoading(false);
    }
  }, [retryCount]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle answer selection for classification tasks
  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    telegramService.hapticSelection();
  };

  // Submit answer
  const handleSubmit = async (response?: any) => {
    if (!task || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    telegramService.hapticImpact('medium');

    try {
      let submitResponse;

      // Handle different task types
      if (task.type === 'classification') {
        submitResponse = await apiService.submitTaskResponse(
          task.id,
          selectedAnswer,
          timeSpent
        );
      } else if (task.type === 'annotation' && task.sub_type === 'bounding_box') {
        // Submit bounding box annotations
        submitResponse = await apiService.submitAnnotation(task.id, {
          type: 'bounding_box',
          annotations: response,
          timeSpent
        });
      } else if (task.type === 'transcription') {
        // Submit transcription
        submitResponse = await apiService.submitTranscription(task.id, {
          text: response.transcription,
          confidence: response.confidence,
          timeSpent
        });
      } else if (task.type === 'sentiment') {
        // Submit sentiment analysis
        submitResponse = await apiService.submitSentimentAnalysis(task.id, {
          ...response,
          timeSpent
        });
      } else if (task.type === 'rlhf') {
        // Submit RLHF comparison
        submitResponse = await apiService.submitRLHFEvaluation(task.id, {
          ...response,
          timeSpent
        });
      } else {
        // Default submission
        submitResponse = await apiService.submitTaskResponse(
          task.id,
          JSON.stringify(response),
          timeSpent
        );
      }

      if (submitResponse.success && submitResponse.data) {
        // Show earnings
        setEarnedAmount(submitResponse.data.earned || task.points / 100);
        setShowEarning(true);
        addEarnings(submitResponse.data.earned || task.points / 100);

        // Haptic feedback for success
        telegramService.hapticNotification('success');

        // Wait a moment to show earnings
        setTimeout(() => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onTaskComplete?.();
          fetchNextTask();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to submit task:', error);
      setError(error.message || 'Failed to submit task');

      // If offline, queue the submission
      if (!isOnline) {
        const queuedItem = {
          id: Date.now(),
          type: 'submit',
          taskId: task.id,
          response,
          timeSpent,
          action: () => submitTaskResponse(task.id, response, timeSpent)
        };
        setOfflineQueue(prev => [...prev, queuedItem]);

        // Show offline notification
        telegramService.showPopup({
          title: 'Offline Mode',
          message: 'Your response will be submitted when you\'re back online.',
          buttons: [{ text: 'OK' }]
        });

        // Move to next task
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onTaskComplete?.();
        fetchNextTask();
      } else {
        setIsSubmitting(false);
      }
    }
  };

  // Separate function for submission (used for retry)
  const submitTaskResponse = async (taskId: string, response: any, time: number) => {
    // Implementation details here...
  };

  // Skip task
  const handleSkip = async () => {
    if (!task || isSubmitting) return;

    setIsSubmitting(true);
    telegramService.hapticImpact('light');

    try {
      await apiService.skipTask(task.id);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      fetchNextTask();
    } catch (error) {
      console.error('Failed to skip task:', error);
      setIsSubmitting(false);
    }
  };

  // Render task based on type
  const renderTask = () => {
    if (!task) return null;

    // Classification task (original)
    if (task.type === 'classification') {
      return (
        <div className="flex flex-col h-full gap-4">
          {/* Task content */}
          <Card className="flex-1 p-4">
            {task.type === 'image' && (
              <img
                src={task.data}
                alt="Task"
                className="w-full max-w-full h-auto rounded-lg mb-4"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            )}

            {task.type === 'text' && (
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <Typography>{task.data}</Typography>
              </div>
            )}

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3">
              {task.options?.map((option, index) => (
                <Button
                  key={index}
                  mode={selectedAnswer === option ? 'filled' : 'outline'}
                  onClick={() => handleAnswerSelect(option)}
                  className="p-4 h-auto"
                  disabled={isSubmitting}
                >
                  {option}
                </Button>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <Typography variant="caption" color="secondary">
                  Time: {formatTime(timeSpent)}
                </Typography>
                <Typography variant="caption" color="secondary" className="ml-4">
                  Value: ${(task.points / 100).toFixed(2)}
                </Typography>
              </div>
              <div className="flex gap-2">
                <Button
                  mode="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Skip
                </Button>
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!selectedAnswer || isSubmitting}
                  loading={isSubmitting}
                >
                  Submit
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Bounding box annotation
    if (task.type === 'annotation' && task.sub_type === 'bounding_box') {
      return (
        <BoundingBoxTask
          imageUrl={task.data.imageUrl || task.data}
          categories={task.categories || ['object']}
          timeLimit={task.config?.timeLimit || 300}
          onSubmit={(annotations) => handleSubmit(annotations)}
          onSkip={handleSkip}
        />
      );
    }

    // Transcription task
    if (task.type === 'transcription') {
      return (
        <TranscriptionTask
          mediaUrl={task.mediaUrl || task.data.url}
          mediaType={task.mediaType || task.data.type}
          instructions={task.config?.instructions}
          expectedLanguage={task.config?.language}
          timeLimit={task.time_limit_seconds || 300}
          onSubmit={(transcription) => handleSubmit(transcription)}
          onSkip={handleSkip}
        />
      );
    }

    // Sentiment analysis
    if (task.type === 'sentiment') {
      return (
        <SentimentAnalysisTask
          text={task.data.text || task.data}
          sentimentOptions={task.categories || ['positive', 'negative', 'neutral']}
          includeEmotions={task.config?.includeEmotions}
          extractKeyPhrases={task.config?.extractKeyPhrases}
          timeLimit={task.time_limit_seconds || 120}
          onSubmit={(analysis) => handleSubmit(analysis)}
          onSkip={handleSkip}
        />
      );
    }

    // RLHF task
    if (task.type === 'rlhf') {
      return (
        <RLHFTask
          responses={task.data.responses}
          comparisonType={task.sub_type || 'better'}
          instructions={task.config?.instructions}
          evaluationCriteria={task.config?.criteria}
          timeLimit={task.time_limit_seconds || 180}
          onSubmit={(evaluation) => handleSubmit(evaluation)}
          onSkip={handleSkip}
        />
      );
    }

    // Default/fallback
    return (
      <Card className="p-4">
        <Typography>Unsupported task type: {task.type}</Typography>
        <Button onClick={handleSkip} className="mt-4">
          Skip Task
        </Button>
      </Card>
    );
  };

  // Earnings animation
  if (showEarning) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <Typography variant="display1" weight="3" className="text-green-500 mb-2">
            +${earnedAmount.toFixed(2)}
          </Typography>
          <Typography color="secondary">
            Task completed!
          </Typography>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <Typography>Loading next task...</Typography>
        </Card>
      </div>
    );
  }

  // No tasks available
  if (!task) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center max-w-sm">
          <Typography weight="3" className="mb-4">
            No tasks available
          </Typography>
          <Typography color="secondary" className="mb-6">
            All tasks have been completed. Check back later for more tasks.
          </Typography>
          <Button onClick={fetchNextTask}>
            Refresh
          </Button>
        </Card>
      </div>
    );
  }

  // Offline indicator
  if (!isOnline) {
    return (
      <div className="flex flex-col h-full">
        <Alert className="m-4">
          <Typography color="secondary">
            You're offline. Responses will be queued and submitted when you're back online.
          </Typography>
        </Alert>
        {renderTask()}
      </div>
    );
  }

  // Error display
  if (error && !task) {
    return (
      <ErrorBoundary
        onError={(err) => console.error('TaskView error:', err)}
        maxRetries={3}
      >
        <div className="flex items-center justify-center h-full">
          <Card className="p-8 text-center max-w-sm">
            <Typography weight="3" className="mb-4 text-red-500">
              Oops!
            </Typography>
            <Typography color="secondary" className="mb-6">
              {error}
            </Typography>
            <div className="flex gap-2 justify-center">
              <Button
                mode="outline"
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  fetchNextTask();
                }}
              >
                Retry
              </Button>
              <Button
                onClick={() => window.location.reload()}
                mode="gray"
              >
                Reload App
              </Button>
            </div>
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  // Render the appropriate task
  return (
    <ErrorBoundary
      onError={(err) => console.error('TaskView error:', err)}
      maxRetries={2}
    >
      {renderTask()}
    </ErrorBoundary>
  );
};