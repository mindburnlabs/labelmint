'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/api/taskApi';
import { useTelegramAuth } from '@/hooks/useTelegramAuth';
import { CheckCircle, X, SkipForward, Loader2, Clock, Zap } from 'lucide-react';

interface ImageClassificationTaskProps {
  task: Task;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  timeLeft: number;
}

export function ImageClassificationTask({ task, onSubmit, onSkip, timeLeft }: ImageClassificationTaskProps) {
  const { hapticFeedback } = useTelegramAuth();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    // Load image
    setImageUrl(task.dataUrl);
  }, [task.dataUrl]);

  const handleSubmit = () => {
    if (!selectedAnswer) return;

    hapticFeedback('impact');
    onSubmit(selectedAnswer);
  };

  const handleSkip = () => {
    hapticFeedback('selection');
    onSkip();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center space-x-2">
          <AnimatePresence mode="wait">
            {timeLeft < 10 ? (
              <motion.div
                key="urgent"
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                exit={{ scale: 0 }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="flex items-center space-x-1"
              >
                <Clock className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-500">
                  {timeLeft}s
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center space-x-1"
              >
                <Zap className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium dark:text-white">
                  {timeLeft}s left
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSkip}
          className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
          <span className="text-sm">Skip</span>
        </motion.button>
      </div>

      {/* Task Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Image */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <img
            src={imageUrl}
            alt="Classification task"
            className="w-full max-h-64 object-contain"
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Task:</strong> Select the correct label for this image
          </p>
          {task.gold && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              This is a quality check task
            </p>
          )}
        </div>

        {/* Options */}
        <div className="mt-6 space-y-3">
          {task.classes.map((className, index) => (
            <motion.button
              key={className}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedAnswer(className);
                hapticFeedback('selection');
              }}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                selectedAnswer === className
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <AnimatePresence>
                {selectedAnswer === className && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute inset-0 bg-primary/5"
                  />
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between relative">
                <span className="font-medium dark:text-white">{className}</span>
                <AnimatePresence>
                  {selectedAnswer === className && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-4 bg-white dark:bg-gray-800 shadow-sm">
        <motion.button
          whileTap={{ scale: selectedAnswer ? 0.98 : 1 }}
          onClick={handleSubmit}
          disabled={!selectedAnswer}
          className={`w-full py-3 rounded-lg font-medium transition-all relative overflow-hidden ${
            selectedAnswer
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          <AnimatePresence mode="wait">
            {selectedAnswer ? (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Submit Answer
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center"
              >
                Select an option to continue
              </motion.div>
            )}
          </AnimatePresence>
          {selectedAnswer && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}