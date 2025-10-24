import React, { useState, useEffect } from 'react';
import { BalanceCard } from './BalanceCard';
import { PaymentForm } from './PaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { QRCodeModal } from './QRCodeModal';
import { Button } from '../Button';
import { Card } from '../Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Tabs';

export interface PaymentDashboardProps {
  walletAddress: string;
  balance: {
    ton: string;
    usdt: string;
    jettons?: Record<string, string>;
  };
  transactions: Array<{
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
  }>;
  onSendPayment: (data: {
    amount: string;
    currency: 'TON' | 'USDT';
    recipientAddress: string;
    message?: string;
    priority: 'low' | 'medium' | 'high';
  }) => Promise<{ success: boolean; error?: string }>;
  onRefreshBalance: () => Promise<void>;
  onRefreshTransactions: () => Promise<void>;
  onLoadMoreTransactions?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({
  walletAddress,
  balance,
  transactions,
  onSendPayment,
  onRefreshBalance,
  onRefreshTransactions,
  onLoadMoreTransactions,
  isLoading = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMessage, setReceiveMessage] = useState('');

  const handleSendPayment = async (data: any) => {
    const result = await onSendPayment(data);
    if (result.success) {
      setShowSendModal(false);
      await onRefreshBalance();
      await onRefreshTransactions();
    }
    return result;
  };

  const handleRefresh = async () => {
    await Promise.all([
      onRefreshBalance(),
      onRefreshTransactions()
    ]);
  };

  return (
    <div className={`payment-dashboard ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <BalanceCard
            balance={balance}
            onRefresh={onRefreshBalance}
            onSend={() => setActiveTab('send')}
            onReceive={() => setShowReceiveModal(true)}
            isLoading={isLoading}
          />

          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => setActiveTab('send')}
                className="h-20 flex flex-col items-center justify-center"
              >
                <div className="text-2xl mb-2">↗️</div>
                <div>Send Payment</div>
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReceiveModal(true)}
                className="h-20 flex flex-col items-center justify-center"
              >
                <div className="text-2xl mb-2">↙️</div>
                <div>Receive Payment</div>
              </Button>
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('history')}
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {transactions.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl">
                      {tx.type === 'sent' ? '↗️' : '↙️'}
                    </div>
                    <div>
                      <div className="font-medium">
                        {tx.type === 'sent' ? '-' : '+'}{tx.amount} {tx.currency}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {tx.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm ${
                      tx.status === 'confirmed' ? 'text-green-600' :
                      tx.status === 'pending' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions yet
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send">
          <PaymentForm
            onSubmit={handleSendPayment}
            onCancel={() => setActiveTab('overview')}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <PaymentHistory
            transactions={transactions}
            onRefresh={onRefreshTransactions}
            onLoadMore={onLoadMoreTransactions}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Receive Modal */}
      <QRCodeModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        address={walletAddress}
        amount={receiveAmount}
        message={receiveMessage}
        onAmountChange={setReceiveAmount}
        onMessageChange={setReceiveMessage}
      />
    </div>
  );
};
