import React from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';

export interface BalanceCardProps {
  balance: {
    ton: string;
    usdt: string;
    jettons?: Record<string, string>;
  };
  onRefresh?: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  isLoading?: boolean;
  className?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  onRefresh,
  onSend,
  onReceive,
  isLoading = false,
  className = ''
}) => {
  const formatAmount = (amount: string, decimals: number = 2) => {
    const num = parseFloat(amount);
    return num.toFixed(decimals);
  };

  const getTotalValue = () => {
    const tonValue = parseFloat(balance.ton) * 2.5; // Assuming 1 TON = $2.5
    const usdtValue = parseFloat(balance.usdt);
    return (tonValue + usdtValue).toFixed(2);
  };

  return (
    <Card className={`balance-card bg-gradient-to-br from-blue-500 to-purple-600 text-white ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold">Wallet Balance</h2>
            <p className="text-sm opacity-90">Total Value: ${getTotalValue()}</p>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="bg-white/20 border-white text-white hover:bg-white/30"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
        </div>

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">TON</span>
              <Badge variant="secondary" className="bg-white/20 text-white">
                Native
              </Badge>
            </div>
            <div className="text-2xl font-bold">
              {formatAmount(balance.ton, 4)} TON
            </div>
            <div className="text-sm opacity-75">
              ≈ ${(parseFloat(balance.ton) * 2.5).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">USDT</span>
              <Badge variant="secondary" className="bg-white/20 text-white">
                Stable
              </Badge>
            </div>
            <div className="text-2xl font-bold">
              {formatAmount(balance.usdt, 2)} USDT
            </div>
            <div className="text-sm opacity-75">
              ≈ ${formatAmount(balance.usdt, 2)}
            </div>
          </div>
        </div>

        {/* Jetton Balances */}
        {balance.jettons && Object.keys(balance.jettons).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 opacity-90">Jetton Tokens</h3>
            <div className="space-y-2">
              {Object.entries(balance.jettons).map(([symbol, amount]) => (
                <div key={symbol} className="flex justify-between items-center bg-white/5 rounded p-2">
                  <span className="text-sm">{symbol}</span>
                  <span className="font-medium">{formatAmount(amount, 2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {onSend && (
            <Button
              onClick={onSend}
              className="flex-1 bg-white text-blue-600 hover:bg-white/90"
            >
              Send
            </Button>
          )}
          {onReceive && (
            <Button
              onClick={onReceive}
              variant="outline"
              className="flex-1 bg-white/20 border-white text-white hover:bg-white/30"
            >
              Receive
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 pt-4 border-t border-white/20">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs opacity-75">24h Change</div>
              <div className="text-sm font-medium text-green-300">+2.5%</div>
            </div>
            <div>
              <div className="text-xs opacity-75">Total Txs</div>
              <div className="text-sm font-medium">127</div>
            </div>
            <div>
              <div className="text-xs opacity-75">Last Activity</div>
              <div className="text-sm font-medium">2h ago</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
