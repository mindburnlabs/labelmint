/**
 * Analytics Engine Types
 * Complete data science analytics type definitions for LabelMint
 */

// Core Analytics Types
export interface AnalyticsEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  userId?: string;
  sessionId?: string;
  organizationId?: string;
  properties: Record<string, any>;
  metadata: {
    source: string;
    version: string;
    platform: string;
    userAgent?: string;
    ip?: string;
    country?: string;
    device?: string;
  };
}

export interface BusinessMetrics {
  revenue: {
    total: number;
    recurring: number;
    oneTime: number;
    byPeriod: RevenuePeriod[];
    forecast: RevenueForecast;
  };
  users: {
    total: number;
    active: UserActivityMetrics;
    acquisition: UserAcquisitionMetrics;
    retention: UserRetentionMetrics;
    segmentation: UserSegmentationData;
  };
  projects: {
    total: number;
    active: number;
    completionRate: number;
    byType: ProjectTypeMetrics[];
    value: ProjectValueMetrics;
  };
  payments: {
    totalVolume: number;
    processedPayments: PaymentMetrics;
    failedPayments: PaymentFailureMetrics;
    fraudDetection: FraudMetrics;
  };
  operational: OperationalMetrics;
}

export interface ExecutiveDashboard {
  kpis: {
    revenue: {
      current: number;
      growth: number;
      forecast: number;
      target: number;
    };
    users: {
      total: number;
      active: number;
      growth: number;
      engagement: number;
    };
    projects: {
      total: number;
      revenue: number;
      completion: number;
      satisfaction: number;
    };
    efficiency: {
      costPerAcquisition: number;
      lifetimeValue: number;
      churnRate: number;
      operatingMargin: number;
    };
  };
  trends: {
    revenue: TimeSeriesData[];
    userGrowth: TimeSeriesData[];
    projectVolume: TimeSeriesData[];
    operationalEfficiency: TimeSeriesData[];
  };
  predictions: {
    revenue: PredictionData[];
    userGrowth: PredictionData[];
    marketExpansion: PredictionData[];
    resourceNeeds: PredictionData[];
  };
  alerts: ExecutiveAlert[];
}

export interface ProductAnalytics {
  userBehavior: {
    journeys: UserJourneyData[];
    funnels: ConversionFunnel[];
    featureAdoption: FeatureAdoptionMetrics[];
    sessionAnalytics: SessionMetrics;
  };
  performance: {
    pageViews: PageViewMetrics;
    conversionRates: ConversionMetrics;
    engagementMetrics: EngagementData;
    retentionAnalysis: RetentionAnalysis;
  };
  experimentation: {
    abTests: ABTestResults[];
    featureFlags: FeatureFlagData[];
    cohortAnalysis: CohortAnalysisData[];
    behavioralInsights: BehavioralInsight[];
  };
  optimization: {
    conversionOpportunities: ConversionOpportunity[];
    userSegmentPerformance: SegmentPerformance[];
    personalizationMetrics: PersonalizationMetrics[];
    recommendations: OptimizationRecommendation[];
  };
}

export interface OperationalAnalytics {
  systemHealth: {
    availability: AvailabilityMetrics;
    performance: PerformanceMetrics;
    capacity: CapacityMetrics;
    scalability: ScalabilityMetrics;
  };
  security: {
    incidents: SecurityIncident[];
    vulnerabilities: VulnerabilityMetrics;
    compliance: ComplianceMetrics;
    threatIntelligence: ThreatData;
  };
  infrastructure: {
    resources: ResourceUtilizationMetrics;
    costs: InfrastructureCostMetrics;
    scaling: AutoScalingMetrics;
    reliability: ReliabilityMetrics;
  };
  support: {
    tickets: SupportTicketMetrics;
    response: ResponseTimeMetrics;
    satisfaction: CustomerSatisfactionMetrics;
    escalation: EscalationMetrics;
  };
}

export interface FinancialAnalytics {
  realTimeRevenue: {
    currentPeriod: RevenuePeriod;
    transactions: TransactionMetrics;
    subscriptions: SubscriptionMetrics;
    forecasting: RealTimeForecast;
  };
  costAnalysis: {
    infrastructure: InfrastructureCosts;
    operations: OperationalCosts;
    customerAcquisition: CACMetrics;
    profitability: ProfitabilityAnalysis;
  };
  cashFlow: {
    inflows: CashFlowMetrics;
    outflows: CashFlowMetrics;
    netFlow: NetCashFlowMetrics;
    projections: CashFlowProjections;
  };
  payments: {
    processing: PaymentProcessingMetrics;
    fraud: FraudDetectionMetrics;
    methods: PaymentMethodMetrics;
    reconciliation: ReconciliationMetrics;
  };
}

export interface MLAnalytics {
  modelPerformance: {
    accuracy: ModelAccuracyMetrics;
    drift: ModelDriftMetrics;
    performance: ModelPerformanceMetrics;
    comparison: ModelComparisonMetrics;
  };
  predictions: {
    realtime: RealTimePredictionMetrics;
    batch: BatchPredictionMetrics;
    accuracy: PredictionAccuracyMetrics;
    latency: PredictionLatencyMetrics;
  };
  interpretability: {
    featureImportance: FeatureImportanceMetrics;
    explanations: ModelExplanationMetrics;
    fairness: FairnessMetrics;
    transparency: TransparencyMetrics;
  };
  automation: {
    retraining: AutomatedRetrainingMetrics;
    deployment: DeploymentMetrics;
    monitoring: ModelMonitoringMetrics;
    governance: ModelGovernanceMetrics;
  };
}

