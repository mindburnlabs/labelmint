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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Treemap,
} from 'recharts';
import {
  Brain,
  Activity,
  Zap,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Cpu,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  Settings,
  Eye,
  Shield,
  Gauge,
  Layers,
  Database,
} from 'lucide-react';

interface MLDashboardProps {
  organizationId: string;
}

export function MLDashboard({ organizationId }: MLDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('all');

  useEffect(() => {
    fetchMLData();
  }, [organizationId, selectedPeriod, selectedModel]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMLData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, organizationId, selectedPeriod, selectedModel]);

  const fetchMLData = async () => {
    try {
      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(`/api/analytics/ml?orgId=${organizationId}&period=${selectedPeriod}&model=${selectedModel}`),
        fetch(`/api/analytics/ml/health-score?orgId=${organizationId}`)
      ]);

      const analyticsData = await analyticsResponse.json();
      const healthData = await healthResponse.json();

      setAnalytics(analyticsData.data);
      setHealthScore(healthData.data);
    } catch (error) {
      console.error('Failed to fetch ML analytics:', error);
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

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ML Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time machine learning model performance and monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Models</option>
            <option value="fraud-detection-v1">Fraud Detection</option>
            <option value="user-churn-v2">User Churn</option>
            <option value="revenue-forecast-v3">Revenue Forecast</option>
          </select>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto-refresh
          </Button>
          <Button variant="outline" onClick={fetchMLData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ML Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>ML Model Health Score</span>
            <Badge className="text-lg px-3 py-1" variant={healthScore.overall >= 85 ? "default" : "secondary"}>
              {healthScore.overall.toFixed(1)}/100
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall ML system health based on performance, accuracy, reliability, and fairness metrics
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
            {healthScore.trends.direction === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">
              {healthScore.trends.direction === 'up' ? 'Improving' : 'Declining'} from previous period ({healthScore.trends.previous.toFixed(1)})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Key ML Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Model Accuracy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(healthScore.categories.accuracy)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Average across all models</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>Top Performer</span>
                <span>{formatPercent(analytics.modelPerformance.accuracy[0]?.accuracy || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prediction Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prediction Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.predictions.realtime.predictionsPerSecond.toFixed(0)}/s</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Latency: {formatDuration(analytics.predictions.latency.averageLatency)}</span>
            </div>
            <div className="mt-2">
              <Badge variant={analytics.predictions.latency.averageLatency < 100 ? "default" : "secondary"}>
                {analytics.predictions.latency.averageLatency < 100 ? 'Optimal' : 'Needs Optimization'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Models */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.modelPerformance.accuracy.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Deployed and serving predictions</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>With Drift</span>
                <span className="text-red-600">{analytics.modelPerformance.drift.filter((d: any) => d.severity === 'high').length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resource Utilization */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resource Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.predictions.realtime.resourceUtilization.cpu.toFixed(0)}%</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Memory: {analytics.predictions.realtime.resourceUtilization.memory.toFixed(0)}%</span>
            </div>
            <div className="mt-2">
              <Progress value={analytics.predictions.realtime.resourceUtilization.cpu} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
          <TabsTrigger value="drift">Model Drift</TabsTrigger>
          <TabsTrigger value="interpretability">Interpretability</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Performance Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Model Performance Comparison</CardTitle>
                <CardDescription>Compare latency and throughput across models</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={analytics.modelPerformance.performance.map((perf: any) => ({
                    name: perf.modelName,
                    latency: perf.latency.average,
                    throughput: perf.latency.throughput,
                    accuracy: perf.availability
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="latency" name="Latency (ms)" />
                    <YAxis dataKey="throughput" name="Throughput (req/s)" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Models" dataKey="throughput" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization by Model</CardTitle>
                <CardDescription>CPU and memory usage per model</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.modelPerformance.performance.map((perf: any) => ({
                    name: perf.modelName.split(' ').slice(0, 2).join(' '),
                    cpu: perf.resource.cpu,
                    memory: perf.resource.memory / 10, // Scale for display
                    gpu: perf.resource.gpu || 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cpu" fill="#8884d8" name="CPU %" />
                    <Bar dataKey="memory" fill="#82ca9d" name="Memory (MB/10)" />
                    <Bar dataKey="gpu" fill="#ffc658" name="GPU %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Prediction Metrics */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Prediction Metrics Over Time</CardTitle>
                <CardDescription>Real-time prediction performance trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateMockPredictionMetrics()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="predictions" stroke="#8884d8" name="Predictions/s" />
                    <Line yAxisId="right" type="monotone" dataKey="latency" stroke="#82ca9d" name="Latency (ms)" />
                    <Line yAxisId="left" type="monotone" dataKey="errorRate" stroke="#ff7300" name="Error Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Accuracy Rankings */}
            <Card>
              <CardHeader>
                <CardTitle>Model Accuracy Rankings</CardTitle>
                <CardDescription>Models ranked by overall accuracy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.modelPerformance.accuracy.slice(0, 6).map((model: any, index: number) => (
                    <div key={model.modelId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{model.modelName}</p>
                          <p className="text-xs text-muted-foreground">
                            F1: {model.f1Score.toFixed(1)}% | AUC: {(model.auc * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatPercent(model.accuracy)}</p>
                        <p className="text-xs text-muted-foreground">Accuracy</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Accuracy Metrics Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Model Accuracy Metrics</CardTitle>
                <CardDescription>Multidimensional view of model performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={generateMockRadarData()}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Current" dataKey="current" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Radar name="Target" dataKey="target" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Prediction Accuracy Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Confidence Distribution</CardTitle>
                <CardDescription>Distribution of prediction confidence levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercent(analytics.predictions.accuracy.confidenceDistribution.high)}
                    </div>
                    <p className="text-sm text-muted-foreground">High Confidence</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatPercent(analytics.predictions.accuracy.confidenceDistribution.medium)}
                    </div>
                    <p className="text-sm text-muted-foreground">Medium Confidence</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {formatPercent(analytics.predictions.accuracy.confidenceDistribution.low)}
                    </div>
                    <p className="text-sm text-muted-foreground">Low Confidence</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { confidence: 'High', percentage: analytics.predictions.accuracy.confidenceDistribution.high },
                    { confidence: 'Medium', percentage: analytics.predictions.accuracy.confidenceDistribution.medium },
                    { confidence: 'Low', percentage: analytics.predictions.accuracy.confidenceDistribution.low }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="confidence" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatPercent(Number(value))} />
                    <Bar dataKey="percentage" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Model Drift Tab */}
        <TabsContent value="drift" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drift Detection Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Drift Detection Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Models with Drift</span>
                    <Badge variant="destructive">{analytics.modelPerformance.drift.filter((d: any) => d.dataDrift > 0.1).length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">High Severity Drift</span>
                    <Badge variant="destructive">{analytics.modelPerformance.drift.filter((d: any) => d.severity === 'high').length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medium Severity Drift</span>
                    <Badge variant="secondary">{analytics.modelPerformance.drift.filter((d: any) => d.severity === 'medium').length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Low Severity Drift</span>
                    <Badge variant="outline">{analytics.modelPerformance.drift.filter((d: any) => d.severity === 'low').length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Drift Events */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Drift Events</CardTitle>
                <CardDescription>Latest detected model drift incidents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.modelPerformance.drift
                    .filter((drift: any) => drift.dataDrift > 0.05)
                    .slice(0, 5)
                    .map((drift: any) => (
                      <div key={drift.modelId} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{drift.modelId}</h4>
                          <Badge variant={drift.severity === 'high' ? 'destructive' : drift.severity === 'medium' ? 'secondary' : 'outline'}>
                            {drift.severity}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Data Drift:</span>
                            <span className={`ml-1 font-medium ${getSeverityColor(drift.severity)}`}>
                              {formatPercent(drift.dataDrift)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Concept Drift:</span>
                            <span className="ml-1 font-medium">
                              {formatPercent(drift.conceptDrift)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Performance:</span>
                            <span className="ml-1 font-medium">
                              {formatPercent(drift.performanceDrift)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Detected: {new Date(drift.detected).toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Drift Trends */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Drift Trends Over Time</CardTitle>
                <CardDescription>Model drift metrics tracked over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateMockDriftData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="dataDrift" stroke="#8884d8" name="Data Drift %" />
                    <Line type="monotone" dataKey="conceptDrift" stroke="#82ca9d" name="Concept Drift %" />
                    <Line type="monotone" dataKey="performanceDrift" stroke="#ff7300" name="Performance Drift %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Interpretability Tab */}
        <TabsContent value="interpretability" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Importance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Global Feature Importance
                </CardTitle>
                <CardDescription>Most influential features across all models</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analytics.interpretability.featureImportance.globalFeatureImportance).map(([feature, importance]) => ({
                    feature: feature.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    importance: (importance as number) * 100
                  })).sort((a, b) => b.importance - a.importance).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatPercent(Number(value))} />
                    <Bar dataKey="importance" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Explanation Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Explanation Quality Metrics</CardTitle>
                <CardDescription>Performance of model explanation systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Explanation Coverage</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.interpretability.explanations.explanationCoverage)}</span>
                  </div>
                  <Progress value={analytics.interpretability.explanations.explanationCoverage} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Explanation Accuracy</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.interpretability.explanations.explanationAccuracy)}</span>
                  </div>
                  <Progress value={analytics.interpretability.explanations.explanationAccuracy} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm">User Satisfaction</span>
                    <span className="text-sm font-medium">{analytics.interpretability.explanations.userSatisfaction.toFixed(1)}/5.0</span>
                  </div>
                  <Progress value={(analytics.interpretability.explanations.userSatisfaction / 5) * 100} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Response Time</span>
                    <span className="text-sm font-medium">{formatDuration(analytics.interpretability.explanations.explanationLatency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fairness Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Fairness Assessment
                </CardTitle>
                <CardDescription>Model fairness across different dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Demographic Parity</span>
                    <Badge variant={analytics.interpretability.fairness.demographicParity > 0.85 ? "default" : "secondary"}>
                      {formatPercent(analytics.interpretability.fairness.demographicParity * 100)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Equal Opportunity</span>
                    <Badge variant={analytics.interpretability.fairness.equalOpportunity > 0.85 ? "default" : "secondary"}>
                      {formatPercent(analytics.interpretability.fairness.equalOpportunity * 100)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Equalized Odds</span>
                    <Badge variant={analytics.interpretability.fairness.equalizedOdds > 0.85 ? "default" : "secondary"}>
                      {formatPercent(analytics.interpretability.fairness.equalizedOdds * 100)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Overall Transparency</span>
                    <Badge variant={analytics.interpretability.transparency.transparencyScore > 80 ? "default" : "secondary"}>
                      {analytics.interpretability.transparency.transparencyScore.toFixed(1)}/100
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Explanation Methods Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Explanation Methods Usage</CardTitle>
                <CardDescription>Distribution of different explanation techniques</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.interpretability.explanations.explanationMethods).map(([method, usage]) => ({
                        name: method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                        value: usage as number
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(analytics.interpretability.explanations.explanationMethods).map(([,], index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Automated Retraining */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Automated Retraining
                </CardTitle>
                <CardDescription>Retraining events and performance improvements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Retraining Events</span>
                    <span className="text-sm font-medium">{analytics.automation.retraining.retrainingEvents.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Success Rate</span>
                    <Badge variant={analytics.automation.retraining.retrainingSuccess > 85 ? "default" : "secondary"}>
                      {formatPercent(analytics.automation.retraining.retrainingSuccess)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Improvement</span>
                    <span className="text-sm font-medium text-green-600">
                      +{formatPercent(analytics.automation.retraining.performanceImprovement)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Time to Retrain</span>
                    <span className="text-sm font-medium">{analytics.automation.retraining.timeToRetrain.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Cost</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.automation.retraining.retrainingCosts)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deployment Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Deployment Metrics</CardTitle>
                <CardDescription>Model deployment and rollback statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Deployments</span>
                    <span className="text-sm font-medium">{analytics.automation.deployment.deployments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Success Rate</span>
                    <Badge variant={analytics.automation.deployment.deploymentSuccess > 90 ? "default" : "secondary"}>
                      {formatPercent(analytics.automation.deployment.deploymentSuccess)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Rollback Events</span>
                    <span className="text-sm font-medium text-red-600">{analytics.automation.deployment.rollbackEvents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Deployment Time</span>
                    <span className="text-sm font-medium">{analytics.automation.deployment.deploymentTime.toFixed(0)}m</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monitoring Coverage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Monitoring Coverage
                </CardTitle>
                <CardDescription>System monitoring and alerting effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Coverage</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.automation.monitoring.monitoringCoverage)}</span>
                  </div>
                  <Progress value={analytics.automation.monitoring.monitoringCoverage} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Alert Frequency</span>
                    <span className="text-sm font-medium">{analytics.automation.monitoring.alertFrequency}/day</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm">False Positive Rate</span>
                    <span className="text-sm font-medium">{formatPercent(analytics.automation.monitoring.falsePositiveRate)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm font-medium">{analytics.automation.monitoring.responseTime}s</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Model Governance */}
            <Card>
              <CardHeader>
                <CardTitle>Model Governance</CardTitle>
                <CardDescription>Compliance and governance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Governance Score</span>
                    <Badge variant={analytics.automation.governance.governanceScore > 80 ? "default" : "secondary"}>
                      {analytics.automation.governance.governanceScore.toFixed(1)}/100
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Approvals Completed</span>
                    <span className="text-sm font-medium">{analytics.automation.governance.modelApprovals.approved}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Compliance Checks Passed</span>
                    <span className="text-sm font-medium">{analytics.automation.governance.complianceChecks.passed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Audit Trail Coverage</span>
                    <span className="text-sm font-medium">{formatPercent((analytics.automation.governance.auditTrails.loggedEvents / analytics.automation.governance.auditTrails.totalEvents) * 100)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ML Alerts */}
      {healthScore.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              ML System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthScore.alerts.map((alert: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.type}
                    </Badge>
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-muted-foreground">
                        Model: {alert.model} | {alert.metric}: {alert.currentValue.toFixed(1)} (threshold: {alert.threshold})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ML Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              ML System Recommendations
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

// Helper functions to generate mock data
function generateMockPredictionMetrics() {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    predictions: 150 + Math.random() * 100,
    latency: 50 + Math.random() * 100,
    errorRate: Math.random() * 2
  }));
}

function generateMockRadarData() {
  return [
    { metric: 'Accuracy', current: 87, target: 90 },
    { metric: 'Precision', current: 85, target: 88 },
    { metric: 'Recall', current: 89, target: 92 },
    { metric: 'F1-Score', current: 86, target: 90 },
    { metric: 'Speed', current: 78, target: 85 },
    { metric: 'Efficiency', current: 82, target: 80 }
  ];
}

function generateMockDriftData() {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    dataDrift: Math.random() * 15,
    conceptDrift: Math.random() * 12,
    performanceDrift: Math.random() * 8
  }));
}