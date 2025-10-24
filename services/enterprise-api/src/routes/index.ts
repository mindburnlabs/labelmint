import { Application } from 'express'
import organizationRoutes from './organizations.js'
import teamRoutes from './teams.js'
import ssoRoutes from './sso.js'
// import userRoutes from './users.js'
// import projectRoutes from './projects.js'
// import workflowRoutes from './workflows.js'
// import analyticsRoutes from './analytics.js'
// import billingRoutes from './billing.js'
// import integrationRoutes from './integrations.js'

export function setupRoutes(app: Application, basePath: string): void {
  // Organization routes
  app.use(`${basePath}/organizations`, organizationRoutes)

  // Team routes
  app.use(`${basePath}`, teamRoutes)

  // SSO routes
  app.use(`${basePath}`, ssoRoutes)

  // TODO: Add other route modules as they are created
  // app.use(`${basePath}/users`, userRoutes)
  // app.use(`${basePath}/projects`, projectRoutes)
  // app.use(`${basePath}/workflows`, workflowRoutes)
  // app.use(`${basePath}/analytics`, analyticsRoutes)
  // app.use(`${basePath}/billing`, billingRoutes)
  // app.use(`${basePath}/integrations`, integrationRoutes)

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
        users: `${basePath}/users`, // TODO
        projects: `${basePath}/projects`, // TODO
        workflows: `${basePath}/workflows`, // TODO
        analytics: `${basePath}/analytics`, // TODO
        billing: `${basePath}/billing`, // TODO
        integrations: `${basePath}/integrations`, // TODO
      },
      documentation: `${basePath}/docs`, // TODO
      health: '/health'
    })
  })
}