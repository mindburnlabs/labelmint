import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TonConnectButton, TonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address, beginCell } from '@ton/core';

interface WalletBalance {
  ton: string;
  usdt: string;
}

interface Transaction {
  id: number;
  hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  amount_usdt: number;
  token_type: 'TON' | 'USDT';
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

export const TONWalletConnect: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState<WalletBalance>({ ton: '0', usdt: '0' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    toAddress: '',
    amount: '',
    tokenType: 'USDT' as 'TON' | 'USDT',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const wallet = useTonWallet();

  useEffect(() => {
    if (wallet) {
      setIsConnected(true);
      fetchBalance();
      fetchTransactions();
    } else {
      setIsConnected(false);
    }
  }, [wallet, network]);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`/api/payments/balance?network=${network}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setBalance(data.balances);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/payments/transactions?network=${network}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTransactions(data.data.onChain);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/payments/transaction/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...sendForm,
          network
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Transaction sent successfully!');
        setShowSendModal(false);
        setSendForm({ toAddress: '', amount: '', tokenType: 'USDT', message: '' });
        fetchBalance();
        fetchTransactions();
      } else {
        alert(data.error || 'Failed to send transaction');
      }
    } catch (error) {
      console.error('Send transaction error:', error);
      alert('Failed to send transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTelegram = async () => {
    try {
      // This would integrate with Telegram's WebApp API
      const webApp = (window as any).Telegram?.WebApp;

      if (webApp) {
        webApp.ready();
        webApp.showConfirm('Connect your Telegram wallet?', async (confirmed: boolean) => {
          if (confirmed) {
            const response = await fetch('/api/payments/wallet/telegram/connect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                walletAddress: webApp.initDataUnsafe.user?.id,
                signature: 'telegram_signature'
              })
            });

            const data = await response.json();
            if (data.success) {
              alert('Telegram wallet connected successfully!');
              fetchBalance();
            }
          }
        });
      } else {
        alert('Please open this app in Telegram to connect your wallet');
      }
    } catch (error) {
      console.error('Telegram connect error:', error);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    alert('Address copied to clipboard');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">TON Wallet</h1>
          <div className="flex items-center gap-4">
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'testnet' | 'mainnet')}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
            <TonConnectButton />
          </div>
        </div>

        {isConnected && wallet ? (
          <div className="space-y-6">
            {/* Wallet Address */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Wallet Address</p>
                  <p className="font-mono text-sm">
                    {wallet.account.address.toString()}
                  </p>
                </div>
                <button
                  onClick={() => copyAddress(wallet.account.address.toString())}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Balance Display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-sm text-blue-600 mb-2">TON Balance</h3>
                <p className="text-2xl font-bold text-blue-900">{balance.ton} TON</p>
              </div>
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-sm text-green-600 mb-2">USDT Balance</h3>
                <p className="text-2xl font-bold text-green-900">{balance.usdt} USDT</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowSendModal(true)}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Send
              </button>
              <button
                onClick={handleConnectTelegram}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect Telegram Wallet
              </button>
              <button
                onClick={fetchBalance}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Connect your wallet to get started</p>
            <TonConnectButton />
          </div>
        )}
      </div>

      {/* Transaction History */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Transaction History</h2>
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
                        tx.token_type === 'USDT' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tx.token_type}
                      </span>
                    </td>
                    <td className="py-2">
                      {tx.amount_usdt || tx.amount}
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
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {tx.hash.slice(0, 10)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet</p>
            )}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Send Transaction</h2>
            <form onSubmit={handleSendTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Token Type</label>
                <select
                  value={sendForm.tokenType}
                  onChange={(e) => setSendForm({...sendForm, tokenType: e.target.value as 'TON' | 'USDT'})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="USDT">USDT</option>
                  <option value="TON">TON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Recipient Address</label>
                <input
                  type="text"
                  value={sendForm.toAddress}
                  onChange={(e) => setSendForm({...sendForm, toAddress: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="0:..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.000001"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message (Optional)</label>
                <input
                  type="text"
                  value={sendForm.message}
                  onChange={(e) => setSendForm({...sendForm, message: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Optional message"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};