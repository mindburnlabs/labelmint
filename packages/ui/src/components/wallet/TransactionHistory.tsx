import React, { useEffect } from 'react';
import { useTonWallet } from '../../hooks/useTonWallet';
import { TonTransaction } from '../../services/tonWalletService';
import { Card } from '../Card';
import { cn } from '../../lib/utils';

export interface TransactionHistoryProps {
  className?: string;
  limit?: number;
  showRefresh?: boolean;
}

export function TransactionHistory({
  className,
  limit = 10,
  showRefresh = true,
}: TransactionHistoryProps) {
  const {
    transactions,
    isConnected,
    refreshTransactions,
    formatAmount,
    shortenAddress,
  } = useTonWallet();

  useEffect(() => {
    if (isConnected) {
      refreshTransactions(limit);
    }
  }, [isConnected, limit]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) return 'Just now';

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than 24 hours
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: TonTransaction['status']): string => {
    switch (status) {
      case 'confirmed':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: TonTransaction['status']): string => {
    switch (status) {
      case 'confirmed':
        return '✓';
      case 'pending':
        return '⏳';
      case 'failed':
        return '✗';
      default:
        return '?';
    }
  };

  if (!isConnected) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-gray-500">
          Connect your wallet to view transaction history
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transaction History</h3>
        {showRefresh && (
          <button
            onClick={() => refreshTransactions(limit)}
            className="text-blue-500 hover:text-blue-600 transition-colors"
            aria-label="Refresh transactions"
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

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No transactions yet
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.hash}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Transaction Info */}
              <div className="flex items-center gap-3 flex-1">
                <span className={cn('text-2xl', getStatusColor(tx.status))}>
                  {getStatusIcon(tx.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      To:
                    </span>
                    <span className="font-mono text-sm truncate">
                      {shortenAddress(tx.to)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatDate(tx.timestamp)}
                    </span>
                    {tx.fee && (
                      <span className="text-xs text-gray-500">
                        • Fee: {tx.fee} TON
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right">
                <div className="font-semibold">
                  {formatAmount(tx.amount)} TON
                </div>
                <a
                  href={`https://tonscan.org/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  View on explorer →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default TransactionHistory;

