import { Request, Response, NextFunction } from 'express'

export interface TenantRequest extends Request {
  tenantId?: string
  organizationId?: string
}

export function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract tenant from headers or JWT token
  const tenantId = req.headers['x-tenant-id'] as string
  const organizationId = req.headers['x-organization-id'] as string

  req.tenantId = tenantId
  req.organizationId = organizationId

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: { message: 'Tenant ID is required' }
    })
    return
  }

  next()
}