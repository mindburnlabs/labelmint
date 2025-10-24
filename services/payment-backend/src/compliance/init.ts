import { DatabaseService } from '../services/database/DatabaseService';
import { GDPRService } from '../services/compliance/GDPRService';
import { AuditService, initializeAuditService } from '../services/compliance/AuditService';
import { AnalyticsService, initializeAnalyticsService } from '../services/analytics/AnalyticsService';
import { CookieConsentService, initializeCookieConsentService } from '../services/compliance/CookieConsentService';

/**
 * Initialize all compliance services
 */
export class ComplianceInitializer {
  private static instance: ComplianceInitializer;
  private db: DatabaseService;
  private gdprService: GDPRService;
  private auditService: AuditService;
  private analyticsService: AnalyticsService;
  private cookieConsentService: CookieConsentService;

  constructor(db: DatabaseService) {
    this.db = db;
    this.gdprService = new GDPRService(db);
    this.auditService = initializeAuditService(db);
    this.analyticsService = initializeAnalyticsService(db);
    this.cookieConsentService = initializeCookieConsentService(db);
  }

  static getInstance(db?: DatabaseService): ComplianceInitializer {
    if (!ComplianceInitializer.instance) {
      if (!db) {
        throw new Error('DatabaseService is required for first initialization');
      }
      ComplianceInitializer.instance = new ComplianceInitializer(db);
    }
    return ComplianceInitializer.instance;
  }

  /**
   * Get GDPR service instance
   */
  getGDPRService(): GDPRService {
    return this.gdprService;
  }

  /**
   * Get audit service instance
   */
  getAuditService(): AuditService {
    return this.auditService;
  }

  /**
   * Get analytics service instance
   */
  getAnalyticsService(): AnalyticsService {
    return this.analyticsService;
  }

  /**
   * Get cookie consent service instance
   */
  getCookieConsentService(): CookieConsentService {
    return this.cookieConsentService;
  }

  /**
   * Initialize compliance middleware
   */
  initializeMiddleware() {
    return {
      audit: this.auditService.auditMiddleware(),
      cookieConsent: this.cookieConsentService.middleware(),
      requireAnalyticsConsent: this.cookieConsentService.requireAnalyticsConsent(),
      requireMarketingConsent: this.cookieConsentService.requireMarketingConsent()
    };
  }

  /**
   * Run compliance maintenance tasks
   */
  async runMaintenanceTasks(): Promise<void> {
    try {
      console.log('Running compliance maintenance tasks...');

      // Process pending analytics events
      const processedEvents = await this.analyticsService.processPendingEvents();
      console.log(`Processed ${processedEvents} pending analytics events`);

      // Cleanup old audit logs
      const deletedAuditLogs = await this.gdprService.cleanupAuditLogs(365);
      console.log(`Deleted ${deletedAuditLogs} old audit logs`);

      // Cleanup old analytics events
      const deletedAnalyticsEvents = await this.analyticsService.cleanupOldEvents(90);
      console.log(`Deleted ${deletedAnalyticsEvents} old analytics events`);

      console.log('Compliance maintenance tasks completed');
    } catch (error) {
      console.error('Error running compliance maintenance:', error);
    }
  }

  /**
   * Schedule periodic maintenance
   */
  scheduleMaintenance(): void {
    // Run maintenance every 24 hours
    setInterval(() => {
      this.runMaintenanceTasks();
    }, 24 * 60 * 60 * 1000);

    // Run initial maintenance after 5 minutes
    setTimeout(() => {
      this.runMaintenanceTasks();
    }, 5 * 60 * 1000);
  }
}

// Singleton instances for easy access
export let compliance: ComplianceInitializer;

/**
 * Initialize compliance system
 */
export function initializeCompliance(db: DatabaseService): ComplianceInitializer {
  compliance = ComplianceInitializer.getInstance(db);
  compliance.scheduleMaintenance();
  return compliance;
}