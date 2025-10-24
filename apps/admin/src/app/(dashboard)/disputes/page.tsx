'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  UserIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { disputesApi } from '@/lib/api';
import { Dispute, DisputeFilters } from '@/types';
import { Button } from '@labelmint/ui/components/Button';
import { formatRelativeTime } from '@labelmint/utils';
import { toast } from 'sonner';

export default function DisputesPage() {
  const [filters, setFilters] = useState<DisputeFilters>({
    page: 1,
    limit: 20,
    status: '',
    priority: '',
    search: '',
  });

  const { data: disputesData, isLoading, refetch } = useQuery({
    queryKey: ['disputes', filters],
    queryFn: () => disputesApi.getDisputes(filters),
  });

  const disputes = disputesData?.data || [];
  const pagination = disputesData?.pagination;

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleAssignDispute = async (disputeId: string) => {
    try {
      await disputesApi.assignDispute(disputeId, 'current-admin-id');
      toast.success('Dispute assigned to you');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign dispute');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'investigating':
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case 'resolved':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'closed':
        return <CheckCircleIcon className="h-5 w-5 text-gray-600" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const disputeStats = [
    {
      label: 'Open Disputes',
      value: disputes.filter((d: Dispute) => d.status === 'open').length,
      color: 'text-yellow-600',
    },
    {
      label: 'Under Investigation',
      value: disputes.filter((d: Dispute) => d.status === 'investigating').length,
      color: 'text-blue-600',
    },
    {
      label: 'Resolved Today',
      value: disputes.filter((d: Dispute) =>
        d.status === 'resolved' &&
        new Date(d.updatedAt).toDateString() === new Date().toDateString()
      ).length,
      color: 'text-green-600',
    },
    {
      label: 'Urgent Cases',
      value: disputes.filter((d: Dispute) => d.priority === 'urgent').length,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dispute Resolution
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage and resolve disputes between clients and workers.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {disputeStats.map((stat, index) => (
          <div key={index} className="kpi-card">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {stat.label}
            </p>
            <p className={`text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search disputes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={filters.priority || ''}
            onChange={(e) => handleFilter('priority', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filters.type || ''}
            onChange={(e) => handleFilter('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Types</option>
            <option value="quality">Quality Issue</option>
            <option value="guidelines">Guidelines</option>
            <option value="payment">Payment</option>
            <option value="technical">Technical</option>
          </select>
        </div>
      </div>

      {/* Disputes List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))
          ) : disputes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No disputes found
            </div>
          ) : (
            disputes.map((dispute: Dispute) => (
              <div key={dispute.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(dispute.status)}
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {dispute.type.replace('_', ' ').charAt(0).toUpperCase() + dispute.type.slice(1).replace('_', ' ')} Dispute
                      </h3>
                      <span className={`status-badge ${getPriorityColor(dispute.priority)}`}>
                        {dispute.priority}
                      </span>
                      <span className="status-badge info">
                        Project #{dispute.projectId}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {dispute.description}
                    </p>

                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        <span>Worker: {dispute.workerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        <span>Client: {dispute.clientName}</span>
                      </div>
                      <div>
                        Opened {formatRelativeTime(dispute.createdAt)}
                      </div>
                      {dispute.assignedTo && (
                        <div>
                          Assigned to Admin
                        </div>
                      )}
                    </div>

                    {dispute.evidence && dispute.evidence.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Evidence: {dispute.evidence.length} item(s)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {dispute.status === 'open' && !dispute.assignedTo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignDispute(dispute.id)}
                      >
                        Assign to Me
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>

                {dispute.resolution && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>Resolution:</strong> {dispute.resolution.outcome} - {dispute.resolution.reasoning}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
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