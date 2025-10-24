import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { Card } from '../Card';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  amount?: string;
  currency?: 'TON' | 'USDT';
  message?: string;
  onAmountChange?: (amount: string) => void;
  onMessageChange?: (message: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  address,
  amount = '',
  currency = 'USDT',
  message = '',
  onAmountChange,
  onMessageChange
}) => {
  const [qrCodeData, setQrCodeData] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate QR code data
  useEffect(() => {
    if (isOpen && address) {
      const tonLink = `ton://transfer/${address}?amount=${amount}&text=${encodeURIComponent(message)}`;
      setQrCodeData(tonLink);
    }
  }, [isOpen, address, amount, message]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const copyQRData = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy QR data:', error);
    }
  };

  const downloadQR = () => {
    // This would typically generate and download a QR code image
    // For now, we'll just copy the data
    copyQRData();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Receive Payment"
      className="max-w-md"
    >
      <div className="space-y-6">
        {/* QR Code Display */}
        <div className="text-center">
          <Card className="p-6 bg-muted/50">
            <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
              {/* QR Code would be rendered here */}
              <div className="text-center">
                <div className="text-4xl mb-2">📱</div>
                <div className="text-sm text-muted-foreground">
                  QR Code will be generated here
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Address Display */}
        <div>
          <label className="block text-sm font-medium mb-2">Wallet Address</label>
          <div className="flex gap-2">
            <Input
              value={address}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={copyAddress}
              disabled={copied}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Amount Input */}
        {onAmountChange && (
          <div>
            <label className="block text-sm font-medium mb-2">Amount ({currency})</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              step="0.000001"
              min="0"
            />
          </div>
        )}

        {/* Message Input */}
        {onMessageChange && (
          <div>
            <label className="block text-sm font-medium mb-2">Message (Optional)</label>
            <Input
              type="text"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Add a note to this payment"
              maxLength={100}
            />
          </div>
        )}

        {/* QR Data Display */}
        <div>
          <label className="block text-sm font-medium mb-2">QR Code Data</label>
          <div className="flex gap-2">
            <Input
              value={qrCodeData}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              onClick={copyQRData}
              disabled={copied}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={downloadQR}
            className="flex-1"
          >
            Download QR
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
          >
            Close
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">To receive payments:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Share your wallet address with the sender</li>
            <li>Or let them scan the QR code</li>
            <li>Payments will appear in your wallet automatically</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
