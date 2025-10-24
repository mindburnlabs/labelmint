import React, { useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { useTonWallet as useTonWalletHook } from '../hooks/useTonWallet';
import { Button } from './Button';
import { Card } from './Card';
import { Modal } from './Modal';
import { Input } from './Input';
import { Select } from './Select';

export interface TonWalletProps {
  className?: string;
  showBalance?: boolean;
  showTransactions?: boolean;
  showSendForm?: boolean;
  compact?: boolean;
  network?: 'testnet' | 'mainnet';
}

export const TonWallet: React.FC<TonWalletProps> = ({
  className = '',
  showBalance = true,
  showTransactions = true,
  showSendForm = true,
  compact = false,
  network = 'testnet'
}) => {
  const tonConnectWallet = useTonWallet();
  const {
    isConnected,
    balance,
    transactions,
    isLoading,
    error,
    walletAddress,
    sendTon,
    sendUSDT,
    refreshBalance,
    refreshTransactions,
    formatAddress,
    formatAmount
  } = useTonWalletHook({ network });

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    toAddress: '',
    amount: '',
    tokenType: 'USDT' as 'TON' | 'USDT',
    message: ''
  });
  const [isSending, setIsSending] = useState(false);

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const result = sendForm.tokenType === 'TON' 
        ? await sendTon(sendForm.toAddress, sendForm.amount, sendForm.message)
        : await sendUSDT(sendForm.toAddress, sendForm.amount, sendForm.message);

      if (result.success) {
        setShowSendModal(false);
        setSendForm({ toAddress: '', amount: '', tokenType: 'USDT', message: '' });
        await refreshBalance();
        await refreshTransactions();
      } else {
        alert(result.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('Send transaction error:', error);
      alert('Transaction failed');
    } finally {
      setIsSending(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // You might want to use a toast notification here
    alert('Address copied to clipboard');
  };

  if (compact) {
    return (
      <div className={`ton-wallet-compact ${className}`}>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="text-sm">
              <div className="font-medium">{formatAmount(balance.usdt)} USDT</div>
              <div className="text-muted-foreground">{formatAddress(walletAddress || '')}</div>
            </div>
            <Button size="sm" onClick={() => setShowSendModal(true)}>
              Send
            </Button>
          </div>
        ) : (
          <TonConnectButton />
        )}
      </div>
    );
  }

  return (
    <div className={`ton-wallet ${className}`}>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">TON Wallet</h2>
          <div className="flex items-center gap-2">
            <TonConnectButton />
            {isConnected && (
              <Button variant="outline" onClick={refreshBalance} disabled={isLoading}>
                Refresh
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error.message}</p>
          </div>
        )}

        {isConnected && walletAddress ? (
          <div className="space-y-6">
            {/* Wallet Address */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Address</p>
                  <p className="font-mono text-sm">{walletAddress}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyAddress(walletAddress)}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Balance Display */}
            {showBalance && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm text-blue-600 mb-2">TON Balance</h3>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatAmount(balance.ton)} TON
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm text-green-600 mb-2">USDT Balance</h3>
                  <p className="text-2xl font-bold text-green-900">
                    {formatAmount(balance.usdt)} USDT
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {showSendForm && (
              <div className="flex gap-4">
                <Button
                  onClick={() => setShowSendModal(true)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Send Transaction
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Connect your TON wallet to get started
            </p>
            <TonConnectButton />
          </div>
        )}
      </Card>

      {/* Transaction History */}
      {isConnected && showTransactions && (
        <Card className="mt-6 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <Button variant="outline" onClick={refreshTransactions} disabled={isLoading}>
              Refresh
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b">
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.tokenType === 'USDT' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tx.tokenType}
                      </span>
                    </td>
                    <td className="py-2">
                      {formatAmount(tx.amount)}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {tx.timestamp.toLocaleDateString()}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {tx.hash.slice(0, 10)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Send Transaction Modal */}
      <Modal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Send Transaction"
      >
        <form onSubmit={handleSendTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Token Type</label>
            <Select
              value={sendForm.tokenType}
              onValueChange={(value) => setSendForm({...sendForm, tokenType: value as 'TON' | 'USDT'})}
            >
              <option value="USDT">USDT</option>
              <option value="TON">TON</option>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Recipient Address</label>
            <Input
              type="text"
              value={sendForm.toAddress}
              onChange={(e) => setSendForm({...sendForm, toAddress: e.target.value})}
              placeholder="0:..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <Input
              type="number"
              step="0.000001"
              value={sendForm.amount}
              onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
              placeholder="0.00"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Message (Optional)</label>
            <Input
              type="text"
              value={sendForm.message}
              onChange={(e) => setSendForm({...sendForm, message: e.target.value})}
              placeholder="Optional message"
            />
          </div>
          
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSendModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSending || isLoading}
              className="flex-1"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
