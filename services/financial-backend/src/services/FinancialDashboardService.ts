// ============================================================================
// COMPREHENSIVE FINANCIAL DASHBOARD AND KPI TRACKING SYSTEM
// ============================================================================

import { Logger } from '../utils/logger';

const logger = new Logger('FinancialDashboardService');

export interface FinancialDashboard {
  id: string;
  dashboard_name: string;
  dashboard_type: 'executive' | 'operational' | 'departmental' | 'investor' | 'regulatory';
  time_period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  created_by: string;
  last_updated: Date;
  kpi_sections: KPISection[];
  metrics: FinancialMetrics;
  alerts: DashboardAlert[];
  drill_down_capabilities: DrillDownCapability[];
  export_options: ExportOption[];
  access_permissions: AccessPermission[];
}

export interface KPISection {
  section_id: string;
  section_title: string;
  section_order: number;
  kpi_groups: KPIGroup[];
  visualization_type: 'cards' | 'charts' | 'tables' | 'gauges' | 'trends';
  refresh_frequency: number;
  data_sources: string[];
  is_collapsible: boolean;
  default_expanded: boolean;
}

export interface KPIGroup {
  group_id: string;
  group_title: string;
  group_order: number;
  kpis: KPI[];
  layout: 'grid' | 'list' | 'carousel';
  comparison_period?: 'previous_period' | 'previous_year' | 'budget' | 'forecast';
  target_thresholds: TargetThreshold[];
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  value: number;
  formatted_value: string;
  unit: string;
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  target: {
    value: number;
    achievement_percentage: number;
    status: 'exceeded' | 'met' | 'below_target' | 'critical';
  };
  comparison: {
    value: number;
    percentage: number;
    period: string;
  };
  visualization: {
    type: 'number' | 'gauge' | 'sparkline' | 'progress_bar' | 'traffic_light';
    color: 'green' | 'yellow' | 'red';
    icon?: string;
  };
  drill_down_available: boolean;
  last_updated: Date;
  data_quality: 'high' | 'medium' | 'low';
}

export interface TargetThreshold {
  threshold_type: 'minimum' | 'target' | 'stretch' | 'critical';
  value: number;
  color: string;
  alert_enabled: boolean;
}

export interface FinancialMetrics {
  revenue_metrics: RevenueMetrics;
  profitability_metrics: ProfitabilityMetrics;
  liquidity_metrics: LiquidityMetrics;
  efficiency_metrics: EfficiencyMetrics;
  growth_metrics: GrowthMetrics;
  cost_metrics: CostMetrics;
  cash_flow_metrics: CashFlowMetrics;
  working_capital_metrics: WorkingCapitalMetrics;
}

export interface RevenueMetrics {
  total_revenue: KPI;
  recurring_revenue: KPI;
  non_recurring_revenue: KPI;
  revenue_growth_rate: KPI;
  average_revenue_per_user: KPI;
  customer_lifetime_value: KPI;
  revenue_by_stream: Record<string, KPI>;
  revenue_by_region: Record<string, KPI>;
  revenue_by_customer_segment: Record<string, KPI>;
  monthly_recurring_revenue: KPI;
  annual_recurring_revenue: KPI;
  net_revenue_retention: KPI;
  revenue_concentration: KPI;
}

export interface ProfitabilityMetrics {
  gross_profit: KPI;
  gross_profit_margin: KPI;
  operating_profit: KPI;
  operating_profit_margin: KPI;
  net_profit: KPI;
  net_profit_margin: KPI;
  ebitda: KPI;
  ebitda_margin: KPI;
  return_on_assets: KPI;
  return_on_equity: KPI;
  return_on_invested_capital: KPI;
  contribution_margin: KPI;
  break_even_point: KPI;
}

export interface LiquidityMetrics {
  current_ratio: KPI;
  quick_ratio: KPI;
  cash_ratio: KPI;
  operating_cash_flow_ratio: KPI;
  cash_conversion_cycle: KPI;
  days_sales_outstanding: KPI;
  days_inventory_outstanding: KPI;
  days_payable_outstanding: KPI;
  working_capital_ratio: KPI;
  net_cash_position: KPI;
  cash burn_rate: KPI;
  cash runway: KPI;
}

export interface EfficiencyMetrics {
  asset_turnover: KPI;
  inventory_turnover: KPI;
  receivables_turnover: KPI;
  payables_turnover: KPI;
  operating_efficiency_ratio: KPI;
  expense_to_revenue_ratio: KPI;
  cost_per_acquisition: KPI;
  customer_acquisition_cost: KPI;
  customer_support_cost: KPI;
  automation_efficiency: KPI;
  process_cycle_time: KPI;
}

