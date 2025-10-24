import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';

export interface PaymentTransaction {
  id: string;
  type: 'sent' | 'received' | 'withdrawal' | 'deposit';
  amount: string;
  currency: 'TON' | 'USDT';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  hash?: string;
  from?: string;
  to?: string;
  message?: string;
  fee?: string;
}

export interface PaymentHistoryProps {
  transactions: PaymentTransaction[];
  onLoadMore?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  className?: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  transactions,
  onLoadMore,
  onRefresh,
  isLoading = false,
  hasMore = false,
  className = ''
}) => {
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const filteredTransactions = transactions
    .filter(tx => filter === 'all' || tx.type === filter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return b.timestamp.getTime() - a.timestamp.getTime();
      }
      return parseFloat(b.amount) - parseFloat(a.amount);
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sent':
        return '↗️';
      case 'received':
        return '↙️';
      case 'withdrawal':
        return '💸';
      case 'deposit':
        return '💰';
      default:
        return '💳';
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You might want to show a toast notification here
  };

  return (
    <Card className={`payment-history ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Payment History</h3>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'sent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('sent')}
        >
          Sent
        </Button>
        <Button
          variant={filter === 'received' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('received')}
        >
          Received
        </Button>
      </div>

      {/* Sort Options */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={sortBy === 'date' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('date')}
        >
          Sort by Date
        </Button>
        <Button
          variant={sortBy === 'amount' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('amount')}
        >
          Sort by Amount
        </Button>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {getTypeIcon(tx.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {tx.type === 'sent' ? '-' : '+'}{tx.amount} {tx.currency}
                    </span>
                    <Badge variant={getStatusColor(tx.status)}>
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {tx.timestamp.toLocaleDateString()} at {tx.timestamp.toLocaleTimeString()}
                  </div>
                  {tx.message && (
                    <div className="text-sm text-muted-foreground mt-1">
                      "{tx.message}"
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                {tx.hash && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(tx.hash!)}
                    className="text-xs"
                  >
                    Copy Hash
                  </Button>
                )}
                {tx.fee && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Fee: {tx.fee} {tx.currency}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="text-center mt-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            loading={isLoading}
          >
            Load More
          </Button>
        </div>
      )}
    </Card>
  );
};