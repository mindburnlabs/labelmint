/**
 * Offline Page for LabelMint PWA
 * Shown when user is offline or network is unavailable
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  SignalSlashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CloudArrowDownIcon,
  WifiIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { offlineStorage } from '@/lib/offline-storage';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Check initial status
    updateOnlineStatus();

    // Listen for changes
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Load offline action count
    loadOfflineCount();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const loadOfflineCount = async () => {
    try {
      const actions = await offlineStorage.getQueuedActions();
      setOfflineCount(actions.length);
    } catch (error) {
      console.error('Failed to load offline count:', error);
    }
  };

  const handleSyncNow = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    setSyncProgress(0);

    try {
      const actions = await offlineStorage.getQueuedActions();
      const total = actions.length;

      for (let i = 0; i < total; i++) {
        const action = actions[i];

        try {
          // Simulate sync
          await new Promise(resolve => setTimeout(resolve, 100));

          await offlineStorage.removeQueuedAction(action.id);

          setSyncProgress(((i + 1) / total) * 100);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
        }
      }

      await loadOfflineCount();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Offline Icon */}
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${isOnline ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {isOnline ? (
              <WifiIcon className="w-16 h-16 text-green-600 dark:text-green-400" />
            ) : (
              <SignalSlashIcon className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            )}
          </div>
        </div>

        {/* Title and Description */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isOnline ? 'Reconnected' : 'You\'re Offline'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isOnline
              ? 'Your connection has been restored. You can sync your offline changes now.'
              : 'No internet connection detected. Your work will be saved and synced when you\'re back online.'}
          </p>
        </div>

        {/* Offline Actions Counter */}
        {offlineCount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CloudArrowDownIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {offlineCount} pending action(s)
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  These will be synced when you're online
                </p>
              </div>
            </div>

            {/* Sync Progress */}
            {syncing && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 mb-1">
                  <span>Syncing...</span>
                  <span>{Math.round(syncProgress)}%</span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {isOnline ? (
            <>
              {offlineCount > 0 && (
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {syncing ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <CloudArrowDownIcon className="w-5 h-5 mr-2" />
                      Sync Now
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleRefresh}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Refresh Page
              </button>
            </>
          ) : (
            <button
              onClick={handleRefresh}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Try Again
            </button>
          )}
        </div>

        {/* Offline Features Notice */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Available Offline Features:
          </h2>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <DocumentTextIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              Continue working on active tasks
            </li>
            <li className="flex items-start">
              <DocumentTextIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              Access downloaded projects
            </li>
            <li className="flex items-start">
              <DocumentTextIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              Review saved submissions
            </li>
            <li className="flex items-start">
              <DocumentTextIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              View cached analytics
            </li>
          </ul>
        </div>

        {/* Network Status Warning */}
        {!isOnline && (
          <div className="mt-4 flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Waiting for network connection...
          </div>
        )}
      </div>
    </div>
  );
}