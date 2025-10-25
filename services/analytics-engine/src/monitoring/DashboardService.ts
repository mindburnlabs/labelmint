/**
 * Dashboard Service
 * Real-time dashboard generation and management
 */

import {
  MonitoringDashboard,
  DashboardPanel,
  Alert,
  AnalyticsApiResponse,
  ExecutiveDashboard,
  ProductAnalytics,
  OperationalAnalytics,
  FinancialAnalytics,
  MLAnalytics
} from '../types/analytics.types';
import { AlertingSystem } from './AlertingSystem';
import { getGlobalMetrics } from '@shared/observability/metrics';

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  category: 'executive' | 'product' | 'operational' | 'financial' | 'ml' | 'custom';
  refreshInterval: number;
  autoRefresh: boolean;
  theme: 'light' | 'dark';
  layout: 'grid' | 'flex';
  panels: DashboardPanelConfig[];
  permissions: DashboardPermissions;
}

export interface DashboardPanelConfig {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'status' | 'text' | 'kpi';
  position: { x: number; y: number; w: number; h: number };
  visualization: any;
  metrics: string[];
  alerts: string[];
  thresholds: Record<string, number>;
  filters: Record<string, any>;
  refreshInterval?: number;
}

export interface DashboardPermissions {
  view: string[];
  edit: string[];
  share: string[];
  public: boolean;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: DashboardConfig;
  customizable: boolean;
}

export class DashboardService {
  private dashboards: Map<string, DashboardConfig> = new Map();
  private templates: Map<string, DashboardTemplate> = new Map();
  private alertingSystem: AlertingSystem;
  private metrics = getGlobalMetrics();
  private subscribers: Map<string, WebSocket> = new Map();

  constructor(alertingSystem: AlertingSystem) {
    this.alertingSystem = alertingSystem;
    this.setupDefaultDashboards();
    this.setupDefaultTemplates();
  }

  /**
   * Create a new dashboard
   */
  createDashboard(config: Omit<DashboardConfig, 'id'>): DashboardConfig {
    const dashboard: DashboardConfig = {
      ...config,
      id: this.generateDashboardId()
    };

    this.dashboards.set(dashboard.id, dashboard);
    this.metrics.increment('dashboard_created', { category: dashboard.category });

    console.log(`Created dashboard: ${dashboard.name}`);
    return dashboard;
  }

  /**
   * Get dashboard by ID
   */
  getDashboard(id: string): DashboardConfig | undefined {
    return this.dashboards.get(id);
  }

  /**
   * Get all dashboards
   */
  getAllDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get dashboards by category
   */
  getDashboardsByCategory(category: string): DashboardConfig[] {
    return Array.from(this.dashboards.values()).filter(
      dashboard => dashboard.category === category
    );
  }

