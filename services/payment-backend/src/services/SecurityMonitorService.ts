import { postgresDb } from './database';
import { SecurityService } from './auth/SecurityService';
import cron from 'node-cron';

export interface SecurityAlert {
  type: 'brute_force' | 'suspicious_login' | 'account_lockout' | 'multiple_failed_2fa' | 'anomalous_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: Date;
  userId?: number;
}

export class SecurityMonitorService {
  private securityService: SecurityService;
  private alertCallbacks: Map<string, (alert: SecurityAlert) => void> = new Map();

  constructor() {
    this.securityService = new SecurityService();
    this.initializeMonitoring();
  }

  /**
   * Initialize security monitoring
   */
  private initializeMonitoring() {
    // Check for suspicious activity every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkForSuspiciousActivity();
    });

    // Generate daily security report
    cron.schedule('0 8 * * *', () => {
      this.generateDailySecurityReport();
    });

    // Clean up old security logs
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldLogs();
    });
  }

  /**
   * Register alert callback
   */
  onAlert(type: string, callback: (alert: SecurityAlert) => void): void {
    this.alertCallbacks.set(type, callback);
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(alert: SecurityAlert): Promise<void> {
    // Log alert to database
    await postgresDb.query(`
      INSERT INTO security_alerts (
        type, severity, message, data, user_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      alert.type,
      alert.severity,
      alert.message,
      JSON.stringify(alert.data),
      alert.userId
    ]);

    // Notify callbacks
    const callback = this.alertCallbacks.get(alert.type);
    if (callback) {
      callback(alert);
    }

    // High severity alerts require immediate action
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await this.handleCriticalAlert(alert);
    }
  }

  /**
   * Check for suspicious activity
   */
  private async checkForSuspiciousActivity(): Promise<void> {
    try {
      // Check for multiple failed logins from same IP
      const multipleFailedLogins = await postgresDb.query(`
        SELECT ip_address, COUNT(*) as attempts
        FROM login_attempts
        WHERE success = false
        AND attempted_at > NOW() - INTERVAL '15 minutes'
        GROUP BY ip_address
        HAVING COUNT(*) >= 10
      `);

      for (const row of multipleFailedLogins.rows) {
        await this.triggerAlert({
          type: 'brute_force',
          severity: 'high',
          message: `Brute force attack detected from IP: ${row.ip_address}`,
          data: {
            ipAddress: row.ip_address,
            attempts: row.attempts,
            timeWindow: '15 minutes'
          }
        });
      }

      // Check for multiple locations in short time
      const multipleLocations = await postgresDb.query(`
        SELECT user_id, COUNT(DISTINCT ip_address) as locations
        FROM login_attempts
        WHERE success = true
        AND attempted_at > NOW() - INTERVAL '1 hour'
        GROUP BY user_id
        HAVING COUNT(DISTINCT ip_address) >= 3
      `);

      for (const row of multipleLocations.rows) {
        await this.triggerAlert({
          type: 'suspicious_login',
          severity: 'medium',
          message: `User accessed from ${row.locations} different locations`,
          data: {
            userId: row.user_id,
            locations: row.locations,
            timeWindow: '1 hour'
          },
          userId: row.user_id
        });
      }

      // Check for account lockouts
      const recentLockouts = await postgresDb.query(`
        SELECT COUNT(*) as lockouts
        FROM account_lockouts
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND is_active = true
      `);

      if (parseInt(recentLockouts.rows[0].lockouts) > 5) {
        await this.triggerAlert({
          type: 'account_lockout',
          severity: 'medium',
          message: `High number of account lockouts detected: ${recentLockouts.rows[0].lockouts}`,
          data: {
            lockouts: recentLockouts.rows[0].lockouts,
            timeWindow: '1 hour'
          }
        });
      }

      // Check for 2FA failures
      const failed2FA = await postgresDb.query(`
        SELECT user_id, COUNT(*) as failures
        FROM security_audit_log
        WHERE action = '2fa_verified'
        AND result = 'failure'
        AND created_at > NOW() - INTERVAL '15 minutes'
        GROUP BY user_id
        HAVING COUNT(*) >= 5
      `);

      for (const row of failed2FA.rows) {
        await this.triggerAlert({
          type: 'multiple_failed_2fa',
          severity: 'high',
          message: `Multiple 2FA failures for user`,
          data: {
            userId: row.user_id,
            failures: row.failures,
            timeWindow: '15 minutes'
          },
          userId: row.user_id
        });
      }

      // Check for anomalous access patterns
      await this.checkAnomalousAccessPatterns();
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
    }
  }

  /**
   * Check for anomalous access patterns
   */
  private async checkAnomalousAccessPatterns(): Promise<void> {
    // Check for unusual access times
    const unusualHours = await postgresDb.query(`
      SELECT user_id, EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as attempts
      FROM security_audit_log
      WHERE created_at > NOW() - INTERVAL '7 days'
      AND action = 'login'
      GROUP BY user_id, EXTRACT(HOUR FROM created_at)
      HAVING COUNT(*) > 0
    `);

    // Find users logging in at unusual hours (2-6 AM)
    const unusualTimeUsers = unusualHours.rows.filter(row => row.hour >= 2 && row.hour <= 6);

    for (const user of unusualTimeUsers) {
      const totalAttempts = await postgresDb.query(
        `SELECT COUNT(*) FROM security_audit_log WHERE user_id = $1 AND action = 'login' AND created_at > NOW() - INTERVAL '7 days'`,
        [user.user_id]
      );

      const unusualPercentage = (user.attempts / parseInt(totalAttempts.rows[0].count)) * 100;

      if (unusualPercentage > 30) { // More than 30% of logins during unusual hours
        await this.triggerAlert({
          type: 'anomalous_access',
          severity: 'low',
          message: 'User accessing account at unusual hours',
          data: {
            userId: user.user_id,
            unusualHours: user.attempts,
            totalAttempts: totalAttempts.rows[0].count,
            percentage: unusualPercentage
          },
          userId: user.user_id
        });
      }
    }
  }

  /**
   * Handle critical security alerts
   */
  private async handleCriticalAlert(alert: SecurityAlert): Promise<void> {
    // Implement immediate response actions
    switch (alert.type) {
      case 'brute_force':
        // Block IP at firewall level (implementation depends on infrastructure)
        await this.blockIPAddress(alert.data.ipAddress);
        break;

      case 'multiple_failed_2fa':
        // Temporarily disable 2FA for the user
        await this.temporarilyDisable2FA(alert.userId);
        break;

      case 'account_lockout':
        // Increase security monitoring for affected accounts
        await this.increaseSecurityMonitoring(alert.userId);
        break;
    }
  }

  /**
   * Block IP address at application level
   */
  private async blockIPAddress(ipAddress: string): Promise<void> {
    // Add to blocked IPs table
    await postgresDb.query(`
      INSERT INTO blocked_ips (ip_address, reason, blocked_at, expires_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 hour')
      ON CONFLICT (ip_address) DO UPDATE SET
        blocked_at = NOW(),
        expires_at = NOW() + INTERVAL '1 hour'
    `, [ipAddress, `Brute force attack detected`]);
  }

  /**
   * Temporarily disable 2FA for user
   */
  private async temporarilyDisable2FA(userId: number): Promise<void> {
    // Set a flag to skip 2FA verification
    await postgresDb.query(`
      UPDATE users
      SET two_factor_temporarily_disabled = true,
        two_factor_disabled_until = NOW() + INTERVAL '30 minutes'
      WHERE id = $1
    `, [userId]);
  }

  /**
   * Increase security monitoring for user
   */
  private async increaseSecurityMonitoring(userId: number): Promise<void> {
    // Set flag for enhanced monitoring
    await postgresDb.query(`
      UPDATE users
      SET security_monitoring_level = 'high',
        security_monitoring_until = NOW() + INTERVAL '24 hours'
      WHERE id = $1
    `, [userId]);
  }

  /**
   * Generate daily security report
   */
  private async generateDailySecurityReport(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const report = await postgresDb.query(`
        SELECT
          COUNT(*) FILTER (WHERE action = 'login_attempt' AND result = 'failure') as failed_logins,
          COUNT(*) FILTER (WHERE action = 'account_locked') as account_locks,
          COUNT(*) FILTER (WHERE action = '2fa_verified' AND result = 'failure') as failed_2fa,
          COUNT(DISTINCT user_id) FILTER (WHERE action = 'login_attempt') as active_users,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(*) FILTER (WHERE result = 'failure') as total_failures
        FROM security_audit_log
        WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
      `);

      // Get top security events
      const topEvents = await postgresDb.query(`
        SELECT action, COUNT(*) as count
        FROM security_audit_log
        WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `);

      // Get suspicious IPs
      const suspiciousIPs = await postgresDb.query(`
        SELECT
          ip_address,
          COUNT(*) as events,
          COUNT(*) FILTER (WHERE result = 'failure') as failures
        FROM security_audit_log
        WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
        AND ip_address IS NOT NULL
        GROUP BY ip_address
        HAVING COUNT(*) FILTER (WHERE result = 'failure') > 5
        ORDER BY failures DESC
        LIMIT 10
      `);

      const securityReport = {
        date: yesterday.toISOString().split('T')[0],
        summary: report.rows[0],
        topEvents: topEvents.rows,
        suspiciousIPs: suspiciousIPs.rows
      };

      // Store report
      await postgresDb.query(`
        INSERT INTO daily_security_reports (report_data, report_date)
        VALUES ($1, $2)
        ON CONFLICT (report_date) DO UPDATE SET
          report_data = EXCLUDED.report_data,
          updated_at = NOW()
      `, [JSON.stringify(securityReport), yesterday.toISOString().split('T')[0]]);

      // Send report to security team
      await this.sendSecurityReport(securityReport);

      console.log('Daily security report generated');
    } catch (error) {
      console.error('Error generating security report:', error);
    }
  }

  /**
   * Send security report to team
   */
  private async sendSecurityReport(report: any): Promise<void> {
    // Implementation depends on notification system
    console.log('Security Report:', JSON.stringify(report, null, 2));
    // Could send email, Slack, or other notification methods
  }

  /**
   * Clean up old security logs
   */
  private async cleanupOldLogs(): Promise<void> {
    // Delete logs older than 90 days
    await postgresDb.query(`
      DELETE FROM security_audit_log
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);

    // Delete old alerts
    await postgresDb.query(`
      DELETE FROM security_alerts
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    // Clean up blocked IPs that have expired
    await postgresDb.query(`
      DELETE FROM blocked_ips
      WHERE expires_at < NOW()
    `);
  }

  /**
   * Get real-time security metrics
   */
  async getRealtimeMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const metrics = await postgresDb.query(`
      SELECT
        (SELECT COUNT(*) FROM security_audit_log WHERE created_at > $1) as total_events,
        (SELECT COUNT(*) FROM security_audit_log WHERE created_at > $1 AND result = 'failure') as failures,
        (SELECT COUNT(*) FROM login_attempts WHERE attempted_at > $1 AND success = false) as failed_logins,
        (SELECT COUNT(*) FROM account_lockouts WHERE created_at > $1 AND is_active = true) as active_lockouts,
        (SELECT COUNT(*) FROM user_sessions WHERE last_accessed_at > $1) as active_sessions,
        (SELECT COUNT(DISTINCT ip_address) FROM security_audit_log WHERE created_at > $1) as unique_ips
    `, [oneHourAgo]);

    return {
      timestamp: now.toISOString(),
      metrics: {
        totalEvents: parseInt(metrics.rows[0].total_events),
        failures: parseInt(metrics.rows[0].failures),
        failedLogins: parseInt(metrics.rows[0].failed_logins),
        activeLockouts: parseInt(metrics.rows[0].active_lockouts),
        activeSessions: parseInt(metrics.rows[0].active_sessions),
        uniqueIPs: parseInt(metrics.rows[0].unique_ips)
      }
    };
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(days: number = 7): Promise<any> {
    const dateRange = await postgresDb.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE action = 'login_attempt') as total_logins,
        COUNT(*) FILTER (WHERE action = 'login_attempt' AND result = 'success') as successful_logins,
        COUNT(*) FILTER (WHERE action = 'login_attempt' AND result = 'failure') as failed_logins,
        COUNT(*) FILTER (WHERE action = 'account_locked') as account_locks,
        COUNT(*) FILTER (WHERE action = '2fa_enabled') as two_factor_enabled,
        COUNT(*) FILTER (WHERE action = 'password_changed') as password_changes
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const topThreats = await postgresDb.query(`
      SELECT
        ip_address,
        COUNT(*) as threat_count,
        MAX(created_at) as last_seen
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      AND result = 'failure'
      GROUP BY ip_address
      ORDER BY threat_count DESC
      LIMIT 10
    `);

    const userActivity = await postgresDb.query(`
      SELECT
        user_id,
        COUNT(*) as events,
        COUNT(*) FILTER (WHERE result = 'failure') as failures,
        MAX(created_at) as last_activity
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY failures DESC
      LIMIT 10
    `);

    return {
      timeRange: `${days} days`,
      dailyStats: dateRange.rows,
      topThreats: topThreats.rows,
      suspiciousUsers: userActivity.rows
    };
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIPs(): Promise<any[]> {
    const result = await postgresDb.query(`
      SELECT * FROM blocked_ips
      WHERE expires_at > NOW()
      ORDER BY blocked_at DESC
    `);

    return result.rows.map(ip => ({
      ...ip,
      isExpired: new Date(ip.expires_at) < new Date()
    }));
  }

  /**
   * Manually block an IP
   */
  async blockIP(
    ipAddress: string,
    reason: string,
    hours: number = 24,
    blockedBy: number
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);

    await postgresDb.query(`
      INSERT INTO blocked_ips (ip_address, reason, blocked_by, blocked_at, expires_at)
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT (ip_address) DO UPDATE SET
        reason = EXCLUDED.reason,
        blocked_by = EXCLUDED.blocked_by,
        blocked_at = NOW(),
        expires_at = $4
    `, [ipAddress, reason, blockedBy, expiresAt]);

    await this.triggerAlert({
      type: 'ip_blocked',
      severity: 'medium',
      message: `IP ${ipAddress} blocked by admin: ${reason}`,
      data: {
        ipAddress,
        reason,
        hours,
        blockedBy
      }
    });
  }

  /**
   * Unblock an IP
   */
  async unblockIP(ipAddress: string): Promise<void> {
    await postgresDb.query(`
      UPDATE blocked_ips
      SET expires_at = NOW()
      WHERE ip_address = $1
    `, [ipAddress]);

    await this.triggerAlert({
      type: 'ip_unblocked',
      severity: 'low',
      message: `IP ${ipAddress} unblocked`,
      data: { ipAddress }
    });
  }
}

// Initialize security monitoring service
const securityMonitor = new SecurityMonitorService();
export default securityMonitor;