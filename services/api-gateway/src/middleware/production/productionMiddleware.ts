import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import AdvancedRateLimiter from '../rateLimit/advancedRateLimiter';
import SecurityMiddleware from '../security/securityMiddleware';
import IntegrationSecurityManager from '../security/integrationSecurity';
import PerformanceMiddleware from '../performance/apiPerformanceMiddleware';
import APIMonitoringService from '../monitoring/apiMonitoring';
import securityConfig from '../../config/security';
import { logger } from '../../utils/logger';

/**
 * Production Middleware Bundle
 * Combines all security, performance, and monitoring middleware
 * optimized for production deployment
 */
export class ProductionMiddleware {
  private securityMiddleware: SecurityMiddleware;
  private integrationSecurity: IntegrationSecurityManager;
  private performanceMiddleware: PerformanceMiddleware;
  private monitoringService: APIMonitoringService;

  // Rate limiters for different tiers
  private anonymousRateLimiter: AdvancedRateLimiter;
  private authenticatedRateLimiter: AdvancedRateLimiter;
  private premiumRateLimiter: AdvancedRateLimiter;
  private enterpriseRateLimiter: AdvancedRateLimiter;
  private adminRateLimiter: AdvancedRateLimiter;

  constructor() {
    this.securityMiddleware = new SecurityMiddleware();
    this.integrationSecurity = new IntegrationSecurityManager();
    this.performanceMiddleware = new PerformanceMiddleware();
    this.monitoringService = new APIMonitoringService();

    // Initialize rate limiters for different user tiers
    this.initializeRateLimiters();
  }

  /**
   * Initialize tier-based rate limiters
   */
  private initializeRateLimiters(): void {
    this.anonymousRateLimiter = new AdvancedRateLimiter({
      windowMs: securityConfig.rateLimit.userTiers.anonymous.windowMs,
      maxRequests: securityConfig.rateLimit.userTiers.anonymous.max,
      distributed: securityConfig.rateLimit.enableDistributed,
      userTiers: {
        anonymous: securityConfig.rateLimit.userTiers.anonymous,
        authenticated: securityConfig.rateLimit.userTiers.authenticated,
        premium: securityConfig.rateLimit.userTiers.premium,
        enterprise: securityConfig.rateLimit.userTiers.enterprise,
        admin: securityConfig.rateLimit.userTiers.admin
      }
    });

    this.authenticatedRateLimiter = new AdvancedRateLimiter({
      windowMs: securityConfig.rateLimit.userTiers.authenticated.windowMs,
      maxRequests: securityConfig.rateLimit.userTiers.authenticated.max,
      distributed: securityConfig.rateLimit.enableDistributed,
      userTiers: securityConfig.rateLimit.userTiers
    });

    this.premiumRateLimiter = new AdvancedRateLimiter({
      windowMs: securityConfig.rateLimit.userTiers.premium.windowMs,
      maxRequests: securityConfig.rateLimit.userTiers.premium.max,
      distributed: securityConfig.rateLimit.enableDistributed,
      userTiers: securityConfig.rateLimit.userTiers
    });

    this.enterpriseRateLimiter = new AdvancedRateLimiter({
      windowMs: securityConfig.rateLimit.userTiers.enterprise.windowMs,
      maxRequests: securityConfig.rateLimit.userTiers.enterprise.max,
      distributed: securityConfig.rateLimit.enableDistributed,
      userTiers: securityConfig.rateLimit.userTiers
    });

    this.adminRateLimiter = new AdvancedRateLimiter({
      windowMs: securityConfig.rateLimit.userTiers.admin.windowMs,
      maxRequests: securityConfig.rateLimit.userTiers.admin.max,
      distributed: securityConfig.rateLimit.enableDistributed,
      userTiers: securityConfig.rateLimit.userTiers
    });
  }

  /**
   * Get appropriate rate limiter based on user tier
   */
  private getRateLimiter(req: Request): AdvancedRateLimiter {
    // Check for admin user
    if ((req as any).user?.role === 'admin' || (req as any).apiKey?.permissions?.includes('admin')) {
      return this.adminRateLimiter;
    }

    // Check for enterprise user
    if ((req as any).user?.role === 'enterprise' || (req as any).apiKey?.permissions?.includes('enterprise')) {
      return this.enterpriseRateLimiter;
    }

    // Check for premium user
    if ((req as any).user?.role === 'premium' || (req as any).apiKey?.permissions?.includes('premium')) {
      return this.premiumRateLimiter;
    }

    // Check for authenticated user
    if ((req as any).user?.id || (req as any).apiKey?.id) {
      return this.authenticatedRateLimiter;
    }

    // Default to anonymous rate limiter
    return this.anonymousRateLimiter;
  }

