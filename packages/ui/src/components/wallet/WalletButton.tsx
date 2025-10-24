import React from 'react';
import { Button } from '../Button';
import { useTonWallet, UseTonWalletOptions } from '../../hooks/useTonWallet';
import { cn } from '../../lib/utils';

export interface WalletButtonProps extends UseTonWalletOptions {
  className?: string;
  connectText?: string;
  disconnectText?: string;
  showBalance?: boolean;
  showAddress?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
}

export function WalletButton({
  className,
  connectText = 'Connect Wallet',
  disconnectText = 'Disconnect',
  showBalance = true,
  showAddress = true,
  onConnect,
  onDisconnect,
  variant = 'default',
  size = 'md',
  ...walletOptions
}: WalletButtonProps) {
  const {
    isConnected,
    isConnecting,
    connection,
    balance,
    connect,
    disconnect,
    shortenAddress,
    formatAmount,
  } = useTonWallet(walletOptions);

  const handleClick = async () => {
    if (isConnected) {
      await disconnect();
      onDisconnect?.();
    } else {
      await connect();
      onConnect?.();
    }
  };

  const renderContent = () => {
    if (isConnecting) {
      return (
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
          Connecting...
        </span>
      );
    }

    if (isConnected && connection) {
      return (
        <span className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="flex flex-col items-start">
            {showAddress && (
              <span className="text-sm font-medium">
                {shortenAddress(connection.address)}
              </span>
            )}
            {showBalance && balance && (
              <span className="text-xs opacity-75">
                {formatAmount(balance)} TON
              </span>
            )}
            {!showAddress && !showBalance && disconnectText}
          </span>
        </span>
      );
    }

    return connectText;
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isConnecting}
      variant={variant}
      size={size}
      className={cn(
        'relative',
        isConnected && 'bg-green-600 hover:bg-green-700',
        className
      )}
    >
      {renderContent()}
    </Button>
  );
}

export default WalletButton;

