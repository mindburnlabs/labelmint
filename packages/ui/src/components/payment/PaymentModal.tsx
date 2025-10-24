import React, { useState } from 'react';
import { Button } from '../Button';
import { Card } from '../Card';
import { Input } from '../Input';
import { useTonWallet } from '../../hooks/useTonWallet';
import { cn } from '../../lib/utils';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount?: number;
  recipientAddress?: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  type?: 'send' | 'withdraw';
  title?: string;
  description?: string;
}

export function PaymentModal({
  isOpen,
  onClose,
  amount: initialAmount = 0,
  recipientAddress: initialRecipient = '',
  onSuccess,
  onError,
  type = 'send',
  title,
  description,
}: PaymentModalProps) {
  const {
    isConnected,
    connection,
    balance,
    sendTransaction,
    formatAmount,
    shortenAddress,
  } = useTonWallet();

  const [amount, setAmount] = useState(initialAmount.toString());
  const [recipient, setRecipient] = useState(initialRecipient);
  const [memo, setMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!recipient) {
      setError('Recipient address is required');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    const amountFloat = parseFloat(amount);
    const balanceFloat = parseFloat(balance || '0');

    if (amountFloat > balanceFloat) {
      setError('Insufficient balance');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Convert TON to nanotons (1 TON = 10^9 nanotons)
      const amountInNanotons = Math.floor(amountFloat * 1e9).toString();

      const txHash = await sendTransaction({
        to: recipient,
        amount: amountInNanotons,
        payload: memo,
      });

      onSuccess?.(txHash);
      onClose();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transaction failed');
      setError(error.message);
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const modalTitle = title || (type === 'withdraw' ? 'Withdraw Funds' : 'Send Payment');
  const modalDescription = description || (type === 'withdraw' 
    ? 'Enter your wallet address to withdraw funds'
    : 'Send TON to another address');

  const availableBalance = balance ? parseFloat(balance) : 0;
  const selectedAmount = amount ? parseFloat(amount) : 0;
  const estimatedFee = 0.01; // Approximate TON transaction fee
  const totalAmount = selectedAmount + estimatedFee;

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
              <h2 className="text-2xl font-bold">{modalTitle}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {modalDescription}
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

          {/* Wallet Info */}
          {isConnected && connection && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">From</span>
                <span className="font-mono">{shortenAddress(connection.address)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Available</span>
                <span className="font-semibold">{formatAmount(balance || '0')} TON</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Recipient Address
              </label>
              <Input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="EQ..."
                disabled={isProcessing || !!initialRecipient}
                required
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Amount (TON)</label>
                <button
                  type="button"
                  onClick={() => setAmount((availableBalance - estimatedFee).toString())}
                  className="text-sm text-blue-500 hover:underline"
                >
                  Max
                </button>
              </div>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isProcessing}
                required
              />
            </div>

            {/* Memo (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Memo (Optional)
              </label>
              <Input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note..."
                disabled={isProcessing}
              />
            </div>

            {/* Transaction Summary */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span>{formatAmount(amount || '0')} TON</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Estimated Fee</span>
                <span>~{estimatedFee} TON</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Total</span>
                <span>{formatAmount(totalAmount.toString())} TON</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isConnected || isProcessing || totalAmount > availableBalance}
                className="flex-1"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
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
                    Processing...
                  </span>
                ) : (
                  type === 'withdraw' ? 'Withdraw' : 'Send'
                )}
              </Button>
            </div>
          </form>

          {/* Warning */}
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            Please double-check the recipient address. Transactions cannot be reversed.
          </div>
        </Card>
      </div>
    </div>
  );
}

export default PaymentModal;