export interface GrowthMetrics {
  revenue_growth: KPI;
  customer_growth: KPI;
  user_growth: KPI;
  market_share_growth: KPI;
  product_adoption_rate: KPI;
  expansion_revenue: KPI;
  upsell_cross_sell_rate: KPI;
  net_promoter_score: KPI;
  customer_satisfaction_score: KPI;
  employee_growth: KPI;
  geographic_expansion: KPI;
}

export interface CostMetrics {
  total_costs: KPI;
  cost_of_goods_sold: KPI;
  operating_expenses: KPI;
  fixed_costs: KPI;
  variable_costs: KPI;
  cost_growth_rate: KPI;
  cost_per_transaction: KPI;
  cost_savings_achieved: KPI;
  budget_variance: KPI;
  cost_efficiency_ratio: KPI;
  overhead_rate: KPI;
}

export interface CashFlowMetrics {
  operating_cash_flow: KPI;
  investing_cash_flow: KPI;
  financing_cash_flow: KPI;
  free_cash_flow: KPI;
  cash_flow_from_operations: KPI;
  capital_expenditures: KPI;
  cash_conversion_efficiency: KPI;
  cash_flow_coverage_ratio: KPI;
  debt_service_coverage_ratio: KPI;
  dividend_payout_ratio: KPI;
  cash_flow_per_share: KPI;
}

export interface WorkingCapitalMetrics {
  working_capital: KPI;
  net_working_capital: KPI;
  working_capital_ratio: KPI;
  operating_working_capital: KPI;
  non_cash_working_capital: KPI;
  working_capital_turnover: KPI;
  working_capital_days: KPI;
  working_capital_requirement: KPI;
  working_capital_efficiency: KPI;
  seasonal_working_capital: KPI;
}

export interface DashboardAlert {
  id: string;
  alert_type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  kpi_reference: string;
  threshold_value: number;
  current_value: number;
  variance_percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_required: boolean;
  action_items: string[];
  assigned_to?: string;
  due_date?: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: Date;
  updated_at: Date;
}

export interface DrillDownCapability {
  kpi_id: string;
  drill_down_levels: DrillDownLevel[];
  available_dimensions: string[];
  filters_available: FilterOption[];
  export_formats: string[];
}

export interface DrillDownLevel {
  level_name: string;
  level_description: string;
  data_source: string;
  available_aggregations: string[];
  visualization_types: string[];
}

export interface FilterOption {
  filter_name: string;
  filter_type: 'date_range' | 'multi_select' | 'single_select' | 'text' | 'number_range';
  filter_options?: string[];
  default_value?: any;
  required: boolean;
}

export interface ExportOption {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'png';
  description: string;
  template_available: boolean;
  scheduled_export: boolean;
  include_raw_data: boolean;
}

export interface AccessPermission {
  user_role: string;
  can_view: boolean;
  can_edit: boolean;
  can_share: boolean;
  can_export: boolean;
  can_drill_down: boolean;
  restrictions: string[];
}

export interface DashboardTemplate {
  id: string;
  template_name: string;
  template_description: string;
  template_category: 'financial_overview' | 'revenue_analysis' | 'cost_management' | 'cash_flow' | 'profitability' | 'custom';
  target_audience: string[];
  kpi_sections: KPISection[];
  default_filters: FilterOption[];
  customization_options: CustomizationOption[];
  is_public: boolean;
  usage_count: number;
  rating: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CustomizationOption {
  option_name: string;
  option_type: 'boolean' | 'select' | 'multi_select' | 'text' | 'color';
  default_value: any;
  available_options?: any[];
  description: string;
}

export interface ScheduledReport {
  id: string;
  report_name: string;
  dashboard_id: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;
    timezone: string;
    day_of_week?: number;
    day_of_month?: number;
  };
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  filters: Record<string, any>;
  include_comments: boolean;
  status: 'active' | 'paused' | 'disabled';
  last_sent?: Date;
  next_send: Date;
  created_by: string;
  created_at: Date;
}

export interface DashboardAnalytics {
  dashboard_id: string;
  view_count: number;
  unique_users: number;
  average_session_duration: number;
  most_viewed_kpis: Array<{
    kpi_id: string;
    view_count: number;
    percentage_of_total: number;
  }>;
  user_engagement: {
    daily_active_users: number;
    weekly_active_users: number;
    monthly_active_users: number;
  };
  performance_metrics: {
    average_load_time: number;
    success_rate: number;
    error_count: number;
  };
  export_activity: {
    total_exports: number;
    exports_by_format: Record<string, number>;
    exports_by_user: Array<{
      user_id: string;
      export_count: number;
    }>;
  };
}

