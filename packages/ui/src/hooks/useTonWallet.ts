import { useState, useEffect, useCallback, useRef } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { TonWalletService, WalletBalance, Transaction } from '../services/tonWalletService';

export interface UseTonWalletOptions {
  autoConnect?: boolean;
  network?: 'testnet' | 'mainnet';
  pollingInterval?: number;
}

export interface UseTonWalletReturn {
  // State
  isConnected: boolean;
  balance: WalletBalance;
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  
  // Wallet info
  walletAddress: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  sendTon: (to: string, amount: string, message?: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  sendUSDT: (to: string, amount: string, message?: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  
  // Utilities
  formatAddress: (address: string, length?: number) => string;
  formatAmount: (amount: string, decimals?: number) => string;
}

export function useTonWallet(options: UseTonWalletOptions = {}): UseTonWalletReturn {
  const {
    autoConnect = true,
    network = 'testnet',
    pollingInterval = 30000
  } = options;

  const tonConnectWallet = useTonWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState<WalletBalance>({ ton: '0', usdt: '0' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const serviceRef = useRef<TonWalletService | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize service
  useEffect(() => {
    const initializeService = async () => {
      try {
        const service = new TonWalletService({ network });
        await service.initialize();
        serviceRef.current = service;

        // Set up event listeners
        service.on('balanceUpdated', setBalance);
        service.on('transactionsUpdated', setTransactions);

        if (autoConnect && tonConnectWallet) {
          setIsConnected(true);
          setWalletAddress(tonConnectWallet.account.address);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize wallet service'));
      }
    };

    initializeService();

    return () => {
      if (serviceRef.current) {
        serviceRef.current.destroy();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [network, autoConnect, tonConnectWallet]);

  // Handle wallet connection changes
  useEffect(() => {
    if (tonConnectWallet) {
      setIsConnected(true);
      setWalletAddress(tonConnectWallet.account.address);
      setError(null);
    } else {
      setIsConnected(false);
      setWalletAddress(null);
    }
  }, [tonConnectWallet]);

  // Start polling for updates
  useEffect(() => {
    if (isConnected && serviceRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          await serviceRef.current?.fetchBalance();
        } catch (err) {
          console.error('Failed to poll balance:', err);
        }
      }, pollingInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isConnected, pollingInterval]);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!serviceRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // For TON Connect, the connection is handled by the TonConnectButton
      // This function can be used for additional setup
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect wallet'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress(null);
    setBalance({ ton: '0', usdt: '0' });
    setTransactions([]);
    setError(null);
  }, []);

  // Send TON transaction
  const sendTon = useCallback(async (
    to: string,
    amount: string,
    message?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!serviceRef.current) {
      return { success: false, error: 'Wallet service not initialized' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await serviceRef.current.sendTonTransaction(to, amount, message);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transaction failed');
      setError(error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send USDT transaction
  const sendUSDT = useCallback(async (
    to: string,
    amount: string,
    message?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!serviceRef.current) {
      return { success: false, error: 'Wallet service not initialized' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await serviceRef.current.sendUSDTTransaction(to, amount, message);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transaction failed');
      setError(error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!serviceRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await serviceRef.current.fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh balance'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh transactions
  const refreshTransactions = useCallback(async () => {
    if (!serviceRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await serviceRef.current.fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh transactions'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Format address utility
  const formatAddress = useCallback((address: string, length: number = 6): string => {
    if (!serviceRef.current) return address;
    return serviceRef.current.formatAddress(address, length);
  }, []);

  // Format amount utility
  const formatAmount = useCallback((amount: string, decimals: number = 2): string => {
    if (!serviceRef.current) return amount;
    return serviceRef.current.formatAmount(amount, decimals);
  }, []);

  return {
    // State
    isConnected,
    balance,
    transactions,
    isLoading,
    error,
    
    // Wallet info
    walletAddress,
    
    // Actions
    connect,
    disconnect,
    sendTon,
    sendUSDT,
    refreshBalance,
    refreshTransactions,
    
    // Utilities
    formatAddress,
    formatAmount,
  };
}