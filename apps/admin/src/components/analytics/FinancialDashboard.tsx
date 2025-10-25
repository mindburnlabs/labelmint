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
  ComposedChart,
  Scatter,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Activity,
  Target,
  AlertCircle,
  Zap,
  Shield,
  Clock,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Receipt,
  CreditCardIcon,
  BanknoteIcon,
  Wallet,
  RefreshCw,
} from 'lucide-react';

interface FinancialDashboardProps {
  organizationId: string;
}

export function FinancialDashboard({ organizationId }: FinancialDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [realTimeMode, setRealTimeMode] = useState(false);

  useEffect(() => {
    fetchFinancialData();
  }, [organizationId, selectedPeriod]);

  useEffect(() => {
    if (realTimeMode) {
      const interval = setInterval(fetchFinancialData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [realTimeMode, organizationId, selectedPeriod]);

  const fetchFinancialData = async () => {
    try {
      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(`/api/analytics/financial?orgId=${organizationId}&period=${selectedPeriod}`),
        fetch(`/api/analytics/financial/health-score?orgId=${organizationId}`)
      ]);

      const analyticsData = await analyticsResponse.json();
      const healthData = await healthResponse.json();

      setAnalytics(analyticsData.data);
      setHealthScore(healthData.data);
    } catch (error) {
      console.error('Failed to fetch financial analytics:', error);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 55) return 'text-orange-600';
    return 'text-red-600';
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Analytics</h1>
          <p className="text-muted-foreground">
            Real-time revenue metrics and financial performance insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={realTimeMode ? "default" : "outline"}
            onClick={() => setRealTimeMode(!realTimeMode)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Real-time
          </Button>
          <Button variant="outline" onClick={fetchFinancialData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Receipt className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Financial Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Financial Health Score</span>
            <Badge className="text-lg px-3 py-1" variant={healthScore.overall >= 80 ? "default" : "secondary"}>
              {healthScore.overall.toFixed(1)}/100
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall financial health based on revenue, profitability, cash flow, and efficiency metrics
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
            {getTrendIcon(healthScore.trends.current - healthScore.trends.previous)}
            <span className="text-sm text-muted-foreground">
              {healthScore.trends.direction === 'up' ? 'Improving' : 'Declining'} from previous period ({healthScore.trends.previous.toFixed(1)})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Key Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.realTimeRevenue.currentPeriod.revenue)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {getTrendIcon(analytics.realTimeRevenue.currentPeriod.growth)}
              <span>{formatPercent(analytics.realTimeRevenue.currentPeriod.growth)} growth</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>Forecast: {formatCurrency(analytics.realTimeRevenue.currentPeriod.forecast)}</span>
                <span>{Math.round((analytics.realTimeRevenue.currentPeriod.revenue / analytics.realTimeRevenue.currentPeriod.forecast) * 100)}%</span>
              </div>
              <Progress
                value={(analytics.realTimeRevenue.currentPeriod.revenue / analytics.realTimeRevenue.currentPeriod.forecast) * 100}
                className="h-2 mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.realTimeRevenue.subscriptions.active.toLocaleString()}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>ARR: {formatCurrency(analytics.realTimeRevenue.subscriptions.arr)}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>New this month</span>
                <span className="text-green-600">+{analytics.realTimeRevenue.subscriptions.new}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Churned</span>
                <span className="text-red-600">-{analytics.realTimeRevenue.subscriptions.churned}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Volume */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Volume</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.realTimeRevenue.transactions.volume)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>{analytics.realTimeRevenue.transactions.count} transactions</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>Success Rate</span>
                <Badge variant={analytics.realTimeRevenue.transactions.successRate > 95 ? "default" : "secondary"}>
                  {formatPercent(analytics.realTimeRevenue.transactions.successRate)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Position */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.cashFlow.netFlow.cashPosition)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Runway: {analytics.cashFlow.netFlow.runway} months</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs">
                <span>Net Flow</span>
                <span className={analytics.cashFlow.netFlow.netFlow > 0 ? 'text-green-600' : 'text-red-600'}>
                  {analytics.cashFlow.netFlow.netFlow > 0 ? '+' : ''}{formatCurrency(analytics.cashFlow.netFlow.netFlow)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Streams */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Streams</CardTitle>
                <CardDescription>Breakdown of revenue by source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Subscriptions', value: 45000 },
                        { name: 'Transactions', value: 15000 },
                        { name: 'Services', value: 8000 },
                        { name: 'Other', value: 2000 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries({ subscriptions: 45000, transactions: 15000, services: 8000, other: 2000 }).map(([name, value], index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Subscription Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Metrics</CardTitle>
                <CardDescription>Key subscription performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Monthly Recurring Revenue</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.realTimeRevenue.subscriptions.mrr)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Annual Recurring Revenue</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.realTimeRevenue.subscriptions.arr)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Revenue Per User</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.realTimeRevenue.subscriptions.averageRevenuePerUser)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Lifetime Value</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.realTimeRevenue.subscriptions.customerLifetimeValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Churn Rate</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatPercent((analytics.realTimeRevenue.subscriptions.churned / analytics.realTimeRevenue.subscriptions.active) * 100)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Trends */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Revenue performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={generateMockRevenueData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Operating costs by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { category: 'Infrastructure', cost: analytics.costAnalysis.infrastructure.compute + analytics.costAnalysis.infrastructure.storage + analytics.costAnalysis.infrastructure.network + analytics.costAnalysis.infrastructure.database },
                    { category: 'Personnel', cost: analytics.costAnalysis.operations.personnel },
                    { category: 'Marketing', cost: analytics.costAnalysis.operations.marketing },
                    { category: 'Sales', cost: analytics.costAnalysis.operations.sales },
                    { category: 'Support', cost: analytics.costAnalysis.operations.support },
                    { category: 'General', cost: analytics.costAnalysis.operations.general }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="cost" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Profitability Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Profitability Metrics</CardTitle>
                <CardDescription>Key profitability indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Gross Profit</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.costAnalysis.profitability.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Operating Profit</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.costAnalysis.profitability.operatingProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Net Profit</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.costAnalysis.profitability.netProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">EBITDA</span>
                    <span className="text-sm font-medium">{formatCurrency(analytics.costAnalysis.profitability.ebitda)}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Operating Margin</span>
                      <Badge variant={analytics.costAnalysis.profitability.margins.operating > 20 ? "default" : "secondary"}>
                        {formatPercent(analytics.costAnalysis.profitability.margins.operating)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Acquisition Costs */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Customer Acquisition Costs</CardTitle>
                <CardDescription>CAC metrics by channel and efficiency ratios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(analytics.costAnalysis.customerAcquisition.totalCAC)}</div>
                    <p className="text-sm text-muted-foreground">Total CAC</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analytics.costAnalysis.customerAcquisition.ltvRatio.toFixed(1)}x</div>
                    <p className="text-sm text-muted-foreground">LTV/CAC Ratio</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analytics.costAnalysis.customerAcquisition.paybackPeriod}m</div>
                    <p className="text-sm text-muted-foreground">Payback Period</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{formatCurrency(analytics.costAnalysis.customerAcquisition.blendedCAC)}</div>
                    <p className="text-sm text-muted-foreground">Blended CAC</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={Object.entries(analytics.costAnalysis.customerAcquisition.byChannel).map(([channel, cac]) => ({ channel, cac }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="cac" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Flow Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Summary</CardTitle>
                <CardDescription>Monthly cash flow breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Inflows</span>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(Object.values(analytics.cashFlow.inflows).reduce((sum, amount) => sum + amount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Outflows</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatCurrency(Object.values(analytics.cashFlow.outflows).reduce((sum, amount) => sum + amount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Net Cash Flow</span>
                    <span className={`text-sm font-bold ${analytics.cashFlow.netFlow.netFlow > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analytics.cashFlow.netFlow.netFlow > 0 ? '+' : ''}{formatCurrency(analytics.cashFlow.netFlow.netFlow)}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Cash Runway</span>
                      <Badge variant={analytics.cashFlow.netFlow.runway > 12 ? "default" : "destructive"}>
                        {analytics.cashFlow.netFlow.runway} months
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow by Category</CardTitle>
                <CardDescription>Net flow by operational category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analytics.cashFlow.netFlow.flowByCategory).map(([category, flow]) => ({ category, flow }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="flow" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash Flow Projections */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Projections</CardTitle>
            <CardDescription>Projected cash flow under different scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.cashFlow.projections.scenarios.optimistic)}
                </div>
                <p className="text-sm text-muted-foreground">Optimistic (90d)</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(analytics.cashFlow.projections.scenarios.realistic)}
                </div>
                <p className="text-sm text-muted-foreground">Realistic (90d)</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(analytics.cashFlow.projections.scenarios.pessimistic)}
                </div>
                <p className="text-sm text-muted-foreground">Pessimistic (90d)</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={generateMockCashFlowData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="optimistic" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="realistic" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="pessimistic" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    {/* Payments Tab */}
    <TabsContent value="payments" className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5" />
              Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Processed</span>
                <span className="text-sm font-medium">{formatCurrency(analytics.payments.processing.totalProcessed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Success Rate</span>
                <Badge variant={analytics.payments.processing.successRate > 95 ? "default" : "secondary"}>
                  {formatPercent(analytics.payments.processing.successRate)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Processing Fees</span>
                <span className="text-sm font-medium">{formatCurrency(analytics.payments.processing.fees)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Processing Time</span>
                <span className="text-sm font-medium">{analytics.payments.processing.averageProcessingTime}s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Credit Card', value: analytics.payments.methods.creditCard.usage },
                    { name: 'Bank Transfer', value: analytics.payments.methods.bankTransfer.usage },
                    { name: 'Cryptocurrency', value: analytics.payments.methods.cryptocurrency.usage }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#8884d8" />
                  <Cell fill="#82ca9d" />
                  <Cell fill="#ffc658" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fraud Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Fraud Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Blocked Transactions</span>
                <span className="text-sm font-medium">{analytics.payments.fraud.blockedTransactions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Detection Rate</span>
                <Badge variant="default">{formatPercent(analytics.payments.fraud.detectionRate)}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">False Positives</span>
                <span className="text-sm font-medium">{analytics.payments.fraud.falsePositives}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cost Savings</span>
                <span className="text-sm font-medium text-green-600">{formatCurrency(analytics.payments.fraud.costSavings)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BanknoteIcon className="h-5 w-5" />
              Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Reconciled Transactions</span>
                <span className="text-sm font-medium">{analytics.payments.reconciliation.reconciledTransactions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Pending Reconciliation</span>
                <span className="text-sm font-medium">{analytics.payments.reconciliation.pendingReconciliation}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Discrepancies</span>
                <span className="text-sm font-medium text-red-600">{analytics.payments.reconciliation.discrepancies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Auto-Reconciliation Rate</span>
                <Badge variant={analytics.payments.reconciliation.autoReconciliationRate > 95 ? "default" : "secondary"}>
                  {formatPercent(analytics.payments.reconciliation.autoReconciliationRate)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    {/* Forecasting Tab */}
    <TabsContent value="forecasting" className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Forecasts */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Forecasts</CardTitle>
            <CardDescription>Real-time revenue predictions with confidence intervals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { period: 'Next Hour', value: analytics.realTimeRevenue.forecasting.nextHour, confidence: analytics.realTimeRevenue.forecasting.confidence.nextHour },
                { period: 'Next Day', value: analytics.realTimeRevenue.forecasting.nextDay, confidence: analytics.realTimeRevenue.forecasting.confidence.nextDay },
                { period: 'Next Week', value: analytics.realTimeRevenue.forecasting.nextWeek, confidence: analytics.realTimeRevenue.forecasting.confidence.nextWeek },
                { period: 'Next Month', value: analytics.realTimeRevenue.forecasting.nextMonth, confidence: analytics.realTimeRevenue.forecasting.confidence.nextMonth }
              ].map((forecast) => (
                <div key={forecast.period} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{forecast.period}</p>
                    <p className="text-sm text-muted-foreground">Confidence: {formatPercent(forecast.confidence)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(forecast.value)}</p>
                    <Progress value={forecast.confidence} className="h-2 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trends with Forecast */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trends with Forecast</CardTitle>
            <CardDescription>Historical revenue data with future projections</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={generateMockRevenueForecastData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area type="monotone" dataKey="actual" fill="#8884d8" stroke="#8884d8" fillOpacity={0.6} />
                <Line type="monotone" dataKey="forecast" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="upperBound" stroke="#ffc658" strokeWidth={1} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="lowerBound" stroke="#ff7300" strokeWidth={1} strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  </Tabs>

  {/* Financial Alerts */}
  {healthScore.alerts.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Financial Alerts
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
                  <p className="text-sm text-muted-foreground">{alert.metric}: {alert.currentValue} (threshold: {alert.threshold})</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )}

  {/* Financial Recommendations */}
  {healthScore.recommendations.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Financial Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {healthScore.recommendations.map((rec: string, index: number) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
              <Target className="h-4 w-4 text-blue-500" />
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
function generateMockRevenueData() {
  return [
    { month: 'Jan', revenue: 55000 },
    { month: 'Feb', revenue: 58000 },
    { month: 'Mar', revenue: 62000 },
    { month: 'Apr', revenue: 65000 },
    { month: 'May', revenue: 68000 },
    { month: 'Jun', revenue: 70000 }
  ];
}

function generateMockCashFlowData() {
  return [
    { month: 'Month 1', optimistic: 50000, realistic: 30000, pessimistic: 10000 },
    { month: 'Month 2', optimistic: 55000, realistic: 32000, pessimistic: 8000 },
    { month: 'Month 3', optimistic: 60000, realistic: 35000, pessimimal: 5000 }
  ];
}

function generateMockRevenueForecastData() {
  const actualData = [
    { month: 'Jan', actual: 55000 },
    { month: 'Feb', actual: 58000 },
    { month: 'Mar', actual: 62000 },
    { month: 'Apr', actual: 65000 },
    { month: 'May', actual: 68000 },
    { month: 'Jun', actual: 70000 }
  ];

  const forecastData = [
    { month: 'Jul', forecast: 73000, upperBound: 78000, lowerBound: 68000 },
    { month: 'Aug', forecast: 76000, upperBound: 82000, lowerBound: 70000 },
    { month: 'Sep', forecast: 79000, upperBound: 86000, lowerBound: 72000 }
  ];

  return [...actualData, ...forecastData];
}