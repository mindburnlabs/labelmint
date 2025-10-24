/**
 * PWA Hook for LabelMint
 * Handles PWA features: installation, notifications, offline status
 */

import { useState, useEffect, useCallback } from 'react';
import { notificationManager } from '@/lib/notifications';
import { offlineStorage } from '@/lib/offline-storage';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  installPrompt: any;
  notificationPermission: NotificationPermission;
  offlineActionsCount: number;
  supportedFeatures: {
    serviceWorker: boolean;
    pushNotifications: boolean;
    appBadging: boolean;
    backgroundSync: boolean;
  };
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isOnline: navigator.onLine,
    installPrompt: null,
    notificationPermission: 'default',
    offlineActionsCount: 0,
    supportedFeatures: {
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window && 'Notification' in window,
      appBadging: 'setAppBadge' in navigator,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
    }
  });

  // Check if app is installed
  const checkIfInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInWebAppChrome = window.matchMedia('(display-mode: minimal-ui)').matches;

    setState(prev => ({
      ...prev,
      isInstalled: isStandalone || isInWebAppiOS || isInWebAppChrome
    }));
  }, []);

  // Load install prompt
  const loadInstallPrompt = useCallback(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setState(prev => ({ ...prev, installPrompt: e }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Update online status
  const updateOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    setState(prev => ({ ...prev, isOnline }));

    if (isOnline) {
      // Sync when coming back online
      syncOfflineActions();
    }
  }, []);

  // Load notification permission
  const loadNotificationPermission = useCallback(() => {
    setState(prev => ({
      ...prev,
      notificationPermission: Notification.permission
    }));
  }, []);

  // Count offline actions
  const countOfflineActions = useCallback(async () => {
    try {
      const actions = await offlineStorage.getQueuedActions();
      setState(prev => ({ ...prev, offlineActionsCount: actions.length }));
    } catch (error) {
      console.error('Failed to count offline actions:', error);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    const granted = await notificationManager.requestPermission();
    setState(prev => ({ ...prev, notificationPermission: granted ? 'granted' : 'denied' }));
    return granted;
  }, []);

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!state.installPrompt) return false;

    try {
      state.installPrompt.prompt();
      const { outcome } = await state.installPrompt.userChoice;

      setState(prev => ({ ...prev, installPrompt: null }));

      if (outcome === 'accepted') {
        checkIfInstalled();
        return true;
      }

      return false;
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    }
  }, [state.installPrompt, checkIfInstalled]);

  // Show notification
  const showNotification = useCallback(async (title: string, options: any) => {
    if (state.notificationPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }

    await notificationManager.showNotification({
      title,
      ...options
    });

    return true;
  }, [state.notificationPermission, requestNotificationPermission]);

  // Update app badge
  const updateBadge = useCallback(async (count: number) => {
    if (!state.supportedFeatures.appBadging) return;

    try {
      await notificationManager.updateBadge(count);
    } catch (error) {
      console.error('Failed to update badge:', error);
    }
  }, [state.supportedFeatures.appBadging]);

  // Clear badge
  const clearBadge = useCallback(async () => {
    if (!state.supportedFeatures.appBadging) return;

    try {
      await notificationManager.clearBadge();
    } catch (error) {
      console.error('Failed to clear badge:', error);
    }
  }, [state.supportedFeatures.appBadging]);

  // Sync offline actions
  const syncOfflineActions = useCallback(async () => {
    if (!state.isOnline) return;

    try {
      const actions = await offlineStorage.getQueuedActions();

      if (actions.length > 0) {
        // Notify service worker to sync
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-tasks');
        }

        countOfflineActions();
      }
    } catch (error) {
      console.error('Failed to sync offline actions:', error);
    }
  }, [state.isOnline, countOfflineActions]);

  // Initialize PWA
  const init = useCallback(async () => {
    // Initialize notification manager
    await notificationManager.init();

    // Initialize offline storage
    await offlineStorage.init();

    // Check initial states
    checkIfInstalled();
    loadNotificationPermission();
    countOfflineActions();
  }, [checkIfInstalled, loadNotificationPermission, countOfflineActions]);

  // Setup event listeners
  useEffect(() => {
    init();

    const cleanupInstallPrompt = loadInstallPrompt();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for notification permission changes
    navigator.permissions.query({ name: 'notifications' }).then(permissionStatus => {
      permissionStatus.onchange = loadNotificationPermission;
    });

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'offlineQueue') {
        countOfflineActions();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkIfInstalled);

    return () => {
      cleanupInstallPrompt();
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', checkIfInstalled);
    };
  }, [init, loadInstallPrompt, updateOnlineStatus, loadNotificationPermission, countOfflineActions, checkIfInstalled]);

  // Periodically check offline actions
  useEffect(() => {
    const interval = setInterval(countOfflineActions, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [countOfflineActions]);

  return {
    ...state,
    requestNotificationPermission,
    installPWA,
    showNotification,
    updateBadge,
    clearBadge,
    syncOfflineActions,
    refreshOfflineActions: countOfflineActions
  };
}

export default usePWA;