export interface KPITrend {
  kpi_id: string;
  time_period: string;
  values: Array<{
    date: Date;
    value: number;
    target?: number;
  }>;
  trend_analysis: {
    direction: 'upward' | 'downward' | 'stable' | 'volatile';
    trend_strength: 'weak' | 'moderate' | 'strong';
    seasonal_pattern: boolean;
    confidence_interval: {
      lower: number;
      upper: number;
    };
  };
  forecast: {
    method: string;
    forecast_values: Array<{
      date: Date;
      forecasted_value: number;
      confidence_level: number;
    }>;
    accuracy_metrics: {
      mape: number; // Mean Absolute Percentage Error
      mae: number;  // Mean Absolute Error
      rmse: number; // Root Mean Square Error
    };
  };
}

export class FinancialDashboardService {
  private dashboards: Map<string, FinancialDashboard> = new Map();
  private dashboardTemplates: Map<string, DashboardTemplate> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private kpiCache: Map<string, KPI> = new Map();

  constructor() {
    this.initializeDashboardTemplates();
    this.startKPIMonitoring();
  }

  /**
   * Initialize dashboard templates
   */
  private initializeDashboardTemplates(): void {
    const templates: DashboardTemplate[] = [
      {
        id: 'executive_financial_overview',
        template_name: 'Executive Financial Overview',
        template_description: 'High-level financial metrics for executive leadership',
        template_category: 'financial_overview',
        target_audience: ['CEO', 'CFO', 'Board Members', 'Investors'],
        kpi_sections: [
          {
            section_id: 'revenue_highlights',
            section_title: 'Revenue Highlights',
            section_order: 1,
            kpi_groups: [
              {
                group_id: 'revenue_summary',
                group_title: 'Revenue Summary',
                group_order: 1,
                kpis: [],
                layout: 'grid',
                comparison_period: 'previous_period',
                target_thresholds: [
                  { threshold_type: 'target', value: 1000000, color: 'green', alert_enabled: true },
                  { threshold_type: 'minimum', value: 800000, color: 'yellow', alert_enabled: true },
                  { threshold_type: 'critical', value: 600000, color: 'red', alert_enabled: true }
                ]
              }
            ],
            visualization_type: 'cards',
            refresh_frequency: 3600,
            data_sources: ['revenue_tracking', 'billing_system'],
            is_collapsible: false,
            default_expanded: true
          },
          {
            section_id: 'profitability_metrics',
            section_title: 'Profitability Metrics',
            section_order: 2,
            kpi_groups: [
              {
                group_id: 'profitability_summary',
                group_title: 'Profitability Summary',
                group_order: 1,
                kpis: [],
                layout: 'grid',
                comparison_period: 'previous_year'
              }
            ],
            visualization_type: 'gauges',
            refresh_frequency: 3600,
            data_sources: ['financial_accounting', 'cost_management'],
            is_collapsible: true,
            default_expanded: true
          },
          {
            section_id: 'cash_position',
            section_title: 'Cash Position & Liquidity',
            section_order: 3,
            kpi_groups: [
              {
                group_id: 'cash_summary',
                group_title: 'Cash Summary',
                group_order: 1,
                kpis: [],
                layout: 'list',
                comparison_period: 'previous_month'
              }
            ],
            visualization_type: 'trends',
            refresh_frequency: 1800,
            data_sources: ['treasury_management', 'bank_accounts'],
            is_collapsible: false,
            default_expanded: true
          }
        ],
        default_filters: [
          {
            filter_name: 'time_period',
            filter_type: 'multi_select',
            filter_options: ['Last 7 Days', 'Last 30 Days', 'Last Quarter', 'Year to Date'],
            default_value: 'Last 30 Days',
            required: false
          },
          {
            filter_name: 'currency',
            filter_type: 'single_select',
            filter_options: ['USD', 'EUR', 'GBP'],
            default_value: 'USD',
            required: false
          }
        ],
        customization_options: [
          {
            option_name: 'show_trends',
            option_type: 'boolean',
            default_value: true,
            description: 'Show trend indicators for all KPIs'
          },
          {
            option_name: 'comparison_period',
            option_type: 'select',
            default_value: 'previous_period',
            available_options: ['previous_period', 'previous_year', 'budget'],
            description: 'Select comparison period for KPIs'
          }
        ],
        is_public: true,
        usage_count: 0,
        rating: 5.0,
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'revenue_deep_dive',
        template_name: 'Revenue Analysis Dashboard',
        template_description: 'Detailed revenue analysis with segmentation and trends',
        template_category: 'revenue_analysis',
        target_audience: ['CFO', 'Revenue Operations', 'Sales Leadership'],
        kpi_sections: [
          {
            section_id: 'revenue_streams',
            section_title: 'Revenue Streams Analysis',
            section_order: 1,
            kpi_groups: [
              {
                group_id: 'stream_breakdown',
                group_title: 'Revenue by Stream',
                group_order: 1,
                kpis: [],
                layout: 'carousel',
                comparison_period: 'previous_period'
              }
            ],
            visualization_type: 'charts',
            refresh_frequency: 3600,
            data_sources: ['revenue_tracking', 'subscription_billing'],
            is_collapsible: false,
            default_expanded: true
          },
          {
            section_id: 'customer_metrics',
            section_title: 'Customer Revenue Metrics',
            section_order: 2,
            kpi_groups: [
              {
                group_id: 'customer_revenue',
                group_title: 'Customer Revenue Analysis',
                group_order: 1,
                kpis: [],
                layout: 'grid',
                comparison_period: 'previous_quarter'
              }
            ],
            visualization_type: 'tables',
            refresh_frequency: 7200,
            data_sources: ['crm_system', 'billing_system'],
            is_collapsible: true,
            default_expanded: true
          }
        ],
        default_filters: [
          {
            filter_name: 'date_range',
            filter_type: 'date_range',
            default_value: { start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), end: new Date() },
            required: true
          },
          {
            filter_name: 'customer_segment',
            filter_type: 'multi_select',
            filter_options: ['Enterprise', 'Mid-Market', 'SMB', 'Startup'],
            default_value: ['Enterprise', 'Mid-Market'],
            required: false
          }
        ],
        customization_options: [
          {
            option_name: 'forecast_display',
            option_type: 'select',
            default_value: 'overlay',
            available_options: ['overlay', 'separate', 'hidden'],
            description: 'How to display revenue forecasts'
          }
        ],
        is_public: true,
        usage_count: 0,
        rating: 4.8,
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    templates.forEach(template => {
      this.dashboardTemplates.set(template.id, template);
    });

    logger.info(`Initialized ${templates.length} dashboard templates`);
  }

  /**
   * Start KPI monitoring and updates
   */
  private startKPIMonitoring(): void {
    // Update real-time KPIs
    setInterval(async () => {
      await this.updateRealTimeKPIs();
    }, 60000); // Every minute

    // Update batch KPIs
    setInterval(async () => {
      await this.updateBatchKPIs();
    }, 300000); // Every 5 minutes

    // Generate dashboard alerts
    setInterval(async () => {
      await this.generateDashboardAlerts();
    }, 60000); // Every minute

    // Process scheduled reports
    setInterval(async () => {
      await this.processScheduledReports();
    }, 60000); // Every minute

    logger.info('Started KPI monitoring service');
  }

  /**
   * Create new dashboard from template
   */
  async createDashboard(
    templateId: string,
    dashboardName: string,
    createdBy: string,
    customizations: Record<string, any> = {}
  ): Promise<FinancialDashboard> {
    try {
      const template = this.dashboardTemplates.get(templateId);
      if (!template) {
        throw new Error(`Dashboard template ${templateId} not found`);
      }

      const dashboard: FinancialDashboard = {
        id: this.generateId(),
        dashboard_name,
        dashboard_type: this.getDashboardTypeFromCategory(template.template_category),
        time_period: 'monthly',
        created_by: createdBy,
        last_updated: new Date(),
        kpi_sections: JSON.parse(JSON.stringify(template.kpi_sections)), // Deep copy
        metrics: await this.generateInitialMetrics(template),
        alerts: [],
        drill_down_capabilities: await this.generateDrillDownCapabilities(template),
        export_options: [
          {
            format: 'pdf',
            description: 'Export dashboard as PDF report',
            template_available: true,
            scheduled_export: true,
            include_raw_data: false
          },
          {
            format: 'excel',
            description: 'Export data to Excel format',
            template_available: true,
            scheduled_export: true,
            include_raw_data: true
          },
          {
            format: 'csv',
            description: 'Export raw data as CSV',
            template_available: false,
            scheduled_export: false,
            include_raw_data: true
          }
        ],
        access_permissions: this.getDefaultAccessPermissions()
      };

      // Apply customizations
      await this.applyCustomizations(dashboard, template, customizations);

      // Initialize KPIs
      await this.initializeDashboardKPIs(dashboard);

      this.dashboards.set(dashboard.id, dashboard);

      logger.info(`Created dashboard ${dashboard.name} from template ${template.template_name}`);

      return dashboard;
    } catch (error) {
      logger.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(
    dashboardId: string,
    filters: Record<string, any> = {},
    refreshData: boolean = false
  ): Promise<FinancialDashboard> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      if (refreshData) {
        await this.refreshDashboardData(dashboard, filters);
      }

      // Apply filters
      const filteredDashboard = await this.applyFilters(dashboard, filters);

      // Update last accessed time
      dashboard.last_updated = new Date();

      return filteredDashboard;
    } catch (error) {
      logger.error(`Failed to get dashboard data for ${dashboardId}:`, error);
      throw error;
    }
  }

  /**
   * Update KPI values
   */
  async updateKPIs(kpiIds: string[], timeRange: { start: Date; end: Date }): Promise<KPI[]> {
    try {
      const updatedKPIs: KPI[] = [];

      for (const kpiId of kpiIds) {
        const kpi = await this.calculateKPIValue(kpiId, timeRange);
        updatedKPIs.push(kpi);
        this.kpiCache.set(kpiId, kpi);
      }

      logger.info(`Updated ${updatedKPIs.length} KPIs`);

      return updatedKPIs;
    } catch (error) {
      logger.error('Failed to update KPIs:', error);
      throw error;
    }
  }

  /**
   * Get KPI trends
   */
  async getKPITrends(
    kpiId: string,
    timeRange: { start: Date; end: Date },
    includeForecast: boolean = false
  ): Promise<KPITrend> {
    try {
      const trend = await this.calculateKPITrend(kpiId, timeRange, includeForecast);

      logger.info(`Generated KPI trend for ${kpiId}`);

      return trend;
    } catch (error) {
      logger.error(`Failed to get KPI trend for ${kpiId}:`, error);
      throw error;
    }
  }

  /**
   * Create scheduled report
   */
  async createScheduledReport(reportData: Omit<ScheduledReport, 'id' | 'next_send' | 'created_at'>): Promise<ScheduledReport> {
    try {
      const scheduledReport: ScheduledReport = {
        id: this.generateId(),
        next_send: this.calculateNextSendDate(reportData.schedule),
        created_at: new Date(),
        ...reportData
      };

      this.scheduledReports.set(scheduledReport.id, scheduledReport);

      logger.info(`Created scheduled report ${scheduledReport.report_name}`);

      return scheduledReport;
    } catch (error) {
      logger.error('Failed to create scheduled report:', error);
      throw error;
    }
  }

  /**
   * Get dashboard analytics
   */
  async getDashboardAnalytics(dashboardId: string, timeRange: { start: Date; end: Date }): Promise<DashboardAnalytics> {
    try {
      const analytics = await this.calculateDashboardAnalytics(dashboardId, timeRange);

      logger.info(`Generated analytics for dashboard ${dashboardId}`);

      return analytics;
    } catch (error) {
      logger.error(`Failed to get dashboard analytics for ${dashboardId}:`, error);
      throw error;
    }
  }

  /**
   * Export dashboard
   */
  async exportDashboard(
    dashboardId: string,
    format: 'pdf' | 'excel' | 'csv' | 'json',
    filters: Record<string, any> = {},
    includeRawData: boolean = false
  ): Promise<{
    export_id: string;
    format: string;
    file_size: number;
    download_url: string;
    expires_at: Date;
  }> {
    try {
      const dashboard = await this.getDashboardData(dashboardId, filters);

      const exportData = await this.generateExportData(dashboard, format, includeRawData);

      const exportResult = {
        export_id: this.generateId(),
        format,
        file_size: exportData.length,
        download_url: `/api/exports/${exportResult.export_id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      // Store export data temporarily
      await this.storeExportData(exportResult.export_id, exportData);

      logger.info(`Exported dashboard ${dashboardId} as ${format}`);

      return exportResult;
    } catch (error) {
      logger.error(`Failed to export dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async updateRealTimeKPIs(): Promise<void> {
    try {
      // Update real-time KPIs like cash position, active users, etc.
      const realTimeKPIIds = ['cash_position', 'active_users', 'daily_revenue'];
      await this.updateKPIs(realTimeKPIIds, {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      logger.debug('Updated real-time KPIs');
    } catch (error) {
      logger.error('Failed to update real-time KPIs:', error);
    }
  }

  private async updateBatchKPIs(): Promise<void> {
    try {
      // Update batch KPIs that don't need real-time updates
      const batchKPIIds = ['monthly_revenue', 'customer_churn', 'operating_expenses'];
      await this.updateKPIs(batchKPIIds, {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      logger.debug('Updated batch KPIs');
    } catch (error) {
      logger.error('Failed to update batch KPIs:', error);
    }
  }

  private async generateDashboardAlerts(): Promise<void> {
    try {
      // Generate alerts based on KPI thresholds
      for (const dashboard of this.dashboards.values()) {
        const alerts = await this.checkKPIThresholds(dashboard);
        dashboard.alerts = alerts;
      }

      logger.debug('Generated dashboard alerts');
    } catch (error) {
      logger.error('Failed to generate dashboard alerts:', error);
    }
  }

  private async processScheduledReports(): Promise<void> {
    try {
      const now = new Date();

      for (const report of this.scheduledReports.values()) {
        if (report.status === 'active' && report.next_send <= now) {
          await this.sendScheduledReport(report);
          report.last_sent = now;
          report.next_send = this.calculateNextSendDate(report.schedule);
        }
      }

      logger.debug('Processed scheduled reports');
    } catch (error) {
      logger.error('Failed to process scheduled reports:', error);
    }
  }

  private getDashboardTypeFromCategory(category: string): 'executive' | 'operational' | 'departmental' | 'investor' | 'regulatory' {
    switch (category) {
      case 'financial_overview':
        return 'executive';
      case 'revenue_analysis':
      case 'cost_management':
      case 'profitability':
        return 'operational';
      default:
        return 'departmental';
    }
  }

  private async generateInitialMetrics(template: DashboardTemplate): Promise<FinancialMetrics> {
    // Generate initial metrics based on template
    return {
      revenue_metrics: await this.generateRevenueMetrics(),
      profitability_metrics: await this.generateProfitabilityMetrics(),
      liquidity_metrics: await this.generateLiquidityMetrics(),
      efficiency_metrics: await this.generateEfficiencyMetrics(),
      growth_metrics: await this.generateGrowthMetrics(),
      cost_metrics: await this.generateCostMetrics(),
      cash_flow_metrics: await this.generateCashFlowMetrics(),
      working_capital_metrics: await this.generateWorkingCapitalMetrics()
    };
  }

  private async generateDrillDownCapabilities(template: DashboardTemplate): Promise<DrillDownCapability[]> {
    // Generate drill-down capabilities based on template
    return [
      {
        kpi_id: 'revenue',
        drill_down_levels: [
          {
            level_name: 'Revenue by Stream',
            level_description: 'Detailed revenue breakdown by stream',
            data_source: 'revenue_tracking',
            available_aggregations: ['sum', 'average', 'count'],
            visualization_types: ['bar', 'pie', 'line']
          },
          {
            level_name: 'Revenue by Customer',
            level_description: 'Revenue breakdown by customer segment',
            data_source: 'billing_system',
            available_aggregations: ['sum', 'average'],
            visualization_types: ['table', 'bar']
          }
        ],
        available_dimensions: ['time', 'customer_segment', 'product', 'region'],
        filters_available: [
          {
            filter_name: 'date_range',
            filter_type: 'date_range',
            required: false
          },
          {
            filter_name: 'customer_segment',
            filter_type: 'multi_select',
            required: false
          }
        ],
        export_formats: ['excel', 'csv', 'pdf']
      }
    ];
  }

  private getDefaultAccessPermissions(): AccessPermission[] {
    return [
      {
        user_role: 'executive',
        can_view: true,
        can_edit: true,
        can_share: true,
        can_export: true,
        can_drill_down: true,
        restrictions: []
      },
      {
        user_role: 'manager',
        can_view: true,
        can_edit: false,
        can_share: true,
        can_export: true,
        can_drill_down: true,
        restrictions: ['cannot_edit_kpi_thresholds']
      },
      {
        user_role: 'viewer',
        can_view: true,
        can_edit: false,
        can_share: false,
        can_export: true,
        can_drill_down: false,
        restrictions: ['read_only_access']
      }
    ];
  }

  private async applyCustomizations(dashboard: FinancialDashboard, template: DashboardTemplate, customizations: Record<string, any>): Promise<void> {
    // Apply customizations to dashboard
    for (const [key, value] of Object.entries(customizations)) {
      const option = template.customization_options.find(opt => opt.option_name === key);
      if (option) {
        // Apply customization based on option type
        switch (option.option_type) {
          case 'boolean':
            // Apply boolean customization
            break;
          case 'select':
          case 'multi_select':
            // Apply selection customization
            break;
          case 'color':
            // Apply color customization
            break;
        }
      }
    }
  }

  private async initializeDashboardKPIs(dashboard: FinancialDashboard): Promise<void> {
    // Initialize all KPIs in the dashboard
    for (const section of dashboard.kpi_sections) {
      for (const group of section.kpi_groups) {
        for (let i = 0; i < 5; i++) { // Initialize 5 KPIs per group
          const kpi = await this.createSampleKPI();
          group.kpis.push(kpi);
        }
      }
    }
  }

  private async createSampleKPI(): Promise<KPI> {
    const kpiId = this.generateId();
    return {
      id: kpiId,
      name: 'Sample KPI',
      description: 'Sample KPI description',
      value: Math.random() * 1000000,
      formatted_value: '$1,000,000',
      unit: 'USD',
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        percentage: Math.random() * 20,
        period: 'Last 30 days'
      },
      target: {
        value: 1200000,
        achievement_percentage: 83.3,
        status: 'below_target'
      },
      comparison: {
        value: 950000,
        percentage: 5.3,
        period: 'Previous period'
      },
      visualization: {
        type: 'number',
        color: 'green',
        icon: 'trending-up'
      },
      drill_down_available: true,
      last_updated: new Date(),
      data_quality: 'high'
    };
  }

  private async refreshDashboardData(dashboard: FinancialDashboard, filters: Record<string, any>): Promise<void> {
    // Refresh dashboard data based on filters
    dashboard.last_updated = new Date();
  }

  private async applyFilters(dashboard: FinancialDashboard, filters: Record<string, any>): Promise<FinancialDashboard> {
    // Apply filters to dashboard data
    return dashboard; // Return filtered dashboard
  }

  private async calculateKPIValue(kpiId: string, timeRange: { start: Date; end: Date }): Promise<KPI> {
    // Calculate KPI value for the specified time range
    return this.createSampleKPI();
  }

  private async calculateKPITrend(kpiId: string, timeRange: { start: Date; end: Date }, includeForecast: boolean): Promise<KPITrend> {
    // Calculate KPI trend
    return {
      kpi_id: kpiId,
      time_period: `${timeRange.start.toISOString()} - ${timeRange.end.toISOString()}`,
      values: [],
      trend_analysis: {
        direction: 'stable',
        trend_strength: 'moderate',
        seasonal_pattern: false,
        confidence_interval: { lower: 0, upper: 100 }
      },
      forecast: {
        method: 'linear_regression',
        forecast_values: [],
        accuracy_metrics: { mape: 0, mae: 0, rmse: 0 }
      }
    };
  }

  private calculateNextSendDate(schedule: any): Date {
    const now = new Date();
    let nextSend = new Date(now);

    switch (schedule.frequency) {
      case 'daily':
        nextSend.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextSend.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        nextSend.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        nextSend.setMonth(now.getMonth() + 3);
        break;
    }

    return nextSend;
  }

  private async sendScheduledReport(report: ScheduledReport): Promise<void> {
    // Send scheduled report to recipients
    logger.info(`Sent scheduled report ${report.report_name} to ${report.recipients.join(', ')}`);
  }

  private async calculateDashboardAnalytics(dashboardId: string, timeRange: { start: Date; end: Date }): Promise<DashboardAnalytics> {
    // Calculate dashboard analytics
    return {
      dashboard_id: dashboardId,
      view_count: 100,
      unique_users: 25,
      average_session_duration: 300,
      most_viewed_kpis: [],
      user_engagement: {
        daily_active_users: 10,
        weekly_active_users: 20,
        monthly_active_users: 25
      },
      performance_metrics: {
        average_load_time: 2.5,
        success_rate: 99.5,
        error_count: 2
      },
      export_activity: {
        total_exports: 15,
        exports_by_format: { pdf: 10, excel: 5 },
        exports_by_user: []
      }
    };
  }

  private async generateExportData(dashboard: FinancialDashboard, format: string, includeRawData: boolean): Promise<string> {
    // Generate export data based on format
    switch (format) {
      case 'json':
        return JSON.stringify(dashboard, null, 2);
      case 'csv':
        return 'CSV export data';
      case 'excel':
        return 'Excel export data';
      case 'pdf':
        return 'PDF export data';
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async storeExportData(exportId: string, data: string): Promise<void> {
    // Store export data temporarily
    logger.debug(`Stored export data for ${exportId}`);
  }

  private async checkKPIThresholds(dashboard: FinancialDashboard): Promise<DashboardAlert[]> {
    // Check KPI thresholds and generate alerts
    const alerts: DashboardAlert[] = [];

    // Example: Check revenue KPI
    const revenueKPI = dashboard.metrics.revenue_metrics.total_revenue;
    if (revenueKPI && revenueKPI.target.status === 'critical') {
      alerts.push({
        id: this.generateId(),
        alert_type: 'error',
        title: 'Revenue Below Critical Threshold',
        description: `Total revenue of ${revenueKPI.formatted_value} is below critical threshold of ${revenueKPI.target.value}`,
        kpi_reference: revenueKPI.id,
        threshold_value: revenueKPI.target.value,
        current_value: revenueKPI.value,
        variance_percentage: (1 - revenueKPI.target.achievement_percentage / 100) * 100,
        severity: 'critical',
        action_required: true,
        action_items: ['Review revenue trends', 'Identify root causes', 'Develop action plan'],
        assigned_to: 'CFO',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    return alerts;
  }

  // Placeholder methods for generating different types of metrics
  private async generateRevenueMetrics(): Promise<RevenueMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      total_revenue: kpi,
      recurring_revenue: kpi,
      non_recurring_revenue: kpi,
      revenue_growth_rate: kpi,
      average_revenue_per_user: kpi,
      customer_lifetime_value: kpi,
      revenue_by_stream: { platform_fees: kpi, subscriptions: kpi },
      revenue_by_region: { north_america: kpi, europe: kpi },
      revenue_by_customer_segment: { enterprise: kpi, smb: kpi },
      monthly_recurring_revenue: kpi,
      annual_recurring_revenue: kpi,
      net_revenue_retention: kpi,
      revenue_concentration: kpi
    };
  }

  private async generateProfitabilityMetrics(): Promise<ProfitabilityMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      gross_profit: kpi,
      gross_profit_margin: kpi,
      operating_profit: kpi,
      operating_profit_margin: kpi,
      net_profit: kpi,
      net_profit_margin: kpi,
      ebitda: kpi,
      ebitda_margin: kpi,
      return_on_assets: kpi,
      return_on_equity: kpi,
      return_on_invested_capital: kpi,
      contribution_margin: kpi,
      break_even_point: kpi
    };
  }

  private async generateLiquidityMetrics(): Promise<LiquidityMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      current_ratio: kpi,
      quick_ratio: kpi,
      cash_ratio: kpi,
      operating_cash_flow_ratio: kpi,
      cash_conversion_cycle: kpi,
      days_sales_outstanding: kpi,
      days_inventory_outstanding: kpi,
      days_payable_outstanding: kpi,
      working_capital_ratio: kpi,
      net_cash_position: kpi,
      cash_burn_rate: kpi,
      cash_runway: kpi
    };
  }

  private async generateEfficiencyMetrics(): Promise<EfficiencyMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      asset_turnover: kpi,
      inventory_turnover: kpi,
      receivables_turnover: kpi,
      payables_turnover: kpi,
      operating_efficiency_ratio: kpi,
      expense_to_revenue_ratio: kpi,
      cost_per_acquisition: kpi,
      customer_acquisition_cost: kpi,
      customer_support_cost: kpi,
      automation_efficiency: kpi,
      process_cycle_time: kpi
    };
  }

  private async generateGrowthMetrics(): Promise<GrowthMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      revenue_growth: kpi,
      customer_growth: kpi,
      user_growth: kpi,
      market_share_growth: kpi,
      product_adoption_rate: kpi,
      expansion_revenue: kpi,
      upsell_cross_sell_rate: kpi,
      net_promoter_score: kpi,
      customer_satisfaction_score: kpi,
      employee_growth: kpi,
      geographic_expansion: kpi
    };
  }

  private async generateCostMetrics(): Promise<CostMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      total_costs: kpi,
      cost_of_goods_sold: kpi,
      operating_expenses: kpi,
      fixed_costs: kpi,
      variable_costs: kpi,
      cost_growth_rate: kpi,
      cost_per_transaction: kpi,
      cost_savings_achieved: kpi,
      budget_variance: kpi,
      cost_efficiency_ratio: kpi,
      overhead_rate: kpi
    };
  }

  private async generateCashFlowMetrics(): Promise<CashFlowMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      operating_cash_flow: kpi,
      investing_cash_flow: kpi,
      financing_cash_flow: kpi,
      free_cash_flow: kpi,
      cash_flow_from_operations: kpi,
      capital_expenditures: kpi,
      cash_conversion_efficiency: kpi,
      cash_flow_coverage_ratio: kpi,
      debt_service_coverage_ratio: kpi,
      dividend_payout_ratio: kpi,
      cash_flow_per_share: kpi
    };
  }

  private async generateWorkingCapitalMetrics(): Promise<WorkingCapitalMetrics> {
    const kpi = await this.createSampleKPI();
    return {
      working_capital: kpi,
      net_working_capital: kpi,
      working_capital_ratio: kpi,
      operating_working_capital: kpi,
      non_cash_working_capital: kpi,
      working_capital_turnover: kpi,
      working_capital_days: kpi,
      working_capital_requirement: kpi,
      working_capital_efficiency: kpi,
      seasonal_working_capital: kpi
    };
  }

  private generateId(): string {
    return `DASH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}