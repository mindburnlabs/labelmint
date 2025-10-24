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
import { Button } from '@/components/ui/Button';
import { formatRelativeTime, formatCurrency } from '@/lib/utils';
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          User Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage all users, their roles, and permissions.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <select
            value={filters.role || ''}
            onChange={(e) => handleFilter('role', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Roles</option>
            <option value="client">Client</option>
            <option value="worker">Worker</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FunnelIcon className="h-4 w-4" />
              More Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary-700 dark:text-primary-300">
              {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('activate')}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Activate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkAction('suspend')}
              >
                <NoSymbolIcon className="h-4 w-4 mr-1" />
                Suspend
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={selectAllUsers}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </th>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th>Stats</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="text-center py-8">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td>
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
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
                    <td>
                      <span className={`status-badge ${
                        user.role === 'admin' ? 'info' :
                        user.role === 'client' ? 'success' : 'warning'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${
                        user.status === 'active' ? 'success' :
                        user.status === 'inactive' ? 'warning' : 'danger'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-900 dark:text-gray-100">
                      {formatRelativeTime(user.joinedAt)}
                    </td>
                    <td className="text-sm text-gray-900 dark:text-gray-100">
                      {formatRelativeTime(user.lastActiveAt)}
                    </td>
                    <td>
                      <div className="text-sm">
                        {user.role === 'worker' ? (
                          <>
                            <div className="text-gray-900 dark:text-gray-100">
                              Earned: {formatCurrency(user.stats.totalEarned || 0)}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              Tasks: {user.stats.tasksCompleted || 0}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-900 dark:text-gray-100">
                              Spent: {formatCurrency(user.stats.totalSpent || 0)}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              Projects: {user.stats.projectsCompleted || 0}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon">
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        {user.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUserAction(user.id, 'suspend')}
                          >
                            <NoSymbolIcon className="h-4 w-4 text-red-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUserAction(user.id, 'activate')}
                          >
                            <CheckIcon className="h-4 w-4 text-green-600" />
                          </Button>
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
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
                {Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}