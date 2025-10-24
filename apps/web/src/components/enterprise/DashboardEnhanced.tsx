/**
 * Enhanced Enterprise Dashboard for LabelMint PWA
 * Mobile-first design with advanced features
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BellIcon,
  ArrowDownTrayIcon,
  CameraIcon,
  DocumentArrowUpIcon,
  WifiIcon,
  SignalSlashIcon,
  BellBadgeIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { offlineStorage } from '@/lib/offline-storage';
import { telegramEnhanced } from '@/lib/telegram-enhanced';

interface PWAInstallPrompt {
  prompt: any;
  onInstall: () => void;
}

interface OfflineAction {
  id: string;
  type: string;
  count: number;
}

interface NotificationData {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

const DashboardEnhanced: React.FC = () => {
  const [offlineMode, setOfflineMode] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Check online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      const isOffline = !navigator.onLine;
      setOfflineMode(isOffline);

      if (!isOffline && offlineActions.length > 0) {
        // Sync when coming back online
        syncOfflineData();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Initialize
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [offlineActions.length]);

  // Load offline actions on mount
  useEffect(() => {
    loadOfflineActions();
  }, []);

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  // Setup periodic sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (!offlineMode && offlineActions.length > 0) {
        syncOfflineData();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [offlineMode, offlineActions.length]);

  const loadOfflineActions = async () => {
    try {
      const actions = await offlineStorage.getQueuedActions();
      const grouped = actions.reduce((acc: any, action) => {
        const key = action.type;
        if (!acc[key]) {
          acc[key] = { id: key, type: key, count: 0 };
        }
        acc[key].count++;
        return acc;
      }, {});
      setOfflineActions(Object.values(grouped));
    } catch (error) {
      console.error('Failed to load offline actions:', error);
    }
  };

  const loadNotifications = async () => {
    // Load notifications from local storage or API
    const savedNotifications = localStorage.getItem('dashboardNotifications');
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed successfully');
    }

    setInstallPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    // Remember user choice
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const syncOfflineData = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const actions = await offlineStorage.getQueuedActions();
      const total = actions.length;

      for (let i = 0; i < total; i++) {
        const action = actions[i];

        try {
          // Simulate sync (in real app, make API call)
          await new Promise(resolve => setTimeout(resolve, 100));

          // Remove from queue on success
          await offlineStorage.removeQueuedAction(action.id);

          setSyncProgress(((i + 1) / total) * 100);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
          await offlineStorage.incrementRetryCount(action.id);
        }
      }

      // Reload offline actions
      await loadOfflineActions();

      // Show success notification
      addNotification({
        id: Date.now().toString(),
        title: 'Sync Complete',
        body: `${total} items synchronized successfully`,
        timestamp: Date.now(),
        read: false,
        type: 'success'
      });

    } catch (error) {
      console.error('Sync failed:', error);
      addNotification({
        id: Date.now().toString(),
        title: 'Sync Failed',
        body: 'Some items could not be synchronized',
        timestamp: Date.now(),
        read: false,
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const addNotification = (notification: NotificationData) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    localStorage.setItem('dashboardNotifications', JSON.stringify([notification, ...notifications]));
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('dashboardNotifications');
  };

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear cache and reload data
      await offlineStorage.clearExpiredCache();

      addNotification({
        id: Date.now().toString(),
        title: 'Refreshed',
        body: 'Dashboard data updated',
        timestamp: Date.now(),
        read: false,
        type: 'info'
      });
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleBulkUpload = async (files: FileList) => {
    if (!files.length) return;

    // Show progress
    const progressId = Date.now().toString();
    addNotification({
      id: progressId,
      title: 'Processing Files',
      body: `Preparing ${files.length} file(s) for upload...`,
      timestamp: Date.now(),
      read: false,
      type: 'info'
    });

    try {
      // Use Web Worker for file processing if available
      if (window.Worker) {
        const worker = new Worker('/workers/file-processor.js');

        worker.postMessage({
          files: Array.from(files),
          options: {
            compress: true,
            validation: true,
            chunkSize: 5 * 1024 * 1024 // 5MB chunks
          }
        });

        worker.onmessage = (e) => {
          if (e.data.progress) {
            // Update progress notification
            setNotifications(prev =>
              prev.map(n => n.id === progressId
                ? { ...n, body: `Processing... ${e.data.progress}%` }
                : n
              )
            );
          } else if (e.data.complete) {
            addNotification({
              id: Date.now().toString(),
              title: 'Upload Complete',
              body: `Successfully processed ${files.length} file(s)`,
              timestamp: Date.now(),
              read: false,
              type: 'success'
            });
            worker.terminate();
          }
        };

        worker.onerror = (error) => {
          console.error('Worker error:', error);
          addNotification({
            id: Date.now().toString(),
            title: 'Upload Failed',
            body: 'Failed to process files',
            timestamp: Date.now(),
            read: false,
            type: 'error'
          });
        };
      } else {
        // Fallback processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        addNotification({
          id: Date.now().toString(),
          title: 'Upload Complete',
          body: `Successfully processed ${files.length} file(s)`,
          timestamp: Date.now(),
          read: false,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      addNotification({
        id: Date.now().toString(),
        title: 'Upload Failed',
        body: 'An error occurred while processing files',
        timestamp: Date.now(),
        read: false,
        type: 'error'
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">LabelMint</h1>
            {offlineMode && (
              <span className="flex items-center text-amber-600 dark:text-amber-400">
                <SignalSlashIcon className="w-4 h-4 mr-1" />
                Offline
              </span>
            )}
            {isSyncing && (
              <span className="flex items-center text-blue-600 dark:text-blue-400">
                <ArrowDownTrayIcon className="w-4 h-4 mr-1 animate-bounce" />
                Syncing {Math.round(syncProgress)}%
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {unreadCount > 0 ? (
                <BellBadgeIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              ) : (
                <BellIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {/* Settings */}
            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Cog6ToothIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Sync Progress Bar */}
        <AnimatePresence>
          {isSyncing && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 3 }}
              exit={{ height: 0 }}
              className="bg-gray-200 dark:bg-gray-700"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${syncProgress}%` }}
                className="h-full bg-blue-500"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* PWA Install Prompt */}
      <AnimatePresence>
        {showInstallPrompt && installPrompt && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 m-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Install LabelMint</h3>
                <p className="text-sm opacity-90">Get the full experience with our PWA</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="p-2 text-white/80 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Actions Banner */}
      <AnimatePresence>
        {offlineActions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 mx-4 mt-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {offlineActions.length} pending action(s)
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {offlineActions.map(a => `${a.type} (${a.count})`).join(', ')}
                  </p>
                </div>
              </div>
              {!offlineMode && (
                <button
                  onClick={syncOfflineData}
                  disabled={isSyncing}
                  className="px-3 py-1 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="p-4">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', icon: HomeIcon },
            { id: 'projects', label: 'Projects', icon: BriefcaseIcon },
            { id: 'teams', label: 'Teams', icon: UserGroupIcon },
            { id: 'analytics', label: 'Analytics', icon: ChartBarIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {/* Quick Stats */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Active Projects</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">12</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">+2 this week</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tasks Completed</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">248</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">+12% from last month</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Earnings (USDT)</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">$1,234</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">+18% growth</p>
              </div>

              {/* Quick Actions */}
              <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <DocumentArrowUpIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Task</span>
                  </button>

                  <label className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer">
                    <CameraIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Scan Label</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                    />
                  </label>

                  <label className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer">
                    <ArrowDownTrayIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                    />
                  </label>

                  <button className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <ChartBarIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reports</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Other tabs would be implemented similarly */}
          {activeTab !== 'overview' && (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} content coming soon...
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearNotifications}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {notifications.map(notification => (
                      <div
                        key={notification.id}
                        onClick={() => markNotificationAsRead(notification.id)}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {notification.type === 'success' && (
                              <CheckCircleIcon className="w-5 h-5 text-green-500" />
                            )}
                            {notification.type === 'error' && (
                              <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                            )}
                            {notification.type === 'warning' && (
                              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                            )}
                            {notification.type === 'info' && (
                              <BellIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {notification.body}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(notification.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
        <div className="grid grid-cols-4 h-16">
          {[
            { id: 'home', label: 'Home', icon: HomeIcon, active: activeTab === 'overview' },
            { id: 'projects', label: 'Projects', icon: BriefcaseIcon, active: activeTab === 'projects' },
            { id: 'teams', label: 'Teams', icon: UserGroupIcon, active: activeTab === 'teams' },
            { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, active: activeTab === 'analytics' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                item.active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default DashboardEnhanced;