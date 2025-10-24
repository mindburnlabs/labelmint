import React, { useState } from 'react';
import { Button } from '../Button';
import { Card } from '../Card';
import { Input } from '../Input';
import { cn } from '../../lib/utils';

export interface WithdrawalFormProps {
  className?: string;
  availableBalance: number;
  currency?: string;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  fee?: number;
  feePercentage?: number;
  onSubmit: (data: { amount: number; address: string; memo?: string }) => Promise<void>;
  onCancel?: () => void;
  isProcessing?: boolean;
}

export function WithdrawalForm({
  className,
  availableBalance,
  currency = 'TON',
  minWithdrawal = 1,
  maxWithdrawal,
  fee = 0,
  feePercentage = 0,
  onSubmit,
  onCancel,
  isProcessing = false,
}: WithdrawalFormProps) {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const amountFloat = parseFloat(amount) || 0;
  const calculatedFee = fee + (amountFloat * feePercentage / 100);
  const totalAmount = amountFloat + calculatedFee;
  const effectiveMaxWithdrawal = maxWithdrawal ?? availableBalance;

  const validate = (): string | null => {
    if (!amount || amountFloat <= 0) {
      return 'Please enter a valid amount';
    }

    if (amountFloat < minWithdrawal) {
      return `Minimum withdrawal amount is ${minWithdrawal} ${currency}`;
    }

    if (amountFloat > effectiveMaxWithdrawal) {
      return `Maximum withdrawal amount is ${effectiveMaxWithdrawal} ${currency}`;
    }

    if (totalAmount > availableBalance) {
      return 'Insufficient balance (including fees)';
    }

    if (!address) {
      return 'Please enter a wallet address';
    }

    if (!address.startsWith('EQ') && !address.startsWith('UQ')) {
      return 'Invalid TON wallet address';
    }

    return null;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      await onSubmit({
        amount: amountFloat,
        address,
        memo,
      });
      
      // Reset form on success
      setAmount('');
      setAddress('');
      setMemo('');
      setShowConfirmation(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setShowConfirmation(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    onCancel?.();
  };

  if (showConfirmation) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Confirm Withdrawal</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please review the withdrawal details carefully
            </p>
          </div>

          {/* Withdrawal Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 mb-6 text-left">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <span className="font-semibold">{amountFloat.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Fee</span>
              <span className="font-semibold">{calculatedFee.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">{totalAmount.toFixed(2)} {currency}</span>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">To Address</div>
              <div className="font-mono text-sm break-all">{address}</div>
            </div>
            {memo && (
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Memo</div>
                <div className="text-sm">{memo}</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 'Confirm Withdrawal'}
            </Button>
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Withdrawals are usually processed within 24 hours
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <h3 className="text-xl font-bold mb-4">Withdraw Funds</h3>

      {/* Balance Display */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Available Balance
        </div>
        <div className="text-2xl font-bold">
          {availableBalance.toFixed(2)} {currency}
        </div>
      </div>

      <form onSubmit={handleContinue} className="space-y-4">
        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">
              Amount ({currency})
            </label>
            <button
              type="button"
              onClick={() => setAmount((availableBalance - calculatedFee).toFixed(2))}
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
            placeholder={`Min: ${minWithdrawal} ${currency}`}
            disabled={isProcessing}
            required
          />
          <div className="mt-1 text-xs text-gray-500">
            Min: {minWithdrawal} {currency} • Max: {effectiveMaxWithdrawal} {currency}
          </div>
        </div>

        {/* Wallet Address */}
        <div>
          <label className="block text-sm font-medium mb-2">
            TON Wallet Address
          </label>
          <Input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="EQ..."
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
            placeholder="Add a note for your records"
            disabled={isProcessing}
          />
        </div>

        {/* Fee Information */}
        {(fee > 0 || feePercentage > 0) && amountFloat > 0 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">You will receive</span>
              <span className="font-semibold">{amountFloat.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Processing fee</span>
              <span>{calculatedFee.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold">Total deducted</span>
              <span className="font-semibold">{totalAmount.toFixed(2)} {currency}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isProcessing || !amount || !address}
            className={cn(onCancel ? 'flex-1' : 'w-full')}
          >
            Continue
          </Button>
        </div>
      </form>

      {/* Information */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <div className="flex gap-3">
          <span className="text-yellow-600 dark:text-yellow-400 text-xl">ℹ️</span>
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold mb-1">Important Information</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Withdrawals are processed within 24 hours</li>
              <li>Ensure your wallet address is correct - transactions cannot be reversed</li>
              <li>You'll receive a confirmation email once processed</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default WithdrawalForm;

