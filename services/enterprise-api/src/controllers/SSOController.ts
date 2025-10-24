import { Request, Response, NextFunction } from 'express'
import { SSOService } from '../services/SSOService.js'
import { SSOTemplatesService } from '../services/SSOTemplatesService.js'
import { logger } from '../utils/logger.js'
import { AuditService } from '../services/AuditService.js'

export class SSOController {
  /**
   * Create SSO configuration
   */
  static async createConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id
      const config = req.body

      const ssoConfig = await SSOService.createConfig(organizationId, config, userId)

      res.status(201).json({
        success: true,
        data: ssoConfig,
        message: 'SSO configuration created successfully'
      })
    } catch (error) {
      logger.error('Create SSO config error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get SSO configuration
   */
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id

      const config = await SSOService.getConfig(organizationId)

      if (!config) {
        res.status(404).json({
          success: false,
          error: 'SSO configuration not found'
        })
        return
      }

      // Don't expose sensitive information
      const sanitizedConfig = {
        ...config,
        config: this.sanitizeConfig(config.config, config.provider)
      }

      res.json({
        success: true,
        data: sanitizedConfig
      })
    } catch (error) {
      logger.error('Get SSO config error', { error: error.message })
      next(error)
    }
  }

  /**
   * Update SSO configuration
   */
  static async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id
      const config = req.body

      const updated = await SSOService.updateConfig(organizationId, config, userId)

      res.json({
        success: true,
        data: updated,
        message: 'SSO configuration updated successfully'
      })
    } catch (error) {
      logger.error('Update SSO config error', { error: error.message })
      next(error)
    }
  }

  /**
   * Test SSO configuration
   */
  static async testConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const config = req.body

      const result = await SSOService.testConfig(organizationId, config)

      res.json({
        success: result.success,
        message: result.message,
        data: result.details
      })
    } catch (error) {
      logger.error('Test SSO config error', { error: error.message })
      next(error)
    }
  }

  /**
   * Initiate SSO login
   */
  static async initiateSSO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { relayState } = req.query

      const samlRequest = await SSOService.generateSAMLRequest(
        organizationId,
        relayState as string
      )

      // Render SAML request form or redirect
      if (req.query.format === 'json') {
        res.json({
          success: true,
          data: samlRequest
        })
      } else {
        // Redirect to IdP with SAML request
        const redirectUrl = `${samlRequest.ssoUrl}?SAMLRequest=${encodeURIComponent(samlRequest.samlRequest)}&RelayState=${encodeURIComponent(samlRequest.relayState)}`
        res.redirect(redirectUrl)
      }
    } catch (error) {
      logger.error('Initiate SSO error', { error: error.message })
      next(error)
    }
  }

  /**
   * Handle SSO response
   */
  static async handleSSOResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { SAMLResponse, RelayState } = req.body

      if (!SAMLResponse) {
        res.status(400).json({
          success: false,
          error: 'SAML response is required'
        })
        return
      }

      const response = await SSOService.processSAMLResponse(
        organizationId,
        SAMLResponse,
        RelayState
      )

      // Generate JWT token
      const token = SSOService.generateSSOToken(
        response.userId,
        organizationId
      )

      // Set session cookie
      res.cookie('sso_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000 // 1 hour
      })

      // Redirect based on relay state or default
      const redirectUrl = RelayState || '/dashboard'
      res.redirect(`${redirectUrl}?token=${token}&userId=${response.userId}`)
    } catch (error) {
      logger.error('Handle SSO response error', { error: error.message })
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Disable SSO
   */
  static async disableSSO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id

      await SSOService.disableSSO(organizationId, userId)

      res.json({
        success: true,
        message: 'SSO disabled successfully'
      })
    } catch (error) {
      logger.error('Disable SSO error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get SSO metadata for IdP configuration
   */
  static async getMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params

      // Generate SAML metadata
      const metadata = this.generateSAMLMetadata(organizationId)

      res.set('Content-Type', 'application/xml')
      res.send(metadata)
    } catch (error) {
      logger.error('Get SSO metadata error', { error: error.message })
      next(error)
    }
  }

  /**
   * Validate SSO token
   */
  static async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token is required'
        })
        return
      }

      const decoded = SSOService.verifySSOToken(token)

      res.json({
        success: true,
        data: {
          userId: decoded.userId,
          organizationId: decoded.organizationId,
          type: decoded.type,
          valid: true
        }
      })
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }
  }

  /**
   * Logout from SSO
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { token } = req.body

      // Verify token
      const decoded = SSOService.verifySSOToken(token)

      // Log audit event
      await AuditService.log({
        organizationId,
        userId: decoded.userId,
        action: 'sso.logout',
        resourceType: 'user',
        resourceId: decoded.userId
      })

      // Clear cookie
      res.clearCookie('sso_token')

      res.json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (error) {
      logger.error('SSO logout error', { error: error.message })
      next(error)
    }
  }

  /**
   * Sanitize configuration to hide sensitive information
   */
  private static sanitizeConfig(config: any, provider: string): any {
    const sanitized = { ...config }

    switch (provider) {
      case 'saml':
        delete sanitized.privateKey
        break
      case 'oidc':
      case 'oauth2':
        delete sanitized.clientSecret
        break
      case 'ldap':
        delete sanitized.bindCredentials
        break
    }

    return sanitized
  }

  /**
   * Generate SAML metadata
   */
  private static generateSAMLMetadata(organizationId: string): string {
    const entityID = `${process.env.BASE_URL}/sso/${organizationId}/metadata`
    const acsUrl = `${process.env.BASE_URL}/sso/${organizationId}/acs`
    const sloUrl = `${process.env.BASE_URL}/sso/${organizationId}/slo`

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityID}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="true"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${process.env.SAML_CERTIFICATE || ''}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="1"
      isDefault="true" />
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${sloUrl}" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
  }

  /**
   * Get available SSO templates
   */
  static async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = SSOTemplatesService.getAllTemplates()

      res.json({
        success: true,
        data: {
          templates: Object.keys(templates),
          details: templates
        },
        message: 'SSO templates retrieved successfully'
      })
    } catch (error) {
      logger.error('Get SSO templates error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get specific SSO template
   */
  static async getTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params

      const template = SSOTemplatesService.getTemplateByProvider(provider)

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'SSO template not found for this provider'
        })
        return
      }

      res.json({
        success: true,
        data: template,
        message: 'SSO template retrieved successfully'
      })
    } catch (error) {
      logger.error('Get SSO template error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get setup instructions for SSO provider
   */
  static async getSetupInstructions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params

      const instructions = SSOTemplatesService.getSetupInstructions(provider)

      if (!instructions) {
        res.status(404).json({
          success: false,
          error: 'Setup instructions not found for this provider'
        })
        return
      }

      res.json({
        success: true,
        data: instructions,
        message: 'Setup instructions retrieved successfully'
      })
    } catch (error) {
      logger.error('Get SSO setup instructions error', { error: error.message })
      next(error)
    }
  }
}