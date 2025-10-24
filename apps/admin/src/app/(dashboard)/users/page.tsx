'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  NoSymbolIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { usersApi } from '@/lib/api';
import { User, UserFilters } from '@/types';
import { Button } from '@labelmint/ui/components/Button';
import { formatRelativeTime, formatCurrency, debounce } from '@labelmint/utils';
import { toast } from 'sonner';

export default function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 20,
    role: '',
    status: '',
    search: '',
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => usersApi.getUsers(filters),
  });

  const users = usersData?.data || [];
  const pagination = usersData?.pagination;

  const handleSearch = debounce((value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  }, 500);

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleUserAction = async (userId: string, action: string, reason?: string) => {
    try {
      if (action === 'suspend') {
        await usersApi.suspendUser(userId, reason || 'Admin action');
        toast.success('User suspended successfully');
      } else if (action === 'activate') {
        await usersApi.activateUser(userId);
        toast.success('User activated successfully');
      }
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first');
      return;
    }

    try {
      await usersApi.bulkAction(selectedUsers, action);
      toast.success(`Bulk ${action} completed`);
      setSelectedUsers([]);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Bulk action failed');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u: User) => u.id));
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage all users, their roles, and permissions.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Export Users
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              + Add User
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* User Stats Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">2,847</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">2,156</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <NoSymbolIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Suspended</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">47</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
          <button
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            onClick={() => setFilters({ page: 1, limit: 20, role: '', status: '', search: '' })}
          >
            Clear All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select
              value={filters.role || ''}
              onChange={(e) => handleFilter('role', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              <option value="client">Client</option>
              <option value="worker">Worker</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilter('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Join Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Last Active</option>
              <option>Most Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {selectedUsers.length}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Choose an action to apply to all selected users
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('activate')}
                className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
              >
                <CheckIcon className="h-3 w-3 mr-1 inline" />
                Activate
              </button>
              <button
                onClick={() => handleBulkAction('suspend')}
                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
              >
                <NoSymbolIcon className="h-3 w-3 mr-1 inline" />
                Suspend
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={selectAllUsers}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        <div className="ml-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <UsersIcon className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No users found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Try adjusting your search or filter criteria
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.profile.firstName[0]}{user.profile.lastName[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.profile.firstName} {user.profile.lastName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          : user.role === 'client'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : user.status === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formatRelativeTime(user.joinedAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formatRelativeTime(user.lastActiveAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {user.role === 'worker' ? (
                          <>
                            <div className="text-gray-900 dark:text-gray-100 font-medium">
                              ${user.stats.totalEarned || 0}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {user.stats.tasksCompleted || 0} tasks
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-900 dark:text-gray-100 font-medium">
                              ${user.stats.totalSpent || 0}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {user.stats.projectsCompleted || 0} projects
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {user.status === 'active' ? (
                          <button
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            onClick={() => handleUserAction(user.id, 'suspend')}
                            title="Suspend user"
                          >
                            <NoSymbolIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                            onClick={() => handleUserAction(user.id, 'activate')}
                            title="Activate user"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{((filters.page || 1) - 1) * (filters.limit || 20) + 1}</span> to{' '}
                <span className="font-medium">{Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="hidden md:flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    const isCurrent = pageNum === (filters.page || 1);
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setFilters(prev => ({ ...prev, page: pageNum }))}
                        className={`relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={!pagination.hasNextPage}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

