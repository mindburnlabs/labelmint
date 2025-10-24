'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { financeApi } from '@/lib/api';
import { WithdrawalRequest, Transaction } from '@/types';
import { Button } from '@labelmint/ui/components/Button';
import { formatRelativeTime, formatCurrency } from '@labelmint/utils';
import { toast } from 'sonner';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'transactions'>('withdrawals');
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>('pending');

  const { data: withdrawalsData, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['withdrawals', withdrawalStatus],
    queryFn: () => financeApi.getWithdrawalRequests(withdrawalStatus),
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => financeApi.getTransactions({ limit: 50 }),
  });

  const { data: revenueData } = useQuery({
    queryKey: ['revenue-metrics'],
    queryFn: () => financeApi.getRevenueMetrics('30d'),
  });

  const withdrawals = withdrawalsData?.data || [];
  const transactions = transactionsData?.data || [];
  const revenue = revenueData;

  const handleWithdrawalAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      if (action === 'approve') {
        await financeApi.approveWithdrawal(id);
        toast.success('Withdrawal approved successfully');
      } else {
        await financeApi.rejectWithdrawal(id, reason || 'Rejected by admin');
        toast.success('Withdrawal rejected');
      }
      refetchWithdrawals();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const revenueStats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(revenue?.totalRevenue || 0),
      change: '+12.5%',
      changeType: 'increase' as const,
    },
    {
      label: 'Monthly Revenue',
      value: formatCurrency(revenue?.monthlyRevenue || 0),
      change: '+8.2%',
      changeType: 'increase' as const,
    },
    {
      label: 'Pending Withdrawals',
      value: formatCurrency(withdrawals.reduce((sum: number, w: WithdrawalRequest) => sum + w.amount, 0)),
      change: '0',
      changeType: 'neutral' as const,
    },
    {
      label: 'Total Payouts',
      value: formatCurrency(revenue?.totalPayments || 0),
      change: '+23.1%',
      changeType: 'increase' as const,
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor revenue, transactions, and manage withdrawal requests.
        </p>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {revenueStats.map((stat, index) => (
          <div key={index} className="kpi-card">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {stat.value}
            </p>
            {stat.changeType !== 'neutral' && (
              <p className={`text-sm ${
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change} from last month
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'withdrawals'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Withdrawal Requests
              {withdrawals.length > 0 && (
                <span className="ml-2 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 py-0.5 px-2 rounded-full text-xs">
                  {withdrawals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'transactions'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Recent Transactions
            </button>
          </nav>
        </div>

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div>
            {/* Filter */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <Button
                  variant={withdrawalStatus === 'pending' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setWithdrawalStatus('pending')}
                >
                  Pending
                </Button>
                <Button
                  variant={withdrawalStatus === 'approved' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setWithdrawalStatus('approved')}
                >
                  Approved
                </Button>
                <Button
                  variant={withdrawalStatus === 'rejected' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setWithdrawalStatus('rejected')}
                >
                  Rejected
                </Button>
                <Button
                  variant={withdrawalStatus === '' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setWithdrawalStatus('')}
                >
                  All
                </Button>
              </div>
            </div>

            {/* Withdrawals List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {withdrawalsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                ))
              ) : withdrawals.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No withdrawal requests found
                </div>
              ) : (
                withdrawals.map((withdrawal: WithdrawalRequest) => (
                  <div key={withdrawal.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {withdrawal.userName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {withdrawal.method.toUpperCase()} • {withdrawal.wallet.slice(0, 6)}...{withdrawal.wallet.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Requested {formatRelativeTime(withdrawal.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(withdrawal.amount)} {withdrawal.currency}
                          </p>
                          <span className={`status-badge ${
                            withdrawal.status === 'pending' ? 'warning' :
                            withdrawal.status === 'approved' ? 'success' :
                            withdrawal.status === 'rejected' ? 'danger' : 'info'
                          }`}>
                            {withdrawal.status}
                          </span>
                        </div>
                        {withdrawal.status === 'pending' && (
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                            >
                              <XCircleIcon className="h-5 w-5 text-red-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                            >
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            </Button>
                          </div>
                        )}
                        <Button variant="ghost" size="icon">
                          <EyeIcon className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    {withdrawal.notes && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <strong>Note:</strong> {withdrawal.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="text-center py-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction: Transaction) => (
                      <tr key={transaction.id}>
                        <td className="text-sm text-gray-900 dark:text-gray-100">
                          {formatRelativeTime(transaction.createdAt)}
                        </td>
                        <td>
                          <span className={`status-badge ${
                            transaction.type === 'deposit' ? 'success' :
                            transaction.type === 'withdrawal' ? 'warning' :
                            transaction.type === 'task_payment' ? 'info' : 'gray'
                          }`}>
                            {transaction.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-sm text-gray-900 dark:text-gray-100">
                          {transaction.toUserId || transaction.fromUserId || 'System'}
                        </td>
                        <td className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(transaction.amount)} {transaction.currency}
                        </td>
                        <td>
                          <span className={`status-badge ${
                            transaction.status === 'completed' ? 'success' :
                            transaction.status === 'pending' ? 'warning' :
                            transaction.status === 'failed' ? 'danger' : 'info'
                          }`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td>
                          <Button variant="ghost" size="icon">
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Export Button */}
      <div className="mt-6 flex justify-end">
        <Button variant="outline" className="flex items-center gap-2">
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export Financial Report
        </Button>
      </div>
    </div>
  );
}