import axios from 'axios';
import cron from 'node-cron';
import { serviceRegistry } from './registry';
import { ServiceHealth } from '@types/index';
import { logger } from '@utils/logger';

class HealthChecker {
  private checking = false;
  private cronJob?: cron.ScheduledTask;
  private checkInterval = process.env.HEALTH_CHECK_INTERVAL || '*/30 * * * * *'; // Every 30 seconds

  async initialize(): Promise<void> {
    logger.info('Initializing health checker...');
    // Initial health check
    await this.checkAllServices();
  }

  start(): void {
    if (this.checking) return;

    logger.info(`Starting health checks with interval: ${this.checkInterval}`);

    // Schedule regular health checks
    this.cronJob = cron.schedule(this.checkInterval, async () => {
      await this.checkAllServices();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.checking = true;
  }

  stop(): void {
    if (!this.checking) return;

    logger.info('Stopping health checks...');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    this.checking = false;
  }

  async checkAllServices(): Promise<void> {
    const services = serviceRegistry.getAllServices();
    const checkPromises = Object.keys(services).map(serviceName =>
      this.checkService(serviceName).catch(error => {
        logger.error(`Health check error for ${serviceName}:`, error);
      })
    );

    await Promise.allSettled(checkPromises);
  }

  async checkService(serviceName: string): Promise<ServiceHealth> {
    const service = serviceRegistry.getService(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;

    try {
      const response = await axios.get(service.config.healthCheck, {
        timeout: 5000,
        headers: {
          'User-Agent': 'LabelMint-Gateway/1.0',
          'X-Health-Check': 'true'
        }
      });

      const responseTime = Date.now() - startTime;
      healthy = response.status === 200;

      if (healthy) {
        serviceRegistry.updateServiceHealth(serviceName, true, responseTime);
      } else {
        error = `HTTP ${response.status}`;
        serviceRegistry.updateServiceHealth(serviceName, false, responseTime, error);
      }

      return {
        name: serviceName,
        healthy,
        responseTime,
        lastCheck: new Date(),
        error
      };

    } catch (err: any) {
      const responseTime = Date.now() - startTime;
      error = err.code || err.message || 'Unknown error';

      serviceRegistry.updateServiceHealth(serviceName, false, responseTime, error);

      return {
        name: serviceName,
        healthy: false,
        responseTime,
        lastCheck: new Date(),
        error
      };
    }
  }

  getAllServiceHealth(): Record<string, ServiceHealth> {
    const services = serviceRegistry.getAllServices();
    const health: Record<string, ServiceHealth> = {};

    for (const [name, instance] of Object.entries(services)) {
      health[name] = {
        name: instance.name,
        healthy: instance.healthy,
        responseTime: instance.responseTime,
        lastCheck: instance.lastCheck,
        error: instance.errorCount > 0 ? 'Service errors detected' : undefined
      };
    }

    return health;
  }

  markServiceHealthy(serviceName: string): void {
    serviceRegistry.updateServiceHealth(serviceName, true, 0);
  }

  markServiceUnhealthy(serviceName: string): void {
    serviceRegistry.updateServiceHealth(serviceName, false, 0, 'Marked unhealthy by proxy');
  }

  async cleanup(): Promise<void> {
    this.stop();
    logger.info('Health checker cleaned up');
  }
}

export const healthChecker = new HealthChecker();