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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Project Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor and manage all labeling projects.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
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
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filters.type || ''}
            onChange={(e) => handleFilter('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Types</option>
            <option value="image_classification">Image Classification</option>
            <option value="text_annotation">Text Annotation</option>
            <option value="data_validation">Data Validation</option>
            <option value="audio_transcription">Audio Transcription</option>
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

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
              </div>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500 dark:text-gray-400">
            No projects found
          </div>
        ) : (
          projects.map((project: Project) => (
            <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getTypeIcon(project.type)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.clientName}
                    </p>
                  </div>
                </div>
                <span className={`status-badge ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                {project.description}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Progress</p>
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-white">
                        {project.stats.completedTasks} / {project.stats.totalTasks}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {((project.stats.completedTasks / project.stats.totalTasks) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{
                          width: `${(project.stats.completedTasks / project.stats.totalTasks) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(project.budget.spent)} / {formatCurrency(project.budget.total)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {project.stats.accuracyRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Time</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {project.stats.avgTimePerTask}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Disputes</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {project.stats.disputedTasks}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Created {formatRelativeTime(project.createdAt)}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <EyeIcon className="h-4 w-4" />
                  </Button>
                  {project.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleProjectAction(project.id, 'pause')}
                    >
                      <PauseIcon className="h-4 w-4 text-yellow-600" />
                    </Button>
                  ) : project.status === 'paused' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleProjectAction(project.id, 'resume')}
                    >
                      <PlayIcon className="h-4 w-4 text-green-600" />
                    </Button>
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