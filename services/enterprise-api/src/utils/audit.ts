import { AuthenticatedRequest } from '../middleware/auth'

export interface AuditEvent {
  userId?: string
  organizationId?: string
  action: string
  resource: string
  resourceId?: string
  timestamp: Date
  metadata?: Record<string, any>
  ip?: string
  userAgent?: string
}

export class AuditLogger {
  private events: AuditEvent[] = []

  log(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      action,
      resource,
      resourceId,
      timestamp: new Date(),
      metadata,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }

    this.events.push(event)

    // In production, this would log to a database or logging service
    console.log('AUDIT:', JSON.stringify(event))
  }

  getEvents(filters?: Partial<AuditEvent>): AuditEvent[] {
    if (!filters) return this.events

    return this.events.filter(event => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined) return true
        return (event as any)[key] === value
      })
    })
  }

  clear(): void {
    this.events = []
  }
}

export const auditLogger = new AuditLogger()