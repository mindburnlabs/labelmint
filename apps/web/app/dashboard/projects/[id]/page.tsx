'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { apiClient } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import {
  ArrowLeft,
  Play,
  Pause,
  Download,
  BarChart3,
  Clock,
  CheckCircle,
  Users,
  DollarSign,
  FileText,
  Settings,
  Eye,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Progress } from '@labelmint/ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Project {
  id: string;
  title: string;
  description?: string;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'DONE' | 'CANCELLED';
  classes: string[];
  datasetUrl?: string;
  budget: number;
  pricePerLabel: number;
  totalTasks: number;
  completedTasks: number;
  accuracy: number;
  createdAt: string;
  updatedAt: string;
}

interface ActivityData {
  time: string;
  completed: number;
  accuracy: number;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProject();
    loadActivity();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const data = await apiClient.getProject(projectId);
      setProject(data);
    } catch (error: any) {
      toast.error('Failed to load project');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivity = async () => {
    // Mock activity data
    const mockData: ActivityData[] = [
      { time: '00:00', completed: 0, accuracy: 0 },
      { time: '04:00', completed: 45, accuracy: 92 },
      { time: '08:00', completed: 120, accuracy: 94 },
      { time: '12:00', completed: 245, accuracy: 93 },
      { time: '16:00', completed: 380, accuracy: 95 },
      { time: '20:00', completed: 456, accuracy: 94 },
    ];
    setActivityData(mockData);
  };

  const handlePauseResume = async () => {
    if (!project) return;

    try {
      setRefreshing(true);
      if (project.status === 'RUNNING') {
        await apiClient.pauseProject(projectId);
        toast.success('Project paused');
      } else if (project.status === 'PAUSED') {
        await apiClient.resumeProject(projectId);
        toast.success('Project resumed');
      }
      await loadProject();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadResults = async () => {
    try {
      const downloadUrl = await apiClient.getTaskResults(projectId, 'csv');
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      toast.error('Failed to download results');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Project not found</div>
      </div>
    );
  }

  const progress = project.totalTasks > 0 ? (project.completedTasks / project.totalTasks) * 100 : 0;
  const remainingTasks = project.totalTasks - project.completedTasks;
  const spent = project.completedTasks * project.pricePerLabel * 3; // 3 judgments
  const remaining = project.budget - spent;

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
              <span className="ml-4 text-sm text-gray-500">/ Projects / {project.title}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadProject()}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/dashboard/projects">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Project Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8"
        >
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {project.title}
              </h1>
              {project.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">{project.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  {project.type.replace('_', ' ')}
                </span>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    project.status === 'RUNNING'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : project.status === 'DONE'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      : project.status === 'PAUSED'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {project.status}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              {(project.status === 'RUNNING' || project.status === 'PAUSED') && (
                <Button onClick={handlePauseResume} disabled={refreshing}>
                  {project.status === 'RUNNING' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
              )}
              {project.status === 'DONE' && (
                <Button onClick={handleDownloadResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Results
                </Button>
              )}
              <Link href={`/dashboard/projects/${projectId}/settings`}>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {project.completedTasks} / {project.totalTasks} tasks ({progress.toFixed(1)}%)
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed Tasks</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {project.completedTasks.toLocaleString()}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {(project.accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Budget Spent</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${spent.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">of ${project.budget}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Est. Completion</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {remainingTasks > 0 ? `${Math.ceil(remainingTasks / 60)}h` : 'Complete'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </motion.div>

        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Activity Today
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="completed"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Tasks Completed"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="accuracy"
                stroke="#10b981"
                strokeWidth={2}
                name="Accuracy %"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Labels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Labels
          </h2>
          <div className="flex flex-wrap gap-2">
            {project.classes.map((label, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}