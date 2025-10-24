'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { projectsApi } from '@/lib/api';
import { Project, ProjectFilters } from '@/types';
import { Button } from '@labelmint/ui/components/Button';
import { formatRelativeTime, formatCurrency } from '@labelmint/utils';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const [filters, setFilters] = useState<ProjectFilters>({
    page: 1,
    limit: 20,
    status: '',
    type: '',
    search: '',
  });

  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getProjects(filters),
  });

  const projects = projectsData?.data || [];
  const pagination = projectsData?.pagination;

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleProjectAction = async (projectId: string, action: string) => {
    try {
      if (action === 'pause') {
        await projectsApi.pauseProject(projectId);
        toast.success('Project paused successfully');
      } else if (action === 'resume') {
        await projectsApi.resumeProject(projectId);
        toast.success('Project resumed successfully');
      }
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'paused':
        return 'warning';
      case 'cancelled':
        return 'danger';
      default:
        return 'gray';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image_classification':
        return '🖼️';
      case 'text_annotation':
        return '📝';
      case 'data_validation':
        return '✅';
      case 'audio_transcription':
        return '🎵';
      default:
        return '📋';
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Project Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Monitor and manage all labeling projects.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Export Projects
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              + New Project
            </button>
          </div>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FolderIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">124</p>
              <p className="text-xs text-green-600 dark:text-green-400">+12% from last month</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <PlayIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">38</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Running now</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <PauseIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Paused</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Need attention</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Completion</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">87%</p>
              <p className="text-xs text-green-600 dark:text-green-400">+5% improvement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
          <button
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            onClick={() => setFilters({ page: 1, limit: 20, status: '', type: '', search: '' })}
          >
            Clear All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilter('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilter('type', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="image_classification">Image Classification</option>
              <option value="text_annotation">Text Annotation</option>
              <option value="data_validation">Data Validation</option>
              <option value="audio_transcription">Audio Transcription</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Progress: High to Low</option>
              <option>Progress: Low to High</option>
              <option>Budget: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No projects found</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          projects.map((project: Project) => (
            <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                    <span className="text-xl">{getTypeIcon(project.type)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.clientName}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  project.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : project.status === 'completed'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    : project.status === 'paused'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : project.status === 'cancelled'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                }`}>
                  {project.status}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                {project.description}
              </p>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Progress</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {((project.stats.completedTasks / project.stats.totalTasks) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      (project.stats.completedTasks / project.stats.totalTasks) * 100 >= 80
                        ? 'bg-green-500'
                        : (project.stats.completedTasks / project.stats.totalTasks) * 100 >= 50
                        ? 'bg-blue-500'
                        : (project.stats.completedTasks / project.stats.totalTasks) * 100 >= 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${(project.stats.completedTasks / project.stats.totalTasks) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {project.stats.completedTasks.toLocaleString()} of {project.stats.totalTasks.toLocaleString()} tasks
                </p>
              </div>

              {/* Budget */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Budget</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(project.budget.spent)} / {formatCurrency(project.budget.total)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((project.budget.spent / project.budget.total) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {project.stats.accuracyRate.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Time</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {project.stats.avgTimePerTask}s
                  </p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Disputes</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {project.stats.disputedTasks}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(project.createdAt)}
                </p>
                <div className="flex items-center space-x-1">
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  {project.status === 'active' ? (
                    <button
                      className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      onClick={() => handleProjectAction(project.id, 'pause')}
                      title="Pause project"
                    >
                      <PauseIcon className="h-4 w-4" />
                    </button>
                  ) : project.status === 'paused' ? (
                    <button
                      className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                      onClick={() => handleProjectAction(project.id, 'resume')}
                      title="Resume project"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
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
      )}
    </div>
  );
}