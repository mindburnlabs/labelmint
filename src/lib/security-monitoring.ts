
import winston from 'winston';

// Security logger
export const securityLogger = winston.createLogger({
  level: 'security',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' }),
    new winston.transports.Console()
  ]
});

// Security event monitoring
export class SecurityMonitor {
  static logSuspiciousActivity(event, details) {
    securityLogger.warn('Suspicious activity detected', {
      event,
      details,
      timestamp: new Date().toISOString(),
      severity: this.getSeverity(event)
    });

    // Auto-block if severe
    if (this.getSeverity(event) === 'critical') {
      this.blockIP(details.ip);
    }
  }

  static getSeverity(event) {
    const severityMap = {
      'sql_injection': 'critical',
      'xss_attempt': 'high',
      'rate_limit_exceeded': 'medium',
      'invalid_auth': 'low'
    };
    return severityMap[event] || 'medium';
  }

  static blockIP(ip) {
    // Implementation for IP blocking
    console.log(`Blocking IP: ${ip}`);
  }
}

// Request monitoring middleware
export function securityMonitor(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 5000) {
      SecurityMonitor.logSuspiciousActivity('slow_request', {
        url: req.url,
        method: req.method,
        duration,
        ip: req.ip
      });
    }

    // Log failed authentication attempts
    if (res.statusCode === 401) {
      SecurityMonitor.logSuspiciousActivity('invalid_auth', {
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  });

  next();
}
