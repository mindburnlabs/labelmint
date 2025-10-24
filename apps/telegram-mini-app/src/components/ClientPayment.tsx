import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Modal, Progress } from '@telegram-apps/telegram-ui';
import { useTWA } from '@twa-dev/sdk/react';

interface ClientPaymentProps {
  projectId: string;
  projectTitle: string;
  requiredAmount: number;
  currency?: string;
  onPaymentComplete?: () => void;
}

interface PaymentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount?: number;
  transactionHash?: string;
  paymentId?: string;
}

export const ClientPayment: React.FC<ClientPaymentProps> = ({
  projectId,
  projectTitle,
  requiredAmount,
  currency = 'USDT',
  onPaymentComplete
}) => {
  const WebApp = useTWA();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({ status: 'pending' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'ton' | 'telegram' | 'card'>('ton');
  const [paymentLink, setPaymentLink] = useState('');
  const [invoiceLink, setInvoiceLink] = useState('');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Check existing payment status
  useEffect(() => {
    checkPaymentStatus();
  }, [projectId]);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/payment-status`);
      const data = await response.json();

      if (data.success && data.status === 'completed') {
        setPaymentStatus({
          status: 'completed',
          amount: data.amount,
          transactionHash: data.transactionHash
        });
        onPaymentComplete?.();
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    }
  };

  // Start payment process
  const startPayment = async () => {
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    try {
      const response = await fetch('/api/client/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-InitData': WebApp.initData || ''
        },
        body: JSON.stringify({
          projectId,
          amountUSDT: requiredAmount,
          description: `Payment for project: ${projectTitle}`,
          clientTelegramId: WebApp.initDataUnsafe?.user?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setPaymentLink(data.paymentLink);
        setInvoiceLink(data.invoiceLink);
        setPaymentStatus({
          status: 'processing',
          paymentId: data.paymentId
        });

        // Open payment link based on method
        if (selectedMethod === 'telegram' && invoiceLink) {
          WebApp.openInvoice(invoiceLink);
        } else if (paymentLink) {
          WebApp.openLink(paymentLink);
        }

        // Start checking payment status
        startPaymentStatusCheck(data.paymentId);
      } else {
        WebApp.showAlert('Failed to create payment. Please try again.');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      WebApp.showAlert('Payment failed. Please try again.');
    }
  };

  // Poll for payment status
  const startPaymentStatusCheck = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/${paymentId}/status`);
        const data = await response.json();

        if (data.success && data.status === 'completed') {
          clearInterval(interval);
          setPaymentStatus({
            status: 'completed',
            amount: data.amount,
            transactionHash: data.transactionHash,
            paymentId
          });
          setShowPaymentModal(false);
          onPaymentComplete?.();
          WebApp.showAlert('✅ Payment successful! Project is now active.');
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPaymentStatus({ status: 'failed' });
          WebApp.showAlert('❌ Payment failed. Please try again.');
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 5000); // Check every 5 seconds

    // Clean up after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="client-payment-container p-4">
      <Card className="p-6">
        <div className="text-center mb-6">
          <Typography variant="display2" weight="3" className="mb-2">
            Fund Your Project
          </Typography>
          <Typography color="secondary">
            Project: {projectTitle}
          </Typography>
        </div>

        {paymentStatus.status === 'completed' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <Typography weight="3" className="text-green-600 mb-2">
              Payment Completed!
            </Typography>
            <Typography color="secondary" className="mb-4">
              Amount: {paymentStatus.amount} {currency}
            </Typography>
            {paymentStatus.transactionHash && (
              <Typography variant="caption" className="text-gray-500">
                TX: {formatAddress(paymentStatus.transactionHash)}
              </Typography>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <Typography>Amount Required:</Typography>
                <Typography weight="3">{requiredAmount} {currency}</Typography>
              </div>
              <div className="flex justify-between items-center">
                <Typography variant="caption" color="secondary">
                  Platform Fee (5%):
                </Typography>
                <Typography variant="caption" color="secondary">
                  {(requiredAmount * 0.05).toFixed(2)} {currency}
                </Typography>
              </div>
              <div className="border-t mt-2 pt-2">
                <div className="flex justify-between items-center">
                  <Typography weight="3">Total:</Typography>
                  <Typography weight="3" className="text-blue-600">
                    {(requiredAmount * 1.05).toFixed(2)} {currency}
                  </Typography>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Typography weight="3">Choose Payment Method:</Typography>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethod === 'ton'}
                  onChange={() => setSelectedMethod('ton')}
                />
                <div className="flex-1">
                  <Typography weight="2">💎 TON Wallet</Typography>
                  <Typography variant="caption" color="secondary">
                    Pay with TON or USDT via TON Connect
                  </Typography>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethod === 'telegram'}
                  onChange={() => setSelectedMethod('telegram')}
                />
                <div className="flex-1">
                  <Typography weight="2">⭐ Telegram Stars</Typography>
                  <Typography variant="caption" color="secondary">
                    Pay with Telegram Stars (native)
                  </Typography>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethod === 'card'}
                  onChange={() => setSelectedMethod('card')}
                />
                <div className="flex-1">
                  <Typography weight="2">💳 Credit Card</Typography>
                  <Typography variant="caption" color="secondary">
                    Pay via Stripe (Coming soon)
                  </Typography>
                </div>
              </label>
            </div>

            <Button
              onClick={startPayment}
              size="large"
              className="w-full"
              disabled={paymentStatus.status === 'processing'}
            >
              {paymentStatus.status === 'processing' ? 'Processing...' : 'Pay Now'}
            </Button>

            {paymentStatus.status === 'processing' && (
              <div className="text-center">
                <Progress value={50} className="mb-2" />
                <Typography variant="caption" color="secondary">
                  Waiting for payment confirmation...
                </Typography>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Payment Modal */}
      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        header={`Pay with ${selectedMethod === 'ton' ? 'TON Wallet' : selectedMethod === 'telegram' ? 'Telegram Stars' : 'Credit Card'}`}
      >
        <div className="p-4 space-y-4">
          <div className="text-center">
            <Typography weight="3" className="mb-2">
              Total Amount: {(requiredAmount * 1.05).toFixed(2)} {currency}
            </Typography>
            <Typography variant="caption" color="secondary">
              Including platform fee
            </Typography>
          </div>

          {selectedMethod === 'card' ? (
            <div className="text-center py-8">
              <Typography color="secondary">
                Credit card payments will be available soon.
                <br />
                Please use TON Wallet or Telegram Stars for now.
              </Typography>
            </div>
          ) : (
            <div className="space-y-4">
              <Typography variant="caption" color="secondary">
                You'll be redirected to complete the payment.
              </Typography>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPaymentModal(false)}
                  mode="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processPayment}
                  className="flex-1"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};