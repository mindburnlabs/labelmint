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
  FunnelChart,
  Funnel,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sankey,
  Treemap,
} from 'recharts';
import {
  Users,
  Activity,
  Target,
  TrendingUp,
  MousePointer,
  Eye,
  Clock,
  Brain,
  Lightbulb,
  Zap,
  BarChart3,
  Funnel,
  UserCheck,
  Layers,
} from 'lucide-react';
import { ProductAnalytics } from '@/types/analytics';

interface ProductDashboardProps {
  organizationId: string;
}

export function ProductDashboard({ organizationId }: ProductDashboardProps) {
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedFunnel, setSelectedFunnel] = useState('onboarding');

  useEffect(() => {
    fetchProductAnalytics();
  }, [organizationId, selectedPeriod]);

  const fetchProductAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/product?orgId=${organizationId}&period=${selectedPeriod}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch product analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Analytics</h1>
          <p className="text-muted-foreground">
            User behavior insights and product performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchProductAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Product Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Daily Active Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.performance.engagementMetrics.dailyActiveUsers.toLocaleString()}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>12% from last week</span>
            </div>
          </CardContent>
        </Card>

        {/* Session Duration */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(analytics.userBehavior.sessionAnalytics.averageSessionDuration)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Bounce Rate: {formatPercent(analytics.userBehavior.sessionAnalytics.bounceRate)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(analytics.performance.conversionRates.overallConversionRate)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>+2.3% improvement</span>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.performance.engagementMetrics.engagementScore.toFixed(1)}/10</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Stickiness: {formatPercent(analytics.performance.engagementMetrics.stickinessFactor.dailyToWeekly * 100)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="journeys" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="journeys">User Journeys</TabsTrigger>
          <TabsTrigger value="funnels">Conversion Funnels</TabsTrigger>
          <TabsTrigger value="features">Feature Adoption</TabsTrigger>
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        {/* User Journeys Tab */}
        <TabsContent value="journeys" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Popular User Paths */}
            <Card>
              <CardHeader>
                <CardTitle>Popular User Journeys</CardTitle>
                <CardDescription>Most common paths users take through your application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.performance.pageViews.navigationPaths.slice(0, 5).map((path, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{path.path}</span>
                      </div>
                      <Badge variant="secondary">{path.count} users</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Session Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Session Analytics</CardTitle>
                <CardDescription>Session behavior and engagement patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Sessions</span>
                    <span className="font-medium">{analytics.userBehavior.sessionAnalytics.totalSessions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Duration</span>
                    <span className="font-medium">{formatDuration(analytics.userBehavior.sessionAnalytics.averageSessionDuration)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pages/Session</span>
                    <span className="font-medium">{analytics.userBehavior.sessionAnalytics.pagesPerSession.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Bounce Rate</span>
                    <span className="font-medium">{formatPercent(analytics.userBehavior.sessionAnalytics.bounceRate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Pages by Views</CardTitle>
                <CardDescription>Most visited pages in your application</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.performance.pageViews.topPages}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="path" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="views" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Conversion Funnels Tab */}
        <TabsContent value="funnels" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnels</CardTitle>
                <CardDescription>Select a funnel to analyze</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.userBehavior.funnels.map((funnel) => (
                    <Button
                      key={funnel.name}
                      variant={selectedFunnel === funnel.name ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedFunnel(funnel.name)}
                    >
                      <Funnel className="h-4 w-4 mr-2" />
                      {funnel.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Funnel Visualization */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedFunnel} Funnel
                </CardTitle>
                <CardDescription>
                  Overall conversion: {formatPercent(analytics.userBehavior.funnels.find(f => f.name === selectedFunnel)?.overallConversion || 0)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel
                      dataKey="value"
                      data={analytics.userBehavior.funnels.find(f => f.name === selectedFunnel)?.steps || []}
                      isAnimationActive
                    />
                  </FunnelChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Dropoff Analysis */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Dropoff Analysis</CardTitle>
                <CardDescription>Where users are dropping off in the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.userBehavior.funnels.find(f => f.name === selectedFunnel)?.dropoffPoints.map((point, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{point.step}</span>
                        <span className="text-sm text-muted-foreground">{formatPercent(point.dropoffRate)} dropoff</span>
                      </div>
                      <Progress value={point.dropoffRate} className="h-2" />
                      {point.reasons && (
                        <div className="text-xs text-muted-foreground">
                          Top reasons: {point.reasons.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Feature Adoption Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Adoption Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Feature Adoption Rates</CardTitle>
                <CardDescription>How quickly users adopt new features</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.userBehavior.featureAdoption}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="featureName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="adoption" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Feature Details */}
            {analytics.userBehavior.featureAdoption.slice(0, 6).map((feature) => (
              <Card key={feature.featureId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{feature.featureName}</CardTitle>
                    <Badge variant={feature.adoption > 50 ? "default" : "secondary"}>
                      {formatPercent(feature.adoption)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Adoption Rate</span>
                      <span>{formatPercent(feature.adoption)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>User Satisfaction</span>
                      <span>{feature.satisfaction.toFixed(1)}/5.0</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Business Impact</span>
                      <span className={feature.impact > 7 ? 'text-green-600' : 'text-muted-foreground'}>
                        {feature.impact.toFixed(1)}/10
                      </span>
                    </div>
                    <Progress value={feature.adoption} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Experiments Tab */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* A/B Test Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  A/B Test Results
                </CardTitle>
                <CardDescription>Latest experiment results and statistical significance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analytics.experimentation.abTests.map((test) => (
                    <div key={test.testId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{test.name}</h3>
                          <p className="text-sm text-muted-foreground">{test.hypothesis}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            test.status === 'completed' ? 'default' :
                            test.status === 'running' ? 'secondary' : 'outline'
                          }>
                            {test.status}
                          </Badge>
                          {test.winner && (
                            <p className="text-sm text-green-600 mt-1">Winner: {test.winner}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        {test.variants.map((variant) => (
                          <div key={variant.name} className="border rounded p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{variant.name}</span>
                              <span className="text-sm">{formatPercent(variant.conversionRate)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {variant.users} users, {variant.conversions} conversions
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Statistical Significance: {formatPercent(test.confidence)}</span>
                        <span>Impact: {test.impact > 0 ? '+' : ''}{test.impact}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Behavioral Insights */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Behavioral Insights
                </CardTitle>
                <CardDescription>Key insights derived from user behavior analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.experimentation.behavioralInsights.map((insight, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'secondary' : 'outline'}>
                          {insight.impact} impact
                        </Badge>
                        <span className="text-muted-foreground">Confidence: {formatPercent(insight.confidence)}</span>
                      </div>
                      <p className="text-sm mt-2 italic">💡 {insight.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Optimization Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Conversion Opportunities
                </CardTitle>
                <CardDescription>Areas with high potential for improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.optimization.conversionOpportunities.map((opportunity, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{opportunity.type}</h4>
                        <Badge variant={opportunity.priority === 'high' ? 'destructive' : 'secondary'}>
                          {opportunity.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{opportunity.description}</p>
                      <div className="flex justify-between text-xs">
                        <span>Potential Impact: +{opportunity.potentialImpact}%</span>
                        <span>Effort: {opportunity.effort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Segment Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Segment Performance
                </CardTitle>
                <CardDescription>Performance metrics by user segment</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.optimization.userSegmentPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ segment, conversionRate }) => `${segment}: ${conversionRate}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="conversionRate"
                    >
                      {analytics.optimization.userSegmentPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Personalization Metrics */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Personalization Impact</CardTitle>
                <CardDescription>Effectiveness of personalized content vs generic content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercent(analytics.optimization.personalizationMetrics.personalizedContent.engagement)}
                    </div>
                    <p className="text-sm text-muted-foreground">Personalized Engagement</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {formatPercent(analytics.optimization.personalizationMetrics.genericContent.engagement)}
                    </div>
                    <p className="text-sm text-muted-foreground">Generic Engagement</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      +{(
                        ((analytics.optimization.personalizationMetrics.personalizedContent.engagement -
                          analytics.optimization.personalizationMetrics.genericContent.engagement) /
                        analytics.optimization.personalizationMetrics.genericContent.engagement) * 100
                      ).toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">Lift</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>AI-powered recommendations for product improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.optimization.recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={rec.priority === 'High' ? 'destructive' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="flex justify-between text-xs">
                        <span>Expected Impact: {rec.expectedImpact}</span>
                        <span>Effort: {rec.implementationEffort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}