  /**
   * Complete production middleware stack
   */
  productionStack() {
    const middleware = [];

    // 1. Basic security headers
    middleware.push(this.securityMiddleware.helmet());

    // 2. CORS configuration
    middleware.push(this.securityMiddleware.cors());

    // 3. Force HTTPS (if enabled)
    middleware.push(this.securityMiddleware.forceHTTPS());

    // 4. IP filtering (if enabled)
    middleware.push(this.securityMiddleware.ipFiltering());

    // 5. Request validation
    middleware.push(this.securityMiddleware.requestValidation());

    // 6. Request signing verification (if enabled)
    middleware.push(this.securityMiddleware.requestSigningVerification());

    // 7. CSRF protection (if enabled)
    middleware.push(this.securityMiddleware.csrfProtection());

    // 8. Integration security
    middleware.push(this.integrationSecurity.integrationSecurityMiddleware());

    // 9. Performance optimization
    middleware.push(this.performanceMiddleware.optimizationMiddleware());
    middleware.push(this.performanceMiddleware.resourceHintsMiddleware());
    middleware.push(this.performanceMiddleware.protocolOptimizationMiddleware());

    // 10. Cache middleware
    middleware.push(this.performanceMiddleware.cacheMiddleware());

    // 11. Monitoring middleware
    middleware.push(this.performanceMiddleware.metricsMiddleware());
    middleware.push(this.securityMiddleware.auditLogging());

    // 12. Dynamic rate limiting based on user tier
    middleware.push(this.adaptiveRateLimiting());

    return middleware;
  }

  /**
   * Adaptive rate limiting middleware
   */
  private adaptiveRateLimiting() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rateLimiter = this.getRateLimiter(req);
        const identifier = this.getRateLimitIdentifier(req);

        // Apply rate limiting
        const rateLimitMiddleware = rateLimiter.middleware(identifier);
        await rateLimitMiddleware(req, res, next);

