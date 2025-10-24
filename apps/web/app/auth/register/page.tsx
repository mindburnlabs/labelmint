'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<'client' | 'worker'>('client');

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const user = await authClient.getCurrentUser();
        if (user) {
          router.push('/dashboard');
        }
      } catch (error) {
        // Not authenticated, stay on register page
      }
    };
    checkAuth();
  }, [router]);

  const handleTelegramAuth = async (telegramUser: any) => {
    setIsLoading(true);
    try {
      await authClient.registerWithTelegram(telegramUser, userType);
      toast.success(`Welcome to LabelMint! You're registered as a ${userType}`);
      router.push(userType === 'client' ? '/dashboard' : '/worker/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="flex justify-center">
            <span className="text-3xl font-bold text-primary">LabelMint</span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Join thousands of users labeling data
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* User Type Selection */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              I want to:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUserType('client')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  userType === 'client'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold">📊 Client</div>
                <div className="text-xs mt-1">Get data labeled</div>
              </button>
              <button
                onClick={() => setUserType('worker')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  userType === 'worker'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold">💰 Worker</div>
                <div className="text-xs mt-1">Earn money</div>
              </button>
            </div>
          </div>

          {/* Telegram Auth */}
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500">
                  Sign up with
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <TelegramLoginButton
                botName={userType === 'client' ? 'LabelMintBot' : 'LabelMintWorkerBot'}
                buttonSize="large"
                cornerRadius={8}
                onAuth={handleTelegramAuth}
                usePic={false}
                lang="en"
              />
            </div>

            {isLoading && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              {userType === 'client' ? 'Client Benefits:' : 'Worker Benefits:'}
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
              {userType === 'client' ? (
                <>
                  <li>• High-quality labels within hours</li>
                  <li>• Flexible pricing options</li>
                  <li>• Real-time progress tracking</li>
                  <li>• Multiple annotation types</li>
                </>
              ) : (
                <>
                  <li>• Earn $2-5/hr from anywhere</li>
                  <li>• Instant TON/USDT withdrawals</li>
                  <li>• No minimum payout limits</li>
                  <li>• Work on your own schedule</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}