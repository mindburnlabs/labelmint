'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  GaugeChart,
} from 'recharts';
import {
  Server,
  Activity,
  Shield,
  AlertTriangle,
  Users,
  DollarSign,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Cpu,
  HardDrive,
  Database,
  Globe,
  Ticket,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface OperationalDashboardProps {
  organizationId?: string;
}

export function OperationalDashboard({ organizationId }: OperationalDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchOperationalData();
  }, [organizationId, selectedPeriod]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchOperationalData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, organizationId, selectedPeriod]);

  const fetchOperationalData = async () => {
    try {
      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(`/api/analytics/operational?orgId=${organizationId}&period=${selectedPeriod}`),
        fetch(`/api/analytics/operational/health-score?orgId=${organizationId}`)
      ]);

      const analyticsData = await analyticsResponse.json();
      const healthData = await healthResponse.json();

      setAnalytics(analyticsData.data);
      setHealthScore(healthData.data);
    } catch (error) {
      console.error('Failed to fetch operational analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics || !healthScore) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreVariant = (score: number) => {
    if (score >= 90) return 'default';
    if (score >= 75) return 'secondary';
    if (score >= 60) return 'outline';
    return 'destructive';
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operational Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time system performance and infrastructure monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto-refresh
          </Button>
          <Button variant="outline" onClick={fetchOperationalData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Operational Health Score</span>
            <Badge variant={getHealthScoreVariant(healthScore.overall)} className="text-lg px-3 py-1">
              {healthScore.overall.toFixed(1)}/100
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall system health based on availability, performance, security, and support metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(healthScore.categories).map(([category, score]) => (
              <div key={category} className="text-center">
                <div className={`text-2xl font-bold ${getHealthScoreColor(score as number)}`}>
                  {(score as number).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{category}</p>
                <Progress value={score as number} className="mt-2 h-2" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${healthScore.trends.direction === 'up' ? 'text-green-500' : 'text-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {healthScore.trends.direction === 'up' ? 'Improving' : 'Declining'} from previous period ({healthScore.trends.previous.toFixed(1)})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Key System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Availability */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPercent(analytics.systemHealth.availability.uptime)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>MTTR: {formatDuration(analytics.systemHealth.availability.mttr)}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>SLA Target</span>
                <span>{formatPercent(analytics.systemHealth.availability.sla.target)}</span>
              </div>
              <Progress
                value={analytics.systemHealth.availability.sla.achieved}
                className="h-2 mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.systemHealth.performance.responseTime.average}ms</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>P95: {analytics.systemHealth.performance.responseTime.p95}ms</span>
            </div>
            <div className="mt-2">
              <Badge variant={analytics.systemHealth.performance.responseTime.average < 200 ? "default" : "secondary"}>
                {analytics.systemHealth.performance.responseTime.average < 200 ? 'Good' : 'Needs Attention'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(analytics.systemHealth.performance.errorRate.total)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>{analytics.systemHealth.performance.throughput.errors} errors</span>
            </div>
            <div className="mt-2">
              <Badge variant={analytics.systemHealth.performance.errorRate.total < 1 ? "default" : "destructive"}>
                {analytics.systemHealth.performance.errorRate.total < 1 ? 'Healthy' : 'High'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.systemHealth.capacity.current.users.toLocaleString()}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Capacity: {formatPercent((analytics.systemHealth.capacity.current.users / analytics.systemHealth.capacity.maximum.users) * 100)}</span>
            </div>
            <div className="mt-2">
              <Progress
                value={(analytics.systemHealth.capacity.current.users / analytics.systemHealth.capacity.maximum.users) * 100}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Analytics Tabs */}
      <Tabs defaultValue="infrastructure" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
        </TabsList>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>Current system resource usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="text-sm">CPU</span>
                    </div>
                    <span className="text-sm font-medium">{analytics.systemHealth.performance.resourceUtilization.cpu}%</span>
                  </div>
                  <Progress value={analytics.systemHealth.performance.resourceUtilization.cpu} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="text-sm">Memory</span>
                    </div>
                    <span className="text-sm font-medium">{analytics.systemHealth.performance.resourceUtilization.memory}%</span>
                  </div>
                  <Progress value={analytics.systemHealth.performance.resourceUtilization.memory} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      <span className="text-sm">Disk</span>
                    </div>
                    <span className="text-sm font-medium">{analytics.systemHealth.performance.resourceUtilization.disk}%</span>
                  </div>
                  <Progress value={analytics.systemHealth.performance.resourceUtilization.disk} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">Network</span>
                    </div>
                    <span className="text-sm font-medium">{analytics.systemHealth.performance.resourceUtilization.network}%</span>
                  </div>
                  <Progress value={analytics.systemHealth.performance.resourceUtilization.network} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Auto-Scaling Events */}
            <Card>
              <CardHeader>
                <CardTitle>Auto-Scaling Activity</CardTitle>
                <CardDescription>Recent scaling events and policies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Scale-up Events</span>
                    <Badge variant="outline">{analytics.systemHealth.scalability.autoScaling.scaleUpEvents}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Scale-down Events</span>
                    <Badge variant="outline">{analytics.systemHealth.scalability.autoScaling.scaleDownEvents}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Scale Time</span>
                    <span className="text-sm font-medium">{analytics.systemHealth.scalability.autoScaling.averageScaleTime}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Nodes</span>
                    <span className="text-sm font-medium">{analytics.systemHealth.scalability.elasticity.currentNodes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Min/Max Nodes</span>
                    <span className="text-sm font-medium">
                      {analytics.systemHealth.scalability.elasticity.minNodes}-{analytics.systemHealth.scalability.elasticity.maxNodes}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capacity Planning */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Capacity Planning</CardTitle>
                <CardDescription>Current usage vs. projected needs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {analytics.systemHealth.capacity.current.users.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Current Users</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.systemHealth.capacity.maximum.users.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Max Capacity</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {analytics.systemHealth.capacity.projected.users.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Projected (30d)</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatPercent((analytics.systemHealth.capacity.current.users / analytics.systemHealth.capacity.maximum.users) * 100)}
                    </div>
                    <p className="text-sm text-muted-foreground">Utilization</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Incidents</span>
                    <Badge variant={analytics.security.incidents.length > 0 ? "destructive" : "default"}>
                      {analytics.security.incidents.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Vulnerabilities</span>
                    <Badge variant={analytics.security.vulnerabilities.bySeverity.high > 0 ? "destructive" : "secondary"}>
                      {analytics.security.vulnerabilities.total}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Risk Score</span>
                    <span className="text-sm font-medium">{analytics.security.threatIntelligence.riskScore}/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Compliance Status</span>
                    <Badge variant="default">Compliant</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Security Incidents */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Security Incidents</CardTitle>
                <CardDescription>Latest security events and responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.security.incidents.slice(0, 3).map((incident: any) => (
                    <div key={incident.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{incident.title}</h4>
                        <Badge variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{incident.description}</p>
                      <div className="flex justify-between text-xs">
                        <span>Status: {incident.status}</span>
                        <span>MTTR: {incident.response.resolutionTime}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vulnerability Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Vulnerability Breakdown</CardTitle>
                <CardDescription>Distribution of security vulnerabilities by severity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Critical', value: analytics.security.vulnerabilities.bySeverity.critical, color: '#dc2626' },
                        { name: 'High', value: analytics.security.vulnerabilities.bySeverity.high, color: '#f97316' },
                        { name: 'Medium', value: analytics.security.vulnerabilities.bySeverity.medium, color: '#eab308' },
                        { name: 'Low', value: analytics.security.vulnerabilities.bySeverity.low, color: '#22c55e' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.security.vulnerabilities.bySeverity && Object.entries(analytics.security.vulnerabilities.bySeverity).map(([name, value], index) => (
                        <Cell key={`cell-${index}`} fill={
                          name === 'critical' ? '#dc2626' :
                          name === 'high' ? '#f97316' :
                          name === 'medium' ? '#eab308' : '#22c55e'
                        } />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Throughput</span>
                    <span className="text-sm font-medium">{analytics.systemHealth.performance.throughput.requests} req/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cache Hit Rate</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.systemHealth.performance.cachePerformance.hitRate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">DB Connections</span>
                    <span className="text-sm font-medium">{analytics.infrastructure.resources.database.connections}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Query Time</span>
                    <span className="text-sm font-medium">{analytics.infrastructure.resources.database.queryTime}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Response Time Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
                <CardDescription>Percentile breakdown of response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'P50', value: analytics.systemHealth.performance.responseTime.p50 },
                    { label: 'P90', value: analytics.systemHealth.performance.responseTime.p90 },
                    { label: 'P95', value: analytics.systemHealth.performance.responseTime.p95 },
                    { label: 'P99', value: analytics.systemHealth.performance.responseTime.p99 }
                  ].map((percentile) => (
                    <div key={percentile.label} className="flex justify-between items-center">
                      <span className="text-sm">{percentile.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{percentile.value}ms</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min((percentile.value / 1000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Trends */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Response time and throughput over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateMockPerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (ms)" />
                    <Line yAxisId="right" type="monotone" dataKey="throughput" stroke="#82ca9d" name="Throughput (req/s)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Support Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Support Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Open Tickets</span>
                    <Badge variant="secondary">{analytics.support.tickets.volume.open}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Response Time</span>
                    <span className="text-sm font-medium">{analytics.support.response.firstResponse.average}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Satisfaction</span>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{analytics.support.satisfaction.overall}/5.0</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Escalation Rate</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.support.escalation.rate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Satisfaction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5" />
                  Customer Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{analytics.support.satisfaction.overall}/5.0</div>
                    <p className="text-sm text-muted-foreground">Overall Satisfaction</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-medium">{analytics.support.satisfaction.nps.promoters}%</div>
                      <p className="text-xs text-muted-foreground">Promoters</p>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{analytics.support.satisfaction.nps.detractors}%</div>
                      <p className="text-xs text-muted-foreground">Detractors</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge variant="default" className="text-lg px-3 py-1">
                      NPS: {analytics.support.satisfaction.nps.score}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Categories */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tickets by Category</CardTitle>
                <CardDescription>Distribution of support tickets across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { category: 'Technical', count: analytics.support.tickets.byCategory.technical },
                    { category: 'Billing', count: analytics.support.tickets.byCategory.billing },
                    { category: 'Feature', count: analytics.support.tickets.byCategory.feature },
                    { category: 'Bug', count: analytics.support.tickets.byCategory.bug }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Monthly Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">${analytics.infrastructure.costs.total.toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground">Total Monthly Cost</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Compute</span>
                      <span className="text-sm font-medium">${analytics.infrastructure.costs.breakdown.compute.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Storage</span>
                      <span className="text-sm font-medium">${analytics.infrastructure.costs.breakdown.storage.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Network</span>
                      <span className="text-sm font-medium">${analytics.infrastructure.costs.breakdown.network.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Database</span>
                      <span className="text-sm font-medium">${analytics.infrastructure.costs.breakdown.database.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Trends</CardTitle>
                <CardDescription>Month-over-month cost changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Month</span>
                    <span className="text-sm font-medium">${analytics.infrastructure.costs.trends.currentMonth.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Previous Month</span>
                    <span className="text-sm font-medium">${analytics.infrastructure.costs.trends.previousMonth.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">YoY Change</span>
                    <Badge variant={analytics.infrastructure.costs.trends.yearOverYear > 0 ? "destructive" : "default"}>
                      +{analytics.infrastructure.costs.trends.yearOverYear}%
                    </Badge>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Potential Savings</p>
                    <p className="text-lg font-bold text-green-600">${analytics.infrastructure.costs.optimization.potentialSavings.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Optimization Recommendations */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>AI-powered cost optimization suggestions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.infrastructure.costs.optimization.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Operational Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Operational Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healthScore.recommendations.map((rec: string, index: number) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to generate mock performance data
function generateMockPerformanceData() {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({
      time: `${i}:00`,
      responseTime: Math.floor(Math.random() * 200) + 100,
      throughput: Math.floor(Math.random() * 500) + 1000
    });
  }
  return data;
}