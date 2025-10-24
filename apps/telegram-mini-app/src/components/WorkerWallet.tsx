import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Modal, Chip } from '@telegram-apps/telegram-ui';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { useTWA } from '@twa-dev/sdk/react';
import { Address, beginCell, toNano } from '@ton/ton';
import { SendTransactionRequest } from '@tonconnect/ui-react';
import { telegramService } from '../services/telegramService';

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'deposit';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  description: string;
  txHash?: string;
}

interface WorkerWalletProps {
  workerId: number;
  onBalanceUpdate?: (balance: number) => void;
}

export const WorkerWallet: React.FC<WorkerWalletProps> = ({
  workerId,
  onBalanceUpdate
}) => {
  const wallet = useTonWallet();
  const WebApp = useTWA();

  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [labelsCount, setLabelsCount] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [telegramWallet, setTelegramWallet] = useState<string | null>(null);

  // Fetch wallet data
  useEffect(() => {
    fetchWalletData();
    fetchTransactions();
    const interval = setInterval(fetchWalletData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [workerId]);

  const fetchWalletData = async () => {
    try {
      const response = await fetch(`/api/workers/${workerId}/wallet`);
      const data = await response.json();

      if (data.success) {
        setBalance(data.balance);
        setEarnings(data.totalEarnings);
        setTodayEarnings(data.todayEarnings);
        setLabelsCount(data.labelsCount);
        setTelegramWallet(data.telegramWallet);
        onBalanceUpdate?.(data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/workers/${workerId}/transactions`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions.map((tx: any) => ({
          ...tx,
          timestamp: new Date(tx.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  // Connect native Telegram wallet
  const connectTelegramWallet = () => {
    telegramService.haptic.selection();
    telegramService.openLink('https://t.me/wallet');
    telegramService.showAlert('Opening Telegram Wallet...');
  };

  // Instant USDT withdrawal
  const withdrawUSDT = async () => {
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount < 1) {
      telegramService.haptic.notification('error');
      telegramService.showError('Minimum withdrawal: 1 USDT');
      return;
    }

    if (amount > balance) {
      telegramService.haptic.notification('error');
      telegramService.showError('Insufficient balance');
      return;
    }

    if (!wallet?.account.address && !telegramWallet) {
      telegramService.haptic.notification('error');
      telegramService.showError('Please connect a wallet first');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/withdraw/usdt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-InitData': WebApp.initData || ''
        },
        body: JSON.stringify({
          amount,
          address: wallet?.account.address || telegramWallet,
          workerId
        })
      });

      const result = await response.json();

      if (result.success) {
        if (wallet?.account.address) {
          // Send transaction via TON Connect
          await sendTonTransaction(result.payload);
        } else {
          // Telegram wallet withdrawal
          WebApp.openLink(result.paymentUrl);
        }

        setShowWithdrawModal(false);
        setWithdrawAmount('');
        telegramService.haptic.notification('success');
        telegramService.showAlert('💰 Withdrawal initiated! Check your wallet.');
        fetchWalletData();
        fetchTransactions();
      } else {
        telegramService.haptic.notification('error');
        telegramService.showError(result.error || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      telegramService.haptic.notification('error');
      telegramService.showError('Withdrawal failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send transaction via TON Connect
  const sendTonTransaction = async (payload: any) => {
    if (!wallet) return;

    const transaction: SendTransactionRequest = {
      messages: [
        {
          address: payload.to,
          amount: toNano(payload.amount),
          payload: beginCell().storeUint(0, 32).storeStringTail(payload.comment).endCell()
        }
      ],
      validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    try {
      await wallet.sendTransaction(transaction);
    } catch (error) {
      console.error('Transaction error:', error);
      telegramService.haptic.notification('error');
      telegramService.showError('Transaction failed. Please try again.');
    }
  };

  // Quick withdrawal buttons
  const quickWithdraw = [1, 5, 10, 25, 50].filter(amount => amount <= balance);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="wallet-container p-4 space-y-4">
      {/* Main Balance Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Typography variant="caption" className="opacity-90">
              Available Balance
            </Typography>
            <Typography variant="display1" weight="3" className="my-2">
              ${balance.toFixed(2)} USDT
            </Typography>
          </div>
          <div className="text-right">
            <Chip mode="elevated" className="bg-white/20 text-white mb-2">
              {labelsCount} labels today
            </Chip>
            <Typography variant="caption" className="opacity-90">
              Today's Earnings: +${todayEarnings.toFixed(2)}
            </Typography>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              telegramService.haptic.selection();
              setShowWithdrawModal(true);
            }}
            disabled={balance < 1 || isLoading}
            className="flex-1 bg-white text-blue-600"
          >
            Withdraw
          </Button>
          <Button
            onClick={() => {
              telegramService.haptic.selection();
              setShowTransactionModal(true);
            }}
            mode="outline"
            className="bg-white/20 border-white text-white"
          >
            History
          </Button>
        </div>
      </Card>

      {/* Wallet Connection */}
      <Card className="p-4">
        <Typography weight="3" className="mb-4">Connected Wallets</Typography>

        <div className="space-y-3">
          {wallet?.account.address && (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <Typography variant="caption">TON Connect</Typography>
                <Typography weight="2">{formatAddress(wallet.account.address)}</Typography>
              </div>
              <TonConnectButton />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <Typography variant="caption">Telegram Wallet</Typography>
              {telegramWallet ? (
                <Typography weight="2">{formatAddress(telegramWallet)}</Typography>
              ) : (
                <Typography variant="caption" color="secondary">Not connected</Typography>
              )}
            </div>
            <Button
              size="s"
              mode="outline"
              onClick={() => {
                telegramService.haptic.selection();
                connectTelegramWallet();
              }}
            >
              Connect
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <Typography variant="display3" weight="3" className="text-green-500">
            ${earnings.toFixed(2)}
          </Typography>
          <Typography variant="caption" color="secondary">
            Total Earned
          </Typography>
        </Card>
        <Card className="p-4 text-center">
          <Typography variant="display3" weight="3" className="text-blue-500">
            {((earnings / 0.02) || 0).toFixed(0)}
          </Typography>
          <Typography variant="caption" color="secondary">
            Total Labels
          </Typography>
        </Card>
      </div>

      {/* Withdrawal Modal */}
      <Modal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        header="Withdraw USDT"
      >
        <div className="p-4 space-y-4">
          <div className="text-center">
            <Typography weight="3">Available: ${balance.toFixed(2)} USDT</Typography>
            <Typography variant="caption" color="secondary">
              Min: 1 USDT | Fee: 0 USDT (instant!)
            </Typography>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickWithdraw.map(amount => (
              <Button
                key={amount}
                mode="outline"
                onClick={() => {
                  telegramService.haptic.selection();
                  setWithdrawAmount(amount.toString());
                }}
              >
                ${amount}
              </Button>
            ))}
          </div>

          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-3 py-2 border rounded-lg"
            min="1"
            max={balance}
            step="0.01"
          />

          <div className="flex gap-2">
            <Button
              onClick={() => {
                telegramService.haptic.selection();
                setShowWithdrawModal(false);
              }}
              mode="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                telegramService.haptic.impact('medium');
                withdrawUSDT();
              }}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) < 1 || isLoading}
              loading={isLoading}
              className="flex-1"
            >
              Withdraw
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        open={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        header="Transaction History"
      >
        <div className="p-4 max-h-96 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Typography color="secondary">No transactions yet</Typography>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      tx.status === 'completed' ? 'bg-green-500' :
                      tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <Typography weight="2">
                        {tx.type === 'earning' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="secondary">
                        {tx.description}
                      </Typography>
                    </div>
                  </div>
                  <div className="text-right">
                    <Typography variant="caption" color="secondary">
                      {tx.timestamp.toLocaleDateString()}
                    </Typography>
                    {tx.txHash && (
                      <Typography variant="caption" className="text-blue-500">
                        ✓
                      </Typography>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};