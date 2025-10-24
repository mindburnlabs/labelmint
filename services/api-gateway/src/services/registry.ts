import { EventEmitter } from 'events';
import { ServiceConfig } from '@types/index';
import config from '@config/index';
import { logger } from '@utils/logger';

interface ServiceInstance {
  config: ServiceConfig;
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  responseTime: number;
}

class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing service registry...');

    // Register all configured services
    for (const serviceConfig of config.services) {
      this.registerService(serviceConfig);
    }

    this.initialized = true;
    logger.info(`Service registry initialized with ${this.services.size} services`);
  }

  registerService(serviceConfig: ServiceConfig): void {
    const instance: ServiceInstance = {
      config: serviceConfig,
      healthy: false,
      lastCheck: new Date(),
      errorCount: 0,
      responseTime: 0
    };

    this.services.set(serviceConfig.name, instance);
    logger.info(`Service registered: ${serviceConfig.name} -> ${serviceConfig.target}`);
    this.emit('serviceRegistered', serviceConfig.name);
  }

  unregisterService(serviceName: string): void {
    if (this.services.delete(serviceName)) {
      logger.info(`Service unregistered: ${serviceName}`);
      this.emit('serviceUnregistered', serviceName);
    }
  }

  getService(serviceName: string): ServiceInstance | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, instance] of this.services) {
      result[name] = {
        name: instance.config.name,
        target: instance.config.target,
        path: instance.config.path,
        healthy: instance.healthy,
        lastCheck: instance.lastCheck,
        errorCount: instance.errorCount,
        responseTime: instance.responseTime,
        auth: instance.config.auth
      };
    }

    return result;
  }

  getHealthyServices(): ServiceInstance[] {
    return Array.from(this.services.values()).filter(s => s.healthy);
  }

  updateServiceHealth(serviceName: string, healthy: boolean, responseTime?: number, error?: string): void {
    const service = this.services.get(serviceName);
    if (!service) return;

    const wasHealthy = service.healthy;
    service.healthy = healthy;
    service.lastCheck = new Date();

    if (responseTime !== undefined) {
      service.responseTime = responseTime;
    }

    if (!healthy) {
      service.errorCount++;
      if (error) {
        logger.warn(`Service health check failed: ${serviceName}`, { error, responseTime });
      }
    } else {
      service.errorCount = 0;
      if (wasHealthy !== healthy) {
        logger.info(`Service recovered: ${serviceName}`);
        this.emit('serviceRecovered', serviceName);
      }
    }

    if (wasHealthy !== healthy) {
      this.emit('healthChanged', serviceName, healthy);
    }
  }

  async cleanup(): Promise<void> {
    this.services.clear();
    this.removeAllListeners();
    this.initialized = false;
    logger.info('Service registry cleaned up');
  }
}

export const serviceRegistry = new ServiceRegistry();