  /**
   * Update dashboard configuration
   */
  updateDashboard(id: string, updates: Partial<DashboardConfig>): DashboardConfig | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return null;
    }

    const updatedDashboard: DashboardConfig = {
      ...dashboard,
      ...updates
    };

    this.dashboards.set(id, updatedDashboard);
    this.metrics.increment('dashboard_updated');

    // Notify subscribers
    this.notifySubscribers('dashboard_updated', { dashboardId: id, dashboard: updatedDashboard });

    return updatedDashboard;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(id: string): boolean {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      this.metrics.increment('dashboard_deleted');
      this.notifySubscribers('dashboard_deleted', { dashboardId: id });
    }
    return deleted;
  }

  /**
   * Create dashboard from template
   */
  createFromTemplate(templateId: string, customizations?: Partial<DashboardConfig>): DashboardConfig | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const dashboard = this.createDashboard({
      ...template.config,
      ...customizations,
      name: customizations?.name || `${template.config.name} (Customized)`,
      description: customizations?.description || template.config.description
    });

    return dashboard;
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(id: string, organizationId?: string, filters?: Record<string, any>): Promise<any> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }

    const startTime = Date.now();

    try {
      let data: any = {};

      switch (dashboard.category) {
        case 'executive':
          data = await this.getExecutiveDashboardData(organizationId, filters);
          break;
        case 'product':
          data = await this.getProductDashboardData(organizationId, filters);
          break;
        case 'operational':
          data = await this.getOperationalDashboardData(organizationId, filters);
          break;
        case 'financial':
          data = await this.getFinancialDashboardData(organizationId, filters);
          break;
        case 'ml':
          data = await this.getMLDashboardData(organizationId, filters);
          break;
        default:
          data = await this.getCustomDashboardData(dashboard, organizationId, filters);
      }

      // Add panel-specific data
      data.panels = await this.getPanelsData(dashboard.panels, organizationId, filters);

      // Add alerts
      data.alerts = this.getAlertsData(dashboard.panels);

      // Add real-time metrics
      data.realTimeMetrics = this.getRealTimeMetrics(dashboard.panels);

      const processingTime = Date.now() - startTime;
      this.metrics.observe('dashboard_data_fetch_time_ms', processingTime, { dashboardId: id });

      return data;

    } catch (error) {
      this.metrics.increment('dashboard_data_fetch_error', { dashboardId: id });
      throw error;
    }
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(ws: WebSocket, dashboardId: string): void {
    this.subscribers.set(`${dashboardId}_${this.generateWebSocketId()}`, ws);

    ws.on('close', () => {
      // Clean up subscription on disconnect
      for (const [key, ws] of this.subscribers.entries()) {
        if (ws === ws) {
          this.subscribers.delete(key);
          break;
        }
      }
    });

    // Send initial data
    this.sendDashboardUpdate(ws, dashboardId);
  }

  /**
   * Get all dashboard templates
   */
  getTemplates(): DashboardTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get dashboard template by ID
   */
  getTemplate(id: string): DashboardTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Export dashboard configuration
   */
  exportDashboard(id: string): string {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Import dashboard configuration
   */
  importDashboard(configJson: string): DashboardConfig {
    try {
      const config = JSON.parse(configJson) as DashboardConfig;

      // Validate configuration
      this.validateDashboardConfig(config);

      const dashboard = this.createDashboard(config);
      return dashboard;
    } catch (error) {
      throw new Error(`Invalid dashboard configuration: ${error.message}`);
    }
  }

  // Private methods

  private setupDefaultDashboards(): void {
    // Executive Dashboard
    this.createDashboard({
      name: 'Executive Overview',
      description: 'C-level business intelligence dashboard',
      category: 'executive',
      refreshInterval: 300,
      autoRefresh: true,
      theme: 'light',
      layout: 'grid',
      panels: [
        {
          id: 'executive-kpis',
          title: 'Key Performance Indicators',
          type: 'kpi',
          position: { x: 0, y: 0, w: 12, h: 4 },
          visualization: 'cards',
          metrics: ['revenue', 'users', 'projects', 'efficiency'],
          alerts: ['critical', 'warning'],
          thresholds: { revenue: 100000, users: 1000, projects: 100, efficiency: 80 }
        },
        {
          id: 'revenue-trends',
          title: 'Revenue Trends',
          type: 'chart',
          position: { x: 0, y: 4, w: 8, h: 6 },
          visualization: { type: 'line', timeRange: '30d' },
          metrics: ['revenue', 'growth'],
          alerts: [],
          thresholds: {}
        },
        {
          id: 'user-metrics',
          title: 'User Metrics',
          type: 'chart',
          position: { x: 8, y: 4, h: 6 },
          visualization: { type: 'area', timeRange: '30d' },
          metrics: ['active_users', 'new_users', 'churn_rate'],
          alerts: [],
          thresholds: {}
        }
      ],
      permissions: {
        view: ['executive', 'admin'],
        edit: ['admin'],
        share: ['executive', 'admin'],
        public: false
      }
    });

    // Operational Dashboard
    this.createDashboard({
      name: 'System Operations',
      description: 'Real-time system monitoring and health metrics',
      category: 'operational',
      refreshInterval: 60,
      autoRefresh: true,
      theme: 'dark',
      layout: 'grid',
      panels: [
        {
          id: 'system-health',
          title: 'System Health',
          type: 'status',
          position: { x: 0, y: 0, w: 12, h: 4 },
          visualization: 'status_grid',
          metrics: ['uptime', 'error_rate', 'response_time', 'cpu_usage'],
          alerts: ['critical'],
          thresholds: { uptime: 99.5, error_rate: 1, response_time: 500, cpu_usage: 80 }
        },
        {
          id: 'active-alerts',
          title: 'Active Alerts',
          type: 'alert',
          position: { x: 0, y: 4, w: 12, h: 4 },
          visualization: 'table',
          metrics: [],
          alerts: ['all'],
          thresholds: {}
        }
      ],
      permissions: {
        view: ['devops', 'engineering', 'admin'],
        edit: ['devops', 'admin'],
        share: ['devops', 'engineering', 'admin'],
        public: false
      }
    });

    // ML Model Performance Dashboard
    this.createDashboard({
      name: 'ML Model Performance',
      description: 'Machine learning model monitoring and performance tracking',
      category: 'ml',
      refreshInterval: 300,
      autoRefresh: true,
      theme: 'dark',
      layout: 'grid',
      panels: [
        {
          id: 'ml-health-score',
          title: 'ML System Health',
          type: 'status',
          position: { x: 0, y: 0, w: 6, h: 4 },
          visualization: 'gauge',
          metrics: ['ml_health_score', 'accuracy', 'performance', 'reliability'],
          alerts: ['critical', 'warning'],
          thresholds: { ml_health_score: 80, accuracy: 85, performance: 80, reliability: 95 }
        },
        {
          id: 'model-accuracy',
          title: 'Model Accuracy',
          type: 'chart',
          position: { x: 6, y: 0, w: 6, h: 4 },
          visualization: { type: 'bar' },
          metrics: ['model_accuracy'],
          alerts: [],
          thresholds: {}
        },
        {
          id: 'prediction-latency',
          title: 'Prediction Latency',
          type: 'chart',
          position: { x: 0, y: 4, w: 12, h: 4 },
          visualization: { type: 'line' },
          metrics: ['prediction_latency'],
          alerts: [],
          thresholds: {}
        }
      ],
      permissions: {
        view: ['ml-team', 'data-science', 'admin'],
        edit: ['ml-team', 'admin'],
        share: ['ml-team', 'data-science', 'admin'],
        public: false
      }
    });
  }

  private setupDefaultTemplates(): void {
    // Executive Dashboard Template
    this.templates.set('executive-overview', {
      id: 'executive-overview',
      name: 'Executive Overview Template',
      description: 'Template for C-level business intelligence dashboards',
      category: 'executive',
      customizable: true,
      config: {
        id: 'template',
        name: 'Executive Overview Template',
        description: 'Template for C-level business intelligence dashboards',
        category: 'executive',
        refreshInterval: 300,
        autoRefresh: true,
        theme: 'light',
        layout: 'grid',
        panels: [
          {
            id: 'kpi-panel',
            title: 'Key Performance Indicators',
            type: 'kpi',
            position: { x: 0, y: 0, w: 12, h: 3 },
            visualization: 'cards',
            metrics: ['revenue', 'growth', 'users', 'engagement'],
            alerts: ['critical', 'warning'],
            thresholds: { revenue: 0, growth: 0, users: 0, engagement: 0 }
          }
        ],
        permissions: {
          view: ['*'],
          edit: ['admin'],
          share: ['*'],
          public: false
        }
      }
    });

    // Operational Dashboard Template
    this.templates.set('operational-monitoring', {
      id: 'operational-monitoring',
      name: 'Operational Monitoring Template',
      description: 'Template for system monitoring and health dashboards',
      category: 'operational',
      customizable: true,
      config: {
        id: 'template',
        name: 'Operational Monitoring Template',
        description: 'Template for system monitoring and health dashboards',
        category: 'operational',
        refreshInterval: 60,
        autoRefresh: true,
        theme: 'dark',
        layout: 'grid',
        panels: [
          {
            id: 'health-panel',
            title: 'System Health',
            type: 'status',
            position: { x: 0, y: 0, w: 12, h: 4 },
            visualization: 'status_cards',
            metrics: ['uptime', 'error_rate', 'response_time'],
            alerts: ['critical'],
            thresholds: { uptime: 99.9, error_rate: 1, response_time: 500 }
          }
        ],
        permissions: {
          view: ['*'],
          edit: ['admin'],
          share: ['*'],
          public: false
        }
      }
    });
  }

  private async getExecutiveDashboardData(organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation - would query actual analytics service
    return {
      kpis: {
        revenue: { current: 125000, growth: 12.5, forecast: 140000, target: 130000 },
        users: { total: 8500, active: 2500, growth: 8.2, engagement: 7.5 },
        projects: { total: 450, active: 380, completion: 85, satisfaction: 4.6 },
        efficiency: { costPerAcquisition: 150, lifetimeValue: 2400, churnRate: 3.8, operatingMargin: 22.5 }
      },
      panels: []
    };
  }

  private async getProductDashboardData(organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      userBehavior: {
        journeys: [],
        funnels: [],
        featureAdoption: [],
        sessionAnalytics: {}
      },
      panels: []
    };
  }

  private async getOperationalDashboardData(organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      systemHealth: {
        availability: { uptime: 99.95, downtime: { total: 21.6 } },
        performance: { responseTime: 145, errorRate: 0.8 },
        capacity: { current: 8500, maximum: 15000 },
        scalability: { autoScaling: { scaleUpEvents: 15 } }
      },
      panels: []
    };
  }

  private async getFinancialDashboardData(organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      realTimeRevenue: {
        currentPeriod: { revenue: 70000, growth: 12.5 },
        transactions: { volume: 150000, successRate: 96.5 },
        subscriptions: { active: 1200, mrr: 45000, arr: 540000 }
      },
      panels: []
    };
  }

  private async getMLDashboardData(organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      modelPerformance: {
        accuracy: [],
        drift: [],
        performance: [],
        comparison: []
      },
      panels: []
    };
  }

  private async getCustomDashboardData(dashboard: DashboardConfig, organizationId?: string, filters?: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      panels: []
    };
  }

  private async getPanelsData(panels: DashboardPanelConfig[], organizationId?: string, filters?: Record<string, any>): Promise<any[]> {
    // Mock implementation
    return panels.map(panel => ({
      id: panel.id,
      title: panel.title,
      type: panel.type,
      data: this.getPanelData(panel, organizationId, filters)
    }));
  }

  private getPanelData(panel: DashboardPanelConfig, organizationId?: string, filters?: Record<string, any>): any {
    // Mock implementation - would fetch actual data based on panel type and metrics
    switch (panel.type) {
      case 'metric':
        return panel.metrics.reduce((acc, metric) => {
          acc[metric] = Math.random() * 100;
          return acc;
        }, {});
      case 'chart':
        return this.generateChartData(panel.visualization, panel.metrics);
      case 'kpi':
        return this.generateKPIData(panel.metrics, panel.thresholds);
      case 'status':
        return this.generateStatusData(panel.metrics, panel.thresholds);
      default:
        return {};
    }
  }

  private getAlertsData(panels: DashboardPanelConfig[]): Alert[] {
    const allAlerts = this.alertingSystem.getActiveAlerts();
    const alertTypes = panels.flatMap(panel => panel.alerts);

    if (alertTypes.includes('all')) {
      return allAlerts;
    }

    return allAlerts.filter(alert => alertTypes.includes(alert.type) || alertTypes.includes(alert.severity));
  }

  private getRealTimeMetrics(panels: DashboardPanelConfig[]): Record<string, number> {
    const metrics: Record<string, number> = {};

    for (const panel of panels) {
      for (const metric of panel.metrics) {
        // Mock real-time metrics
        metrics[metric] = Math.random() * 100;
      }
    }

    return metrics;
  }

  private generateChartData(visualization: any, metrics: string[]): any {
    // Mock chart data generation
    const dataPoints = 20;
    const data = [];

    for (let i = 0; i < dataPoints; i++) {
      const point: any = { timestamp: new Date(Date.now() - (dataPoints - i) * 60000) };

      for (const metric of metrics) {
        point[metric] = Math.random() * 1000;
      }

      data.push(point);
    }

    return data;
  }

  private generateKPIData(metrics: string[], thresholds: Record<string, number>): any {
    const kpiData: any = {};

    for (const metric of metrics) {
      const value = Math.random() * 100;
      const threshold = thresholds[metric] || 50;
      const status = value >= threshold ? 'good' : value >= threshold * 0.8 ? 'warning' : 'critical';

      kpiData[metric] = { value, threshold, status };
    }

    return kpiData;
  }

  private generateStatusData(metrics: string[], thresholds: Record<string, number>): any {
    const statusData: any = {};

    for (const metric of metrics) {
      const value = Math.random() * 100;
      const threshold = thresholds[metric] || 50;
      const status = value >= threshold ? 'healthy' : 'unhealthy';

      statusData[metric] = { value, threshold, status };
    }

    return statusData;
  }

  private validateDashboardConfig(config: DashboardConfig): void {
    // Validate required fields
    if (!config.name || !config.category) {
      throw new Error('Dashboard name and category are required');
    }

    // Validate panels
    if (!config.panels || config.panels.length === 0) {
      throw new Error('Dashboard must have at least one panel');
    }

    // Validate panel configurations
    for (const panel of config.panels) {
      if (!panel.id || !panel.title || !panel.type) {
        throw new Error('Each panel must have an id, title, and type');
      }
    }

    // Validate layout
    this.validatePanelLayout(config.panels, config.layout);
  }

  private validatePanelLayout(panels: DashboardPanelConfig[], layout: string): void {
    if (layout === 'grid') {
      // Check for overlapping panels
      const occupied = new Set<string>();

      for (const panel of panels) {
        const positionKey = `${panel.position.x},${panel.position.y},${panel.position.w},${panel.position.h}`;

        if (occupied.has(positionKey)) {
          throw new Error(`Panel ${panel.id} overlaps with another panel`);
        }

        occupied.add(positionKey);
      }
    }
  }

  private notifySubscribers(event: string, data: any): void {
    for (const [key, ws] of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    }
  }

  private async sendDashboardUpdate(ws: WebSocket, dashboardId: string): Promise<void> {
    try {
      const data = await this.getDashboardData(dashboardId);
      ws.send(JSON.stringify({ event: 'dashboard_update', data }));
    } catch (error) {
      console.error('Failed to send dashboard update:', error);
    }
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWebSocketId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default DashboardService;