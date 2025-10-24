/**
 * PWA Install Prompt Component for LabelMint
 * Handles the installation flow for Progressive Web App
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DevicePhoneMobileIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface PWAInstallPromptProps {
  prompt: any;
  onInstall: () => void;
  onDismiss: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  prompt,
  onInstall,
  onDismiss
}) => {
  const [installState, setInstallState] = useState<'prompt' | 'installing' | 'success' | 'error'>('prompt');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstallState('success');
    }
  }, []);

  const handleInstall = async () => {
    if (!prompt) {
      // Show manual installation instructions
      setShowInstructions(true);
      return;
    }

    setInstallState('installing');

    try {
      // Show the install prompt
      await prompt.prompt();

      // Wait for user's response
      const { outcome } = await prompt.userChoice;

      if (outcome === 'accepted') {
        setInstallState('success');
        onInstall();

        // Track installation event
        if (window.gtag) {
          window.gtag('event', 'pwa_install', {
            event_category: 'PWA',
            event_label: 'Install accepted'
          });
        }
      } else {
        setInstallState('prompt');
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
      setInstallState('error');
    }
  };

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome')) {
      return {
        name: 'Chrome',
        steps: [
          'Click the three dots menu in the top right',
          'Select "Install LabelMint"',
          'Click "Install" in the dialog'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        name: 'Firefox',
        steps: [
          'Open the menu (three lines) in the top right',
          'Select "Install Page as App"',
          'Confirm the installation'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        name: 'Safari',
        steps: [
          'Tap the Share button at the bottom',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to confirm'
        ]
      };
    } else if (userAgent.includes('edge')) {
      return {
        name: 'Edge',
        steps: [
          'Click the three dots menu in the top right',
          'Select "Apps" > "Install this site as an app"',
          'Click "Install"'
        ]
      };
    }

    return {
      name: 'Your Browser',
      steps: [
        'Look for "Install" or "Add to Home Screen" in the menu',
        'Follow the prompts to complete installation'
      ]
    };
  };

  if (installState === 'success') {
    return (
      <div className="fixed top-4 right-4 max-w-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-start">
          <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
              Successfully Installed!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              LabelMint has been added to your device. You can now launch it from your home screen.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-3 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (installState === 'error') {
    return (
      <div className="fixed top-4 right-4 max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
              Installation Failed
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Couldn't install LabelMint. Please try again or follow the manual instructions.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-3 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (showInstructions) {
    const instructions = getBrowserInstructions();

    return (
      <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Install {instructions.name}
            </h3>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {instructions.steps.map((step, index) => (
              <div key={index} className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowInstructions(false)}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-xl p-4 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <DevicePhoneMobileIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold">Install LabelMint</h3>
            <p className="text-sm opacity-90">
              Get the full experience with our app
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstall}
            disabled={installState === 'installing'}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {installState === 'installing' ? (
              <>
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Installing...</span>
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Install</span>
              </>
            )}
          </button>

          <button
            onClick={onDismiss}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Benefits List */}
      <div className="mt-3 space-y-1 text-sm opacity-90">
        <div className="flex items-center">
          <CheckCircleIcon className="w-4 h-4 mr-2" />
          Works offline
        </div>
        <div className="flex items-center">
          <CheckCircleIcon className="w-4 h-4 mr-2" />
          Faster loading
        </div>
        <div className="flex items-center">
          <CheckCircleIcon className="w-4 h-4 mr-2" />
          Push notifications
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;