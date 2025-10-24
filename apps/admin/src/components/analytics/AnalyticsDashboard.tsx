'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  FileText,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { HeatMap } from '@/components/charts/HeatMap';

interface AnalyticsFilters {
  dateRange: '7d' | '30d' | '90d' | '1y';
  projectType: string;
  userRole: 'all' | 'clients' | 'workers';
}

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: '30d',
    projectType: 'all',
    userRole: 'all',
  });

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['analytics', filters],
    queryFn: () => dashboardApi.getAnalytics(filters),
    refetchInterval: 60000, // Refresh every minute
  });

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const data = await dashboardApi.exportAnalytics({ ...filters, format });
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${filters.dateRange}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const metrics = useMemo(() => {
    if (!analytics) return null;

    return {
      totalRevenue: analytics.revenue.reduce((sum, r) => sum + r.value, 0),
      avgSessionDuration: analytics.userActivity.reduce((sum, a) => sum + a.duration, 0) / analytics.userActivity.length,
      completionRate: (analytics.completedTasks / analytics.totalTasks * 100).toFixed(1),
      activeUsers: analytics.users.filter(u => u.lastActive > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    };
  }, [analytics]);

  return (
    <div className="space-y-6">
      {/* Filters and Export */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value as any }))}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </Select>

            <Select
              value={filters.projectType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, projectType: value }))}
            >
              <option value="all">All Projects</option>
              <option value="image_classification">Image Classification</option>
              <option value="text_annotation">Text Annotation</option>
              <option value="transcription">Transcription</option>
              <option value="rlhf">RLHF</option>
            </Select>

            <Select
              value={filters.userRole}
              onValueChange={(value) => setFilters(prev => ({ ...prev, userRole: value as any }))}
            >
              <option value="all">All Users</option>
              <option value="clients">Clients</option>
              <option value="workers">Workers</option>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${metrics?.totalRevenue.toLocaleString() || '0'}`}
          change={12.5}
          icon={<DollarSign className="h-5 w-5" />}
          trend="up"
        />
        <MetricCard
          title="Active Users"
          value={metrics?.activeUsers.toLocaleString() || '0'}
          change={8.2}
          icon={<Users className="h-5 w-5" />}
          trend="up"
        />
        <MetricCard
          title="Completion Rate"
          value={`${metrics?.completionRate || '0'}%`}
          change={2.4}
          icon={<Activity className="h-5 w-5" />}
          trend="up"
        />
        <MetricCard
          title="Avg Session Duration"
          value={`${Math.round(metrics?.avgSessionDuration || 0)}m`}
          change={-5.1}
          icon={<Calendar className="h-5 w-5" />}
          trend="down"
        />
      </div>

      {/* Revenue Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
        <LineChart
          data={analytics?.revenue || []}
          lines={[{ dataKey: 'value', stroke: '#3b82f6', name: 'Revenue' }]}
          height={300}
        />
      </Card>

      {/* Project Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Projects by Type</h3>
          <PieChart
            data={analytics?.projectTypes || []}
            height={300}
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">User Activity Heatmap</h3>
          <HeatMap
            data={analytics?.activityHeatmap || []}
            height={300}
          />
        </Card>
      </div>

      {/* Top Performers */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Workers</h3>
        <div className="space-y-4">
          {analytics?.topWorkers?.slice(0, 10).map((worker, index) => (
            <div key={worker.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline">#{index + 1}</Badge>
                <div>
                  <p className="font-medium">{worker.name}</p>
                  <p className="text-sm text-gray-500">{worker.tasksCompleted} tasks</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">${worker.earnings.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{worker.accuracy}% accuracy</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down';
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <div className={`flex items-center gap-1 mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-4 w-4 ${trend === 'down' ? 'rotate-180' : ''}`} />
            <span className="text-sm">{Math.abs(change)}%</span>
          </div>
        </div>
        <div className="text-gray-400">
          {icon}
        </div>
      </div>
    </Card>
  );
}