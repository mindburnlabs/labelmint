import { Application } from 'express'
import organizationRoutes from './organizations'
import teamRoutes from './teams'
import ssoRoutes from './sso'
import userRoutes from './users'
import projectRoutes from './projects'
import workflowRoutes from './workflows'
import analyticsRoutes from './analytics'
import billingRoutes from './billing'
import integrationRoutes from './integrations'
import directoryRoutes from './directory'
import complianceRoutes from './compliance'

export function setupRoutes(app: Application, basePath: string): void {
  // Organization routes
  app.use(`${basePath}/organizations`, organizationRoutes)

  // Team routes
  app.use(`${basePath}`, teamRoutes)

  // SSO routes
  app.use(`${basePath}`, ssoRoutes)

  // API routes
  app.use(`${basePath}`, userRoutes)
  app.use(`${basePath}`, projectRoutes)
  app.use(`${basePath}`, workflowRoutes)
  app.use(`${basePath}`, analyticsRoutes)
  app.use(`${basePath}/billing`, billingRoutes)
  app.use(`${basePath}/integrations`, integrationRoutes)
  app.use(`${basePath}`, directoryRoutes)
  app.use(`${basePath}`, complianceRoutes)

  // API documentation endpoint
  app.get(`${basePath}`, (req, res) => {
    res.json({
      name: 'LabelMint Enterprise API',
      version: '1.0.0',
      description: 'Enterprise API for LabelMint data labeling platform',
      endpoints: {
        organizations: `${basePath}/organizations`,
        teams: `${basePath}/organizations/:organizationId/teams`,
        sso: `${basePath}/organizations/:organizationId/sso`,
        users: `${basePath}/organizations/:organizationId/users`,
        projects: `${basePath}/organizations/:organizationId/projects`,
        workflows: `${basePath}/workflows`,
        analytics: `${basePath}/analytics`,
        billing: `${basePath}/billing`,
        integrations: `${basePath}/integrations`,
        directory: `${basePath}/organizations/:organizationId/directory`,
        compliance: `${basePath}/organizations/:organizationId/compliance`,
      },
      documentation: `${basePath}/docs`, // TODO
      health: '/health'
    })
  })
}