        // Log rate limiting events
        if (res.statusCode === 429) {
          this.monitoringService.recordSecurityEvent(
            'rate_limit',
            'MEDIUM',
            'Rate limit exceeded',
            {
              ip: req.ip,
              userId: (req as any).user?.id,
              apiKeyId: (req as any).apiKey?.id,
              endpoint: req.path,
              method: req.method,
              userTier: this.getUserTier(req)
            }
          );
        }
      } catch (error) {
        logger.error('Rate limiting error:', error);
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Get rate limit identifier for request
   */
  private getRateLimitIdentifier(req: Request): string {
    // Use endpoint as identifier for granular rate limiting
    if (req.path.startsWith('/api/v1/payment')) {
      return 'payment-api';
    } else if (req.path.startsWith('/api/v1/labeling')) {
      return 'labeling-api';
    } else if (req.path.startsWith('/api/v1/admin')) {
      return 'admin-api';
    } else if (req.path.startsWith('/webhook/')) {
      return 'webhook-endpoint';
    } else if (req.path.startsWith('/public/')) {
      return 'public-api';
    }

    return 'global';
  }

  /**
   * Get user tier from request
   */
  private getUserTier(req: Request): string {
    if ((req as any).user?.role === 'admin') return 'admin';
    if ((req as any).user?.role === 'enterprise' || (req as any).apiKey?.permissions?.includes('enterprise')) return 'enterprise';
    if ((req as any).user?.role === 'premium' || (req as any).apiKey?.permissions?.includes('premium')) return 'premium';
    if ((req as any).user?.id || (req as any).apiKey?.id) return 'authenticated';
    return 'anonymous';
  }

  /**
   * Health check middleware
   */
  healthCheckMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path !== '/health' && req.path !== '/healthz') {
        return next();
      }

      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        services: {
          apiGateway: { status: 'healthy' },
          labelingBackend: { status: 'unknown' },
          paymentBackend: { status: 'unknown' },
          enterpriseApi: { status: 'unknown' }
        },
        metrics: this.performanceMiddleware.getPerformanceStats(),
        cache: this.performanceMiddleware.getCacheStats(),
        security: {
          rateLimiting: securityConfig.rateLimit.enabled,
          authentication: securityConfig.auth.enableJWT,
          ipFiltering: securityConfig.ipFiltering.enabled
        },
        monitoring: this.monitoringService.getStatistics()
      };

      // Check critical services
      const criticalServices = ['apiGateway'];
      const unhealthyServices = criticalServices.filter(service =>
        healthData.services[service as keyof typeof healthData.services].status !== 'healthy'
      );

      if (unhealthyServices.length > 0) {
        healthData.status = 'unhealthy';
        res.status(503);
      }

      res.json(healthData);
    };
  }

  /**
   * Readiness probe middleware
   */
  readinessProbeMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path !== '/readyz') {
        return next();
      }

      // Check if application is ready to serve traffic
      const checks = {
        database: this.checkDatabaseConnection(),
        redis: this.checkRedisConnection(),
        rateLimiter: this.checkRateLimiterConnection(),
        integrations: this.checkIntegrationConnections()
      };

      const allHealthy = Object.values(checks).every(check => check);

      if (allHealthy) {
        res.status(200).json({
          status: 'ready',
          checks,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          checks,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Liveness probe middleware
   */
  livenessProbeMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path !== '/livez') {
        return next();
      }

      // Basic liveness check - is the process alive and responding?
      res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      });
    };
  }

  /**
   * Security endpoints middleware
   */
  securityEndpointsMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.path.startsWith('/security/')) {
        return next();
      }

      switch (req.path) {
        case '/security/status':
          res.json({
            security: {
              rateLimiting: securityConfig.rateLimit.enabled,
              authentication: securityConfig.auth.enableJWT,
              ipFiltering: securityConfig.ipFiltering.enabled,
              cors: securityConfig.cors.enabled,
              tls: securityConfig.tls.enabled,
              encryption: securityConfig.encryption.enableFieldLevelEncryption
            },
            integrations: this.integrationSecurity.getSecurityMetrics(),
            timestamp: new Date().toISOString()
          });
          break;

        case '/security/metrics':
          res.json(this.monitoringService.getStatistics());
          break;

        case '/security/events':
          const limit = parseInt(req.query.limit as string) || 100;
          const events = this.monitoringService.getDashboardData().events.slice(-limit);
          res.json({ events, total: events.length });
          break;

        default:
          next();
      }
    };
  }

  /**
   * Performance endpoints middleware
   */
  performanceEndpointsMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.path.startsWith('/performance/')) {
        return next();
      }

      switch (req.path) {
        case '/performance/stats':
          res.json(this.performanceMiddleware.getPerformanceStats());
          break;

        case '/performance/cache':
          res.json(this.performanceMiddleware.getCacheStats());
          break;

        case '/performance/dashboard':
          res.json({
            performance: this.performanceMiddleware.getPerformanceStats(),
            cache: this.performanceMiddleware.getCacheStats(),
            monitoring: this.monitoringService.getDashboardData()
          });
          break;

        default:
          next();
      }
    };
  }

  /**
   * Helper methods for health checks
   */
  private checkDatabaseConnection(): boolean {
    // Implement actual database connection check
    return true;
  }

  private checkRedisConnection(): boolean {
    // Implement actual Redis connection check
    return true;
  }

  private checkRateLimiterConnection(): boolean {
    // Check if rate limiters are functioning
    return true;
  }

  private checkIntegrationConnections(): boolean {
    // Check if third-party integrations are working
    return true;
  }

  /**
   * Graceful shutdown handler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down production middleware...');

    try {
      // Shutdown rate limiters
      await Promise.all([
        this.anonymousRateLimiter.destroy(),
        this.authenticatedRateLimiter.destroy(),
        this.premiumRateLimiter.destroy(),
        this.enterpriseRateLimiter.destroy(),
        this.adminRateLimiter.destroy()
      ]);

      logger.info('Production middleware shutdown complete');
    } catch (error) {
      logger.error('Error during production middleware shutdown:', error);
    }
  }

  /**
   * Get middleware statistics
   */
  getStatistics(): any {
    return {
      security: {
        helmet: true,
        cors: securityConfig.cors.enabled,
        ipFiltering: securityConfig.ipFiltering.enabled,
        requestValidation: true,
        csrfProtection: securityConfig.validation.enableCSRFProtection,
        requestSigning: securityConfig.gateway.enableRequestSigning
      },
      rateLimiting: {
        enabled: securityConfig.rateLimit.enabled,
        distributed: securityConfig.rateLimit.enableDistributed,
        tiers: {
          anonymous: securityConfig.rateLimit.userTiers.anonymous.max,
          authenticated: securityConfig.rateLimit.userTiers.authenticated.max,
          premium: securityConfig.rateLimit.userTiers.premium.max,
          enterprise: securityConfig.rateLimit.userTiers.enterprise.max,
          admin: securityConfig.rateLimit.userTiers.admin.max
        }
      },
      performance: {
        cache: this.performanceMiddleware.getCacheStats(),
        metrics: this.performanceMiddleware.getPerformanceStats()
      },
      monitoring: this.monitoringService.getStatistics(),
      integrations: this.integrationSecurity.getSecurityMetrics()
    };
  }
}

// Export singleton instance
export const productionMiddleware = new ProductionMiddleware();
export default productionMiddleware;