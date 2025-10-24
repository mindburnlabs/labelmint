'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertCircle, MessageSquare } from 'lucide-react';

interface TextClassificationTaskProps {
  task: {
    id: string;
    type: 'TXT_CLS';
    dataUrl: string;
    payload: {
      text: string;
      context?: string;
      instructions?: string;
    };
    classes: string[];
  };
  onAnswer: (answer: any) => void;
  onSkip: () => void;
  expiresAt: string;
}

export default function TextClassificationTask({ task, onAnswer, onSkip, expiresAt }: TextClassificationTaskProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        onSkip();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onSkip]);

  const handleSubmit = () => {
    if (!selectedClass) return;
    onAnswer(selectedClass);
  };

  if (!task.payload) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Task data not available</div>
      </div>
    );
  }

  const { text, context, instructions } = task.payload;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-500 text-white px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Text Classification</span>
        </div>
        <div className="flex items-center gap-2">
          {timeLeft <= 10 && (
            <AlertCircle className="h-4 w-4 animate-pulse" />
          )}
          <span className={`font-mono font-bold ${timeLeft <= 10 ? 'text-red-200' : ''}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Instructions */}
        {instructions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4"
          >
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
              {instructions}
            </p>
          </motion.div>
        )}

        {/* Context (if available) */}
        {context && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4"
          >
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Context
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {context}
            </p>
          </motion.div>
        )}

        {/* Main Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
        >
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Text to classify:
          </h3>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border-l-4 border-green-500">
            <p className="text-gray-900 dark:text-white leading-relaxed">
              {text}
            </p>
          </div>
        </motion.div>

        {/* Classification Options */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">
            Select the best category:
          </h3>

          {task.classes.map((className, index) => (
            <motion.button
              key={className}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              onClick={() => setSelectedClass(className)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedClass === className
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedClass === className
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedClass === className && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {className}
                  </span>
                </div>
                {selectedClass === className && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-500"
                  >
                    <Check className="h-5 w-5" />
                  </motion.div>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <X className="h-4 w-4" />
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedClass}
          className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" />
          Submit
        </button>
      </div>
    </div>
  );
}