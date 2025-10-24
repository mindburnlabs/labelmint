'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  ChevronLeftIcon,
  LockClosedIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';

interface LabelMintUser {
  id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'suspended';
  daily_limit: number;
  monthly_limit: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  allowed_actions: string[];
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    telegram_username?: string;
  };
  stats?: {
    completed_tasks: number;
    success_rate: number;
  };
}

export default function LabelMintsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [labelMints, setLabelMints] = useState<LabelMintUser[]>([]);
  const [selectedLabelMint, setSelectedLabelMint] = useState<LabelMintUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDelegates();
    setupWebSocket();
  }, []);

  const setupWebSocket = async () => {
    try {
      const { websocketService } = await import('@/services/websocket');

      // Request notification permission
      await websocketService.requestNotificationPermission();

      // Listen for real-time updates
      websocketService.on('update:delegate_updated', (data: any) => {
        // Update the specific delegate in the list
        setLabelMints(prev => prev.map(delegate =>
          delegate.id === data.delegateId
            ? { ...delegate, ...data.updateDetails }
            : delegate
        ));

        // Update selected delegate if it matches
        if (selectedLabelMint && selectedLabelMint.id === data.delegateId) {
          setSelectedLabelMint(prev => prev ? { ...prev, ...data.updateDetails } : null);
        }
      });

      // Listen for notifications
      websocketService.on('notification', (notification: any) => {
        if (notification.type === 'delegate_updated') {
          // Refresh delegate list on delegate updates
          loadDelegates();
        }
      });

      // Subscribe to delegate updates
      websocketService.subscribeToUpdates(['delegates']);

    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  };

  const loadDelegates = async () => {
    try {
      // Load user from localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const currentUser = JSON.parse(userStr);
        setUser(currentUser);
      }

      // Fetch delegates from API
      const { delegatesService } = await import('@/services/delegates');
      const delegates = await delegatesService.getDelegates();

      setLabelMints(delegates);
      if (delegates.length > 0 && !selectedLabelMint) {
        setSelectedLabelMint(delegates[0]);
      }
    } catch (error: any) {
      console.error('Failed to load delegates:', error);
      // Fallback to empty state with error message
      setLabelMints([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLabelMints = labelMints.filter((labelMint) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      labelMint.user.first_name.toLowerCase().includes(searchLower) ||
      labelMint.user.last_name.toLowerCase().includes(searchLower) ||
      labelMint.user.email.toLowerCase().includes(searchLower) ||
      labelMint.status.toLowerCase().includes(searchLower)
    );
  });

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
              <span className="ml-4 text-sm text-gray-500">Team Management</span>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/labelmints/invite')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add LabelMint
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm min-h-screen">
          <nav className="mt-5 px-2">
            <Link
              href="/dashboard"
              className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeftIcon className="mr-3 h-5 w-5" />
              Back to Dashboard
            </Link>
            <Link
              href="/dashboard/labelmints"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md bg-primary/10 text-primary"
            >
              <UserGroupIcon className="mr-3 h-5 w-5" />
              LabelMints
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* LabelMints List - Left 2/3 */}
          <div className="w-2/3 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search labelMints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* LabelMints Table */}
            <div className="flex-1 overflow-auto bg-white">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        LabelMint
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Daily Limit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monthly Limit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tasks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLabelMints.map((labelMint) => (
                      <tr
                        key={labelMint.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedLabelMint?.id === labelMint.id ? 'bg-indigo-50' : ''
                        }`}
                        onClick={() => setSelectedLabelMint(labelMint)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium mr-3">
                              {labelMint.user.first_name[0]}{labelMint.user.last_name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {labelMint.user.first_name} {labelMint.user.last_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {labelMint.user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            labelMint.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : labelMint.status === 'suspended'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {labelMint.status === 'active' && (
                              <>
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                Active
                              </>
                            )}
                            {labelMint.status === 'suspended' && (
                              <>
                                <ClockIcon className="h-3 w-3 mr-1" />
                                Suspended
                              </>
                            )}
                            {labelMint.status === 'inactive' && (
                              <>
                                <XCircleIcon className="h-3 w-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${labelMint.daily_limit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${labelMint.monthly_limit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${labelMint.total_spent.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {labelMint.stats?.completed_tasks || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {labelMint.stats?.success_rate || 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('View details:', labelMint.id);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title="View details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Edit labelMint:', labelMint.id);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* LabelMint Details - Right 1/3 */}
          <div className="w-1/3 border-l border-gray-200 bg-white overflow-y-auto">
            {selectedLabelMint ? (
              <LabelMintDetails labelMint={selectedLabelMint} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <UserGroupIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No labelMint selected</p>
                  <p className="text-sm">Select a labelMint to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelMintDetails({ labelMint }: { labelMint: LabelMintUser }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'limits' | 'activity'>('overview');

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {labelMint.user.first_name} {labelMint.user.last_name}
          </h3>
          <p className="text-sm text-gray-500">{labelMint.user.email}</p>
          {labelMint.user.telegram_username && (
            <p className="text-xs text-gray-400 mt-1">{labelMint.user.telegram_username}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          labelMint.status === 'active'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {labelMint.status}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-8 mb-6">
        {['overview', 'edit', 'limits', 'activity'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`capitalize pb-1 border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Daily Limit</p>
                <p className="text-lg font-semibold">${labelMint.daily_limit}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Monthly Limit</p>
                <p className="text-lg font-semibold">${labelMint.monthly_limit}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-lg font-semibold">${labelMint.total_spent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-lg font-semibold">{labelMint.stats?.success_rate || 0}%</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tasks Completed</p>
                <p className="text-lg font-semibold">{labelMint.stats?.completed_tasks || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="text-sm">{new Date(labelMint.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Permissions</p>
              <div className="flex flex-wrap gap-1">
                {labelMint.allowed_actions.map((action) => (
                  <span
                    key={action}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {action.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  defaultValue={labelMint.user.first_name}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="First name"
                />
                <input
                  type="text"
                  defaultValue={labelMint.user.last_name}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                defaultValue={labelMint.user.email}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Email address"
              />
            </div>

            {/* Status Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                defaultValue={labelMint.status}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Permissions Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permissions
              </label>
              <div className="space-y-2">
                {['refund', 'partial_refund', 'suspend', 'edit'].map((permission) => (
                  <label key={permission} className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked={labelMint.allowed_actions.includes(permission)}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {permission.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'limits' && (
          <div className="space-y-4">
            {/* Placeholder for limits functionality */}
            <div className="text-center py-8 text-gray-500">
              <LockClosedIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No spending set</p>
              <p className="text-sm">Spending controls coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Placeholder for activity functionality */}
            <div className="text-center py-8 text-gray-500">
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm">Activity monitoring coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}