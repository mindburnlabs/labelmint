import React, { useState } from 'react';
import { Button } from '../Button';
import { Card } from '../Card';
import { Input } from '../Input';
import { Select } from '../Select';
import { Modal } from '../Modal';

export interface PaymentFormProps {
  onSubmit: (data: PaymentFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  className?: string;
  defaultValues?: Partial<PaymentFormData>;
}

export interface PaymentFormData {
  amount: string;
  currency: 'TON' | 'USDT';
  recipientAddress: string;
  message?: string;
  priority: 'low' | 'medium' | 'high';
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  onSubmit,
  onCancel,
  className = '',
  defaultValues
}) => {
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: defaultValues?.amount || '',
    currency: defaultValues?.currency || 'USDT',
    recipientAddress: defaultValues?.recipientAddress || '',
    message: defaultValues?.message || '',
    priority: defaultValues?.priority || 'medium'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(formData);
      if (!result.success) {
        setError(result.error || 'Payment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof PaymentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const quickAmounts = [1, 5, 10, 25, 50, 100];

  return (
    <Card className={`payment-form ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Send Payment</h2>
          <p className="text-muted-foreground">Transfer funds securely on TON blockchain</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Currency Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Currency</label>
          <Select
            value={formData.currency}
            onValueChange={(value) => handleInputChange('currency', value)}
          >
            <option value="USDT">USDT</option>
            <option value="TON">TON</option>
          </Select>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Amount</label>
          <div className="space-y-3">
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              placeholder="0.00"
              step="0.000001"
              min="0"
              required
              className="text-lg"
            />
            
            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map(amount => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('amount', amount.toString())}
                  className="text-xs"
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium mb-2">Recipient Address</label>
          <Input
            type="text"
            value={formData.recipientAddress}
            onChange={(e) => handleInputChange('recipientAddress', e.target.value)}
            placeholder="0:..."
            required
            className="font-mono text-sm"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium mb-2">Message (Optional)</label>
          <Input
            type="text"
            value={formData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            placeholder="Add a note to this payment"
            maxLength={100}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium mb-2">Transaction Priority</label>
          <Select
            value={formData.priority}
            onValueChange={(value) => handleInputChange('priority', value)}
          >
            <option value="low">Low (Lower fee, slower confirmation)</option>
            <option value="medium">Medium (Balanced fee and speed)</option>
            <option value="high">High (Higher fee, faster confirmation)</option>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !formData.amount || !formData.recipientAddress}
            loading={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Processing...' : 'Send Payment'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
