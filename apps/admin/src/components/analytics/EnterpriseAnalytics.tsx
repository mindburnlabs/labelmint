import React, { useState } from 'react';
import { Card } from '@labelmint/ui/components/Card';
import { Button } from '@labelmint/ui/components/Button';
import { Select } from '@labelmint/ui/components/Select';
import { Badge } from '@labelmint/ui/components/Badge';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { KPICard } from '@/components/charts/KPICard';
import {
  BuildingOfficeIcon,
  CogIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface EnterpriseAnalyticsProps {
  enterpriseMetrics?: any;
  workflowMetrics?: any;
  integrationMetrics?: any;
  complianceMetrics?: any;
  isLoading?: boolean;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

export const EnterpriseAnalytics: React.FC<EnterpriseAnalyticsProps> = ({
  enterpriseMetrics,
  workflowMetrics,
  integrationMetrics,
  complianceMetrics,
  isLoading = false,
  dateRange,
  onDateRangeChange
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'integrations' | 'compliance'>('overview');

  const getTrendIcon = (trend: number) => {
    return trend > 0 ?
      <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" /> :
      <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = (trend: number) => {
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Enterprise Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Business intelligence and compliance insights for enterprise operations.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-40"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 3 months</option>
            <option value="365d">Last year</option>
          </Select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BuildingOfficeIcon },
            { id: 'workflows', label: 'Workflows', icon: CogIcon },
            { id: 'integrations', label: 'Integrations', icon: ChartBarIcon },
            { id: 'compliance', label: 'Compliance', icon: ShieldCheckIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Enterprise KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Total Organizations"
              value={enterpriseMetrics?.totalOrganizations?.toLocaleString() || '0'}
              change={enterpriseMetrics?.organizationGrowth?.[0]?.newUsers || 0}
              changeType="increase"
              icon={<BuildingOfficeIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Monthly Recurring Revenue"
              value={formatCurrency(enterpriseMetrics?.monthlyRecurringRevenue || 0)}
              change={15.3}
              changeType="increase"
              icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Customer Churn Rate"
              value={formatPercentage(enterpriseMetrics?.churnRate || 0)}
              change={-2.1}
              changeType="decrease"
              icon={<ArrowTrendingDownIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Customer Lifetime Value"
              value={formatCurrency(enterpriseMetrics?.lifetimeValue || 0)}
              change={8.7}
              changeType="increase"
              icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
            />
          </div>

          {/* Plan Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Plan Distribution
              </h3>
              <PieChart
                data={enterpriseMetrics?.planDistribution?.map((p: any) => ({
                  name: p.plan,
                  value: p.count
                })) || []}
                height={300}
                colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
              />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Organization Growth
              </h3>
              <LineChart
                data={enterpriseMetrics?.organizationGrowth || []}
                lines={[
                  {
                    dataKey: 'organizations',
                    stroke: '#3b82f6',
                    name: 'Total Organizations'
                  },
                  {
                    dataKey: 'newOrganizations',
                    stroke: '#10b981',
                    name: 'New Organizations'
                  }
                ]}
                height={300}
              />
            </Card>
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Total Workflows"
              value={workflowMetrics?.totalWorkflows?.toLocaleString() || '0'}
              change={12.5}
              changeType="increase"
              icon={<CogIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Success Rate"
              value={formatPercentage(workflowMetrics?.successRate || 0)}
              change={3.2}
              changeType="increase"
              icon={<CheckCircleIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Avg Execution Time"
              value={`${(workflowMetrics?.avgExecutionTime || 0).toFixed(1)}s`}
              change={-5.8}
              changeType="decrease"
              icon={<ArrowTrendingDownIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Error Rate"
              value={formatPercentage(workflowMetrics?.errorRate || 0)}
              change={-1.2}
              changeType="decrease"
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Workflow Execution Trends
              </h3>
              <LineChart
                data={workflowMetrics?.executionTrends || []}
                lines={[
                  {
                    dataKey: 'executions',
                    stroke: '#3b82f6',
                    name: 'Total Executions'
                  },
                  {
                    dataKey: 'successes',
                    stroke: '#10b981',
                    name: 'Successful'
                  },
                  {
                    dataKey: 'failures',
                    stroke: '#ef4444',
                    name: 'Failed'
                  }
                ]}
                height={300}
              />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Performance Bottlenecks
              </h3>
              <div className="space-y-3">
                {workflowMetrics?.performanceBottlenecks?.slice(0, 5).map((bottleneck: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {bottleneck.workflowName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {bottleneck.avgTime.toFixed(1)}s avg, {formatPercentage(bottleneck.errorRate)} error rate
                      </p>
                    </div>
                    <Badge variant={bottleneck.errorRate > 5 ? 'destructive' : 'secondary'}>
                      {bottleneck.frequency} runs
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Active Integrations"
              value={integrationMetrics?.activeIntegrations?.toLocaleString() || '0'}
              change={8.3}
              changeType="increase"
              icon={<ChartBarIcon className="h-6 w-6" />}
            />
            <KPICard
              title="API Calls Today"
              value={(integrationMetrics?.apiCallVolume?.[0]?.calls || 0).toLocaleString()}
              change={15.7}
              changeType="increase"
              icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Webhook Success Rate"
              value={formatPercentage(
                (integrationMetrics?.webhookStats?.successfulWebhooks / integrationMetrics?.webhookStats?.totalWebhooks) * 100 || 0
              )}
              change={2.1}
              changeType="increase"
              icon={<CheckCircleIcon className="h-6 w-6" />}
            />
            <KPICard
              title="Avg Delivery Time"
              value={`${(integrationMetrics?.webhookStats?.avgDeliveryTime || 0).toFixed(0)}ms`}
              change={-8.5}
              changeType="decrease"
              icon={<ArrowTrendingDownIcon className="h-6 w-6" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                API Call Volume
              </h3>
              <LineChart
                data={integrationMetrics?.apiCallVolume || []}
                lines={[
                  {
                    dataKey: 'calls',
                    stroke: '#3b82f6',
                    name: 'Total Calls'
                  },
                  {
                    dataKey: 'errors',
                    stroke: '#ef4444',
                    name: 'Errors'
                  }
                ]}
                height={300}
              />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Integrations
              </h3>
              <div className="space-y-3">
                {integrationMetrics?.topIntegrations?.map((integration: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {integration.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.type} • {integration.usage.toLocaleString()} calls
                      </p>
                    </div>
                    <Badge variant={integration.successRate > 95 ? 'default' : 'destructive'}>
                      {formatPercentage(integration.successRate)}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Overall Compliance Score"
              value={formatPercentage(complianceMetrics?.overallScore || 0)}
              change={2.3}
              changeType="increase"
              icon={<ShieldCheckIcon className="h-6 w-6" />}
            />
            <KPICard
              title="GDPR Compliance"
              value={formatPercentage(complianceMetrics?.gdprCompliance || 0)}
              change={1.8}
              changeType="increase"
              icon={<CheckCircleIcon className="h-6 w-6" />}
            />
            <KPICard
              title="SOC 2 Compliance"
              value={formatPercentage(complianceMetrics?.soc2Compliance || 0)}
              change={3.1}
              changeType="increase"
              icon={<ShieldCheckIcon className="h-6 w-6" />}
            />
            <KPICard
              title="MFA Usage"
              value={formatPercentage(complianceMetrics?.accessControl?.mfaUsage || 0)}
              change={5.2}
              changeType="increase"
              icon={<CheckCircleIcon className="h-6 w-6" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Compliance Scores
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'GDPR Compliance', value: complianceMetrics?.gdprCompliance || 0 },
                  { label: 'SOC 2 Compliance', value: complianceMetrics?.soc2Compliance || 0 },
                  { label: 'Data Retention', value: complianceMetrics?.dataRetentionScore || 0 },
                  { label: 'Security Score', value: complianceMetrics?.securityScore || 0 }
                ].map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatPercentage(item.value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.value >= 90 ? 'bg-green-500' :
                          item.value >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Audit Trail Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {complianceMetrics?.auditTrail?.totalEvents?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Events
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {complianceMetrics?.auditTrail?.criticalEvents?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Critical Events
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {complianceMetrics?.auditTrail?.resolvedEvents?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Resolved Events
                  </p>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {complianceMetrics?.auditTrail?.pendingEvents?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pending Events
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};