// Supporting Types
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface RevenuePeriod {
  period: string;
  revenue: number;
  growth: number;
  forecast: number;
  variance: number;
}

export interface RevenueForecast {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
  factors: ForecastFactor[];
}

export interface UserActivityMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  returning: number;
  new: number;
}

export interface UserAcquisitionMetrics {
  channels: AcquisitionChannel[];
  cost: number;
  conversion: number;
  quality: number;
}

export interface UserRetentionMetrics {
  day1: number;
  day7: number;
  day30: number;
  cohort: CohortRetentionData[];
}

export interface UserSegmentationData {
  demographics: DemographicSegment[];
  behavior: BehavioralSegment[];
  value: ValueSegment[];
  custom: CustomSegment[];
}

export interface PaymentMetrics {
  volume: number;
  count: number;
  averageValue: number;
  successRate: number;
  processingTime: number;
}

export interface OperationalMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  efficiency: number;
}

export interface ExecutiveAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'up' | 'down' | 'stable';
  actions: AlertAction[];
  createdAt: Date;
}

export interface UserJourneyData {
  journeyId: string;
  userId: string;
  steps: JourneyStep[];
  duration: number;
  completed: boolean;
  conversion: boolean;
  path: string[];
}

export interface ConversionFunnel {
  name: string;
  steps: FunnelStep[];
  overallConversion: number;
  dropoffPoints: DropoffPoint[];
  segmentPerformance: SegmentFunnelPerformance[];
}

export interface FeatureAdoptionMetrics {
  featureId: string;
  featureName: string;
  adoption: number;
  usage: FeatureUsageData[];
  satisfaction: number;
  impact: number;
}

export interface ABTestResults {
  testId: string;
  name: string;
  hypothesis: string;
  variants: TestVariant[];
  winner?: string;
  significance: number;
  impact: number;
  status: 'running' | 'completed' | 'inconclusive';
}

export interface CohortAnalysisData {
  cohort: string;
  size: number;
  retention: RetentionCurve[];
  value: CohortValueData[];
  behavior: CohortBehaviorData[];
}

export interface ModelAccuracyMetrics {
  modelId: string;
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  timestamp: Date;
}

export interface ModelDriftMetrics {
  modelId: string;
  dataDrift: number;
  conceptDrift: number;
  performanceDrift: number;
  detected: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PredictionData {
  timestamp: Date;
  predicted: number;
  actual?: number;
  confidence: number;
  factors: PredictionFactor[];
}

// Enums
export enum EventType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  BUSINESS_EVENT = 'business_event',
  PERFORMANCE_EVENT = 'performance_event',
  SECURITY_EVENT = 'security_event',
  FINANCIAL_EVENT = 'financial_event'
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TREND = 'trend',
  PREDICTION = 'prediction'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum DashboardType {
  EXECUTIVE = 'executive',
  PRODUCT = 'product',
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  ML = 'ml',
  CUSTOM = 'custom'
}

// API Response Types
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    timestamp: Date;
    requestId: string;
    processingTime: number;
    cacheHit: boolean;
  };
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Configuration Types
export interface AnalyticsConfig {
  dataRetention: {
    events: number;
    aggregates: number;
    predictions: number;
  };
  processing: {
    batchSize: number;
    concurrency: number;
    retryPolicy: RetryPolicy;
  };
  caching: {
    ttl: number;
    maxSize: number;
    strategy: 'lru' | 'fifo' | 'lfu';
  };
  monitoring: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    alertingEnabled: boolean;
  };
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
  jitter: boolean;
}

// Database Schema Types
export interface AnalyticsSchema {
  events: AnalyticsEventTable;
  metrics: MetricsTable;
  predictions: PredictionsTable;
  alerts: AlertsTable;
  dashboards: DashboardsTable;
}

export interface AnalyticsEventTable {
  id: string;
  timestamp: Date;
  event_type: string;
  user_id?: string;
  session_id?: string;
  organization_id?: string;
  properties: JSON;
  metadata: JSON;
  created_at: Date;
}

export interface MetricsTable {
  id: string;
  name: string;
  type: MetricType;
  value: number;
  labels: JSON;
  timestamp: Date;
  created_at: Date;
}

export interface PredictionsTable {
  id: string;
  model_id: string;
  prediction_type: string;
  input: JSON;
  output: JSON;
  confidence: number;
  actual_value?: number;
  created_at: Date;
}

export interface AlertsTable {
  id: string;
  type: AlertSeverity;
  title: string;
  description: string;
  metric: string;
  threshold: number;
  current_value: number;
  resolved: boolean;
  created_at: Date;
  resolved_at?: Date;
}

export interface DashboardsTable {
  id: string;
  name: string;
  type: DashboardType;
  config: JSON;
  owner_id: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}