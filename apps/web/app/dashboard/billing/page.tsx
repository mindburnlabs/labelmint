'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  DollarSign,
  CreditCard,
  Download,
  Calendar,
  TrendingUp,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'SPEND' | 'REFUND';
  amount: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  projectId?: string;
  projectTitle?: string;
}

interface BillingStats {
  currentBalance: number;
  totalSpent: number;
  totalDeposited: number;
  pendingTransactions: number;
  monthlySpend: number;
  lastDeposit?: string;
}

export default function BillingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [depositAmount, setDepositAmount] = useState(50);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      const currentUser = await authClient.getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      const [billingData, transactionsData] = await Promise.all([
        apiClient.getBillingInfo(currentUser.id),
        apiClient.getTransactionHistory(currentUser.id),
      ]);

      setStats(billingData);
      setTransactions(transactionsData.transactions);
    } catch (error: any) {
      toast.error('Failed to load billing data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const result = await apiClient.addFunds(user.id, depositAmount);

      // Open Stripe checkout
      window.open(result.paymentUrl, '_blank');

      toast.success('Redirecting to payment...');
      setShowAddFunds(false);

      // Reload after 3 seconds
      setTimeout(loadBillingData, 3000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add funds');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Billing</span>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${stats.currentBalance.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${stats.totalSpent.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-red-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Spend</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${stats.monthlySpend.toFixed(2)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Deposited</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${stats.totalDeposited.toFixed(2)}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Add Funds */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add Funds
            </h2>
            {!showAddFunds && (
              <Button onClick={() => setShowAddFunds(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Funds
              </Button>
            )}
          </div>

          {showAddFunds && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (USD)
                </label>
                <div className="flex space-x-2">
                  {[25, 50, 100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setDepositAmount(amount)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        depositAmount === amount
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                  min="10"
                  step="0.01"
                />
              </div>

              <div className="flex space-x-3">
                <Button onClick={handleAddFunds} disabled={isLoading}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isLoading ? 'Processing...' : 'Pay with Card'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddFunds(false)}>
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Powered by Stripe. Your payment information is secure and encrypted.
              </p>
            </div>
          )}
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Transaction History
              </h2>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="p-6">
            {transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
                        transaction.type === 'DEPOSIT'
                          ? 'bg-green-100 dark:bg-green-900'
                          : transaction.type === 'REFUND'
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        {transaction.type === 'DEPOSIT' && (
                          <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        {transaction.type === 'REFUND' && (
                          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                        {transaction.type === 'SPEND' && (
                          <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </p>
                        {transaction.projectTitle && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Project: {transaction.projectTitle}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.type === 'DEPOSIT' || transaction.type === 'REFUND'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'DEPOSIT' || transaction.type === 'REFUND' ? '+' : '-'}
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center justify-end mt-1">
                        {transaction.status === 'COMPLETED' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        {transaction.status === 'PENDING' && (
                          <Clock className="h-3 w-3 text-yellow-500" />
                        )}
                        {transaction.status === 'FAILED' && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          {transaction.status.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No transactions yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add funds to your account to get started.
                </p>
                <div className="mt-6">
                  <Button onClick={() => setShowAddFunds(true)}>Add Funds</Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}