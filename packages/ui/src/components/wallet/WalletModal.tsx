import React, { useState } from 'react';
import { TonWalletProvider } from '../../services/tonWalletService';
import { Button } from '../Button';
import { Card } from '../Card';
import { cn } from '../../lib/utils';

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider: (provider: TonWalletProvider) => void;
  title?: string;
  description?: string;
}

interface WalletProviderOption {
  id: TonWalletProvider;
  name: string;
  icon: string;
  description: string;
  downloadUrl?: string;
}

const walletProviders: WalletProviderOption[] = [
  {
    id: 'tonkeeper',
    name: 'Tonkeeper',
    icon: '🔷',
    description: 'Most popular TON wallet',
    downloadUrl: 'https://tonkeeper.com',
  },
  {
    id: 'tonhub',
    name: 'Tonhub',
    icon: '🔶',
    description: 'Advanced wallet for power users',
    downloadUrl: 'https://tonhub.com',
  },
  {
    id: 'openmask',
    name: 'OpenMask',
    icon: '🎭',
    description: 'Browser extension wallet',
    downloadUrl: 'https://openmask.app',
  },
  {
    id: 'mytonwallet',
    name: 'MyTonWallet',
    icon: '💼',
    description: 'Simple and secure',
    downloadUrl: 'https://mytonwallet.com',
  },
];

export function WalletModal({
  isOpen,
  onClose,
  onSelectProvider,
  title = 'Connect Wallet',
  description = 'Choose a wallet to connect',
}: WalletModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<TonWalletProvider | null>(null);

  if (!isOpen) return null;

  const handleSelect = (provider: TonWalletProvider) => {
    setSelectedProvider(provider);
    onSelectProvider(provider);
    setTimeout(() => {
      onClose();
      setSelectedProvider(null);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Card className="p-6 bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Wallet Options */}
          <div className="space-y-3">
            {walletProviders.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleSelect(wallet.id)}
                disabled={selectedProvider === wallet.id}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all',
                  'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  selectedProvider === wallet.id &&
                    'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                )}
              >
                <span className="text-4xl">{wallet.icon}</span>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-lg">{wallet.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {wallet.description}
                  </p>
                </div>
                {selectedProvider === wallet.id && (
                  <svg
                    className="w-6 h-6 text-blue-500 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Don't have a wallet?</p>
            <a
              href="https://ton.org/wallets"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Learn how to get one →
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default WalletModal;

