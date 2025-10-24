import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

interface EarningsData {
  balance: number;
  totalEarned: number;
  todayEarned: number;
}

export const useEarnings = () => {
  const [earnings, setEarnings] = useState<EarningsData>({
    balance: 0,
    totalEarned: 0,
    todayEarned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getEarnings();
      if (response.success && response.data) {
        setEarnings(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const updateBalance = useCallback((newBalance: number) => {
    setEarnings(prev => ({
      ...prev,
      balance: newBalance,
      totalEarned: Math.max(prev.totalEarned, newBalance),
    }));
  }, []);

  const addEarnings = useCallback((amount: number) => {
    setEarnings(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalEarned: prev.totalEarned + amount,
      todayEarned: prev.todayEarned + amount,
    }));
  }, []);

  return {
    earnings,
    isLoading,
    fetchEarnings,
    updateBalance,
    addEarnings,
  };
};