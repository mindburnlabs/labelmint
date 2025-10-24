'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  Filter,
  Search,
  Eye,
  Edit,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  BarChart3,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@labelmint/ui';

interface Task {
  id: string;
  projectId: string;
  projectTitle: string;
  type: string;
  status: 'PENDING' | 'RESERVED' | 'LABELED' | 'COMPLETE' | 'ESCALATED';
  dataUrl: string;
  assignedWorker?: string;
  assignedWorkerName?: string;
  createdAt: string;
  updatedAt: string;
  consensusCount?: number;
  requiredVotes?: number;
}

export default function TasksPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const tasksPerPage = 20;

  useEffect(() => {
    loadTasks();
  }, [currentPage, statusFilter, typeFilter]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery]);

  const loadTasks = async () => {
    try {
      const user = await authClient.getCurrentUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // In production, this would be a real API call
      const mockTasks: Task[] = Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i + 1}`,
        projectId: `proj-${Math.floor(i / 10) + 1}`,
        projectTitle: `Project ${Math.floor(i / 10) + 1}`,
        type: ['IMG_CLS', 'TXT_CLS', 'RLHF_PAIR', 'BBOX'][i % 4],
        status: ['PENDING', 'RESERVED', 'LABELED', 'COMPLETE'][i % 4] as Task['status'],
        dataUrl: `https://example.com/task-${i + 1}`,
        assignedWorker: i % 3 === 0 ? `worker-${i}` : undefined,
        assignedWorkerName: i % 3 === 0 ? `Worker ${i}` : undefined,
        createdAt: new Date(Date.now() - (i * 3600000)).toISOString(),
        updatedAt: new Date(Date.now() - (i * 1800000)).toISOString(),
        consensusCount: i % 3 + 1,
        requiredVotes: 3,
      }));

      setTasks(mockTasks);
      setTotalTasks(mockTasks.length);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = tasks;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(task => task.type === typeFilter);
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'RESERVED':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'LABELED':
        return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'COMPLETE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ESCALATED':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'RESERVED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'LABELED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'COMPLETE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'ESCALATED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      IMG_CLS: 'Image Classification',
      TXT_CLS: 'Text Classification',
      RLHF_PAIR: 'RLHF Pair',
      BBOX: 'Bounding Box',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const handleExport = async () => {
    try {
      // Create CSV content
      const headers = ['Task ID', 'Project', 'Type', 'Status', 'Assigned Worker', 'Created', 'Updated'];
      const csvContent = [
        headers.join(','),
        ...filteredTasks.map(task => [
          task.id,
          task.projectTitle,
          task.type,
          task.status,
          task.assignedWorkerName || 'Unassigned',
          new Date(task.createdAt).toLocaleString(),
          new Date(task.updatedAt).toLocaleString(),
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Tasks exported successfully');
    } catch (error) {
      toast.error('Failed to export tasks');
    }
  };

  const totalPages = Math.ceil(totalTasks / tasksPerPage);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * tasksPerPage,
    currentPage * tasksPerPage
  );

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
              <span className="ml-4 text-sm text-gray-500">Tasks</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Link href="/dashboard">
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
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="RESERVED">Reserved</option>
              <option value="LABELED">Labeled</option>
              <option value="COMPLETE">Complete</option>
              <option value="ESCALATED">Escalated</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
            >
              <option value="all">All Types</option>
              <option value="IMG_CLS">Image Classification</option>
              <option value="TXT_CLS">Text Classification</option>
              <option value="RLHF_PAIR">RLHF Pair</option>
              <option value="BBOX">Bounding Box</option>
            </select>

            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="text-gray-500">Total:</span>
                <span className="ml-1 font-semibold">{totalTasks}</span>
              </div>
              <div>
                <span className="text-gray-500">Filtered:</span>
                <span className="ml-1 font-semibold">{filteredTasks.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tasks Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <span className="font-mono text-sm">{task.id}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/projects/${task.projectId}`}
                        className="text-primary hover:underline"
                      >
                        {task.projectTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getTypeLabel(task.type)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(task.status)}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.assignedWorkerName ? (
                        <span className="text-sm">{task.assignedWorkerName}</span>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.requiredVotes && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">
                            {task.consensusCount}/{task.requiredVotes}
                          </span>
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${(task.consensusCount! / task.requiredVotes) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link href={`/dashboard/tasks/${task.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {((currentPage - 1) * tasksPerPage) + 1} to{' '}
                {Math.min(currentPage * tasksPerPage, filteredTasks.length)} of{' '}
                {filteredTasks.length} tasks
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}