import React from 'react';
import { useTonWallet } from '../../hooks/useTonWallet';
import { Card } from '../Card';
import { cn } from '../../lib/utils';

export interface BalanceDisplayProps {
  className?: string;
  showRefresh?: boolean;
  showUsdValue?: boolean;
  tonPriceUsd?: number;
}

export function BalanceDisplay({
  className,
  showRefresh = true,
  showUsdValue = true,
  tonPriceUsd = 2.5, // Default TON price, should be fetched from API
}: BalanceDisplayProps) {
  const {
    isConnected,
    balance,
    connection,
    refreshBalance,
    formatAmount,
    shortenAddress,
  } = useTonWallet();

  const calculateUsdValue = (): string => {
    if (!balance) return '0.00';
    const tonAmount = parseFloat(balance);
    return (tonAmount * tonPriceUsd).toFixed(2);
  };

  if (!isConnected || !connection) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-gray-500">
          Connect your wallet to view balance
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Wallet Balance
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
            {shortenAddress(connection.address, 8)}
          </p>
        </div>
        {showRefresh && (
          <button
            onClick={refreshBalance}
            className="text-blue-500 hover:text-blue-600 transition-colors"
            aria-label="Refresh balance"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Balance */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">
            {balance ? formatAmount(balance, 4) : '0.00'}
          </span>
          <span className="text-xl text-gray-600 dark:text-gray-400">
            TON
          </span>
        </div>

        {showUsdValue && balance && (
          <div className="text-lg text-gray-600 dark:text-gray-400">
            ≈ ${calculateUsdValue()} USD
          </div>
        )}
      </div>

      {/* Wallet Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Wallet Type</span>
          <span className="font-medium capitalize">
            {connection.walletVersion}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default BalanceDisplay;

