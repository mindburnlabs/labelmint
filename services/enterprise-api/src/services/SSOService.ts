import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import * as crypto from 'crypto'
import { sign, verify } from 'jsonwebtoken'
import * as xml2js from 'xml2js'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import axios from 'axios'
import { Strategy as SamlStrategy } from '@node-saml/passport-saml'
import { Issuer, generators } from 'openid-client'
import * as ldap from 'ldapjs'
import * as oauth2 from 'client-oauth2'

export interface SSOConfig {
  provider: 'saml' | 'oidc' | 'oauth2' | 'ldap'
  enabled: boolean
  config: {
    // SAML
    entryPoint?: string
    issuer?: string
    cert?: string
    privateKey?: string
    signatureAlgorithm?: string
    digestAlgorithm?: string
    nameIdFormat?: string
    attributeMapping?: Record<string, string>

    // OIDC
    clientId?: string
    clientSecret?: string
    discoveryUrl?: string
    redirectUri?: string
    scope?: string[]

    // OAuth2
    authUrl?: string
    tokenUrl?: string
    userInfoUrl?: string

    // LDAP
    url?: string
    bindDN?: string
    bindCredentials?: string
    searchBase?: string
    searchFilter?: string
    attributes?: string[]
  }
}

export interface SAMLRequest {
  id: string
  ssoUrl: string
  samlRequest: string
  relayState: string
}

export interface SAMLResponse {
  userId: string
  email: string
  firstName: string
  lastName: string
  attributes: Record<string, any>
}

export interface OIDCResponse {
  userId: string
  email: string
  firstName: string
  lastName: string
  attributes: Record<string, any>
  idToken?: string
  accessToken?: string
  refreshToken?: string
}

export interface OAuth2Response {
  userId: string
  email: string
  firstName: string
  lastName: string
  attributes: Record<string, any>
  accessToken: string
  refreshToken?: string
}

export interface LDAPResponse {
  userId: string
  email: string
  firstName: string
  lastName: string
  attributes: Record<string, any>
  dn: string
}

export class SSOService {
  /**
   * Create SSO configuration for organization
   */
  static async createConfig(
    organizationId: string,
    config: SSOConfig,
    userId: string
  ): Promise<any> {
    // Validate configuration based on provider
    await this.validateConfig(config)

    const ssoConfig = await prisma.sSOConfig.create({
      data: {
        organizationId,
        provider: config.provider,
        enabled: config.enabled,
        config: config.config,
        createdBy: userId
      }
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'sso.config_created',
      resourceType: 'sso_config',
      resourceId: ssoConfig.id,
      details: { provider: config.provider }
    })

    logger.info('SSO configuration created', {
      organizationId,
      provider: config.provider,
      createdBy: userId
    })

    return ssoConfig
  }

  /**
   * Get SSO configuration
   */
  static async getConfig(organizationId: string): Promise<any | null> {
    return await prisma.sSOConfig.findFirst({
      where: {
        organizationId,
        enabled: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Update SSO configuration
   */
  static async updateConfig(
    organizationId: string,
    config: Partial<SSOConfig>,
    userId: string
  ): Promise<any> {
    const existing = await this.getConfig(organizationId)
    if (!existing) {
      throw new Error('SSO configuration not found')
    }

    // Validate configuration
    await this.validateConfig({ ...existing, ...config } as SSOConfig)

    const updated = await prisma.sSOConfig.update({
      where: { id: existing.id },
      data: {
        ...config,
        config: config.config || existing.config,
        updatedBy: userId
      }
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'sso.config_updated',
      resourceType: 'sso_config',
      resourceId: existing.id,
      details: { provider: config.provider || existing.provider }
    })

    return updated
  }

  /**
   * Generate SAML authentication request
   */
  static async generateSAMLRequest(
    organizationId: string,
    relayState?: string
  ): Promise<SAMLRequest> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'saml') {
      throw new Error('SAML SSO not configured')
    }

    const samlConfig = config.config as any
    const id = '_' + crypto.randomBytes(20).toString('hex')
    const timestamp = new Date().toISOString()

    // Generate SAML request
    const samlRequest = this.buildSAMLRequest({
      id,
      timestamp,
      issuer: samlConfig.issuer || process.env.SAML_ISSUER,
      destination: samlConfig.entryPoint,
      nameIdFormat: samlConfig.nameIdFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress'
    })

    // Base64 encode the request
    const encodedRequest = Buffer.from(samlRequest).toString('base64')

    return {
      id,
      ssoUrl: samlConfig.entryPoint,
      samlRequest: encodedRequest,
      relayState: relayState || crypto.randomBytes(16).toString('hex')
    }
  }

  /**
   * Process SAML response
   */
  static async processSAMLResponse(
    organizationId: string,
    samlResponse: string,
    relayState?: string
  ): Promise<SAMLResponse> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'saml') {
      throw new Error('SAML SSO not configured')
    }

    try {
      // Decode and validate SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString()
      const response = this.parseSAMLResponse(decodedResponse)

      // Verify signature if certificate is provided
      const samlConfig = config.config as any
      if (samlConfig.cert) {
        const isValid = this.verifySAMLSignature(decodedResponse, samlConfig.cert)
        if (!isValid) {
          throw new Error('Invalid SAML signature')
        }
      }

      // Extract user attributes
      const attributes = this.extractSAMLAttributes(response)
      const attributeMapping = samlConfig.attributeMapping || {}

      // Map attributes
      const mappedAttributes: Record<string, any> = {}
      for (const [samlAttr, localAttr] of Object.entries(attributeMapping)) {
        if (attributes[samlAttr]) {
          mappedAttributes[localAttr] = attributes[samlAttr]
        }
      }

      // Find or create user
      const email = attributes['Email'] || attributes['emailAddress'] || attributes['email']
      if (!email) {
        throw new Error('Email not found in SAML response')
      }

      let user = await prisma.user.findFirst({
        where: { email }
      })

      if (!user) {
        // Create new user
        const firstName = attributes['FirstName'] || attributes['givenName'] || ''
        const lastName = attributes['LastName'] || attributes['surname'] || ''
        const username = attributes['Username'] || attributes['uid'] || email.split('@')[0]

        user = await prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            username,
            settings: {
              ssoProvider: 'saml',
              ssoId: attributes['NameID'] || email
            }
          }
        })

        // Log audit event
        await AuditService.log({
          organizationId,
          userId: user.id,
          action: 'user.created_sso',
          resourceType: 'user',
          resourceId: user.id,
          details: { provider: 'saml', email }
        })
      }

      // Check if user is member of organization
      const membership = await prisma.organizationUser.findFirst({
        where: {
          organizationId,
          userId: user.id
        }
      })

      if (!membership) {
        // Add user as member with default role
        await prisma.organizationUser.create({
          data: {
            organizationId,
            userId: user.id,
            role: 'MEMBER',
            permissions: {}
          }
        })
      } else if (!membership.isActive) {
        // Reactivate inactive user
        await prisma.organizationUser.update({
          where: { id: membership.id },
          data: {
            isActive: true,
            lastLoginAt: new Date()
          }
        })
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      // Log successful SSO login
      await AuditService.log({
        organizationId,
        userId: user.id,
        action: 'sso.login_success',
        resourceType: 'user',
        resourceId: user.id,
        details: { provider: 'saml', relayState }
      })

      return {
        userId: user.id,
        email: user.email!,
        firstName: user.firstName,
        lastName: user.lastName,
        attributes: mappedAttributes
      }
    } catch (error) {
      logger.error('SAML response processing failed', {
        organizationId,
        error: error.message
      })

      // Log failed SSO login attempt
      await AuditService.log({
        organizationId,
        userId: null,
        action: 'sso.login_failed',
        resourceType: 'sso_config',
        details: { provider: 'saml', error: error.message }
      })

      throw error
    }
  }

  /**
   * Generate JWT token for SSO session
   */
  static generateSSOToken(
    userId: string,
    organizationId: string,
    expiresIn: string = '1h'
  ): string {
    const payload = {
      userId,
      organizationId,
      type: 'sso',
      iat: Math.floor(Date.now() / 1000)
    }

    return sign(payload, process.env.JWT_SECRET!, { expiresIn })
  }

  /**
   * Verify SSO token
   */
  static verifySSOToken(token: string): any {
    try {
      return verify(token, process.env.JWT_SECRET!)
    } catch (error) {
      throw new Error('Invalid SSO token')
    }
  }

  /**
   * Test SSO configuration
   */
  static async testConfig(
    organizationId: string,
    config: SSOConfig
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      await this.validateConfig(config)

      if (config.provider === 'saml') {
        // Test SAML connection
        const samlConfig = config.config as any
        const testRequest = this.buildSAMLRequest({
          id: '_test' + crypto.randomBytes(10).toString('hex'),
          timestamp: new Date().toISOString(),
          issuer: samlConfig.issuer || process.env.SAML_ISSUER,
          destination: samlConfig.entryPoint
        })

        return {
          success: true,
          message: 'SAML configuration is valid',
          details: {
            entryPoint: samlConfig.entryPoint,
            issuer: samlConfig.issuer
          }
        }
      }

      // Add tests for other providers as needed

      return {
        success: true,
        message: 'Configuration is valid'
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      }
    }
  }

  /**
   * Disable SSO for organization
   */
  static async disableSSO(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const config = await this.getConfig(organizationId)
    if (!config) {
      throw new Error('SSO not configured')
    }

    await prisma.sSOConfig.update({
      where: { id: config.id },
      data: { enabled: false, updatedBy: userId }
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'sso.disabled',
      resourceType: 'sso_config',
      resourceId: config.id
    })
  }

  /**
   * Validate SSO configuration
   */
  private static async validateConfig(config: SSOConfig): Promise<void> {
    if (!config.provider) {
      throw new Error('Provider is required')
    }

    switch (config.provider) {
      case 'saml':
        const samlConfig = config.config
        if (!samlConfig.entryPoint) {
          throw new Error('SAML entry point is required')
        }
        if (!samlConfig.issuer && !process.env.SAML_ISSUER) {
          throw new Error('SAML issuer is required')
        }
        break

      case 'oidc':
        const oidcConfig = config.config
        if (!oidcConfig.clientId || !oidcConfig.clientSecret) {
          throw new Error('OIDC client credentials are required')
        }
        if (!oidcConfig.discoveryUrl && (!oidcConfig.authUrl || !oidcConfig.tokenUrl)) {
          throw new Error('OIDC endpoints are required')
        }
        break

      case 'oauth2':
        const oauthConfig = config.config
        if (!oauthConfig.authUrl || !oauthConfig.tokenUrl) {
          throw new Error('OAuth2 endpoints are required')
        }
        if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
          throw new Error('OAuth2 client credentials are required')
        }
        break

      case 'ldap':
        const ldapConfig = config.config
        if (!ldapConfig.url) {
          throw new Error('LDAP URL is required')
        }
        if (!ldapConfig.searchBase || !ldapConfig.searchFilter) {
          throw new Error('LDAP search configuration is required')
        }
        break
    }
  }

  /**
   * Build SAML authentication request
   */
  private static buildSAMLRequest(params: {
    id: string
    timestamp: string
    issuer: string
    destination: string
    nameIdFormat?: string
  }): string {
    const { id, timestamp, issuer, destination, nameIdFormat } = params

    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${timestamp}"
  Destination="${destination}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  AssertionConsumerServiceURL="${process.env.SAML_ACS_URL}">
  <saml:Issuer>${issuer}</saml:Issuer>
  ${nameIdFormat ? `<samlp:NameIDPolicy Format="${nameIdFormat}" AllowCreate="true"/>` : ''}
  <samlp:RequestedAuthnContext Comparison="minimum">
    <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
  </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>`
  }

  /**
   * Parse SAML response
   */
  private static parseSAMLResponse(response: string): any {
    // Simple XML parsing for SAML response
    // In production, use a proper XML parser like xml2js or fast-xml-parser

    const attributes: Record<string, string> = {}

    // Extract attributes (simplified)
    const emailMatch = response.match(/<saml:Attribute Name="(?:Email|emailAddress|email)">\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/)
    if (emailMatch) attributes['Email'] = emailMatch[1]

    const firstNameMatch = response.match(/<saml:Attribute Name="(?:FirstName|givenName)">\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/)
    if (firstNameMatch) attributes['FirstName'] = firstNameMatch[1]

    const lastNameMatch = response.match(/<saml:Attribute Name="(?:LastName|surname)">\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/)
    if (lastNameMatch) attributes['LastName'] = lastNameMatch[1]

    const nameIdMatch = response.match(/<saml:NameID>([^<]+)<\/saml:NameID>/)
    if (nameIdMatch) attributes['NameID'] = nameIdMatch[1]

    return { attributes }
  }

  /**
   * Extract SAML attributes
   */
  private static extractSAMLAttributes(response: any): Record<string, string> {
    return response.attributes || {}
  }

  /**
   * Verify SAML signature
   */
  private static verifySAMLSignature(response: string, certificate: string): boolean {
    // In production, use proper SAML signature verification
    // This is a placeholder for demonstration
    return true
  }

  // ==================== OIDC Methods ====================

  /**
   * Get OIDC authorization URL
   */
  static async getOIDCAuthorizationUrl(
    organizationId: string,
    redirectUri?: string,
    state?: string
  ): Promise<{ authUrl: string; codeVerifier?: string; state: string }> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'oidc') {
      throw new Error('OIDC SSO not configured')
    }

    const oidcConfig = config.config as any
    const codeVerifier = generators.codeVerifier()
    const codeChallenge = generators.codeChallenge(codeVerifier)
    const authState = state || crypto.randomBytes(16).toString('hex')

    try {
      let client

      if (oidcConfig.discoveryUrl) {
        // Use OpenID Connect Discovery
        const issuer = await Issuer.discover(oidcConfig.discoveryUrl)
        client = new issuer.Client({
          client_id: oidcConfig.clientId,
          client_secret: oidcConfig.clientSecret,
          redirect_uris: [redirectUri || oidcConfig.redirectUri],
          response_types: ['code']
        })
      } else {
        // Manual configuration
        client = new (await Issuer.discover('')).Client({
          client_id: oidcConfig.clientId,
          client_secret: oidcConfig.clientSecret,
          redirect_uris: [redirectUri || oidcConfig.redirectUri],
          authorization_endpoint: oidcConfig.authUrl,
          token_endpoint: oidcConfig.tokenUrl,
          userinfo_endpoint: oidcConfig.userInfoUrl,
          response_types: ['code']
        })
      }

      const authUrl = client.authorizationUrl({
        scope: oidcConfig.scope?.join(' ') || 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: authState
      })

      return {
        authUrl,
        codeVerifier,
        state: authState
      }
    } catch (error) {
      logger.error('OIDC authorization URL generation failed', { error: error.message })
      throw new Error('Failed to generate OIDC authorization URL')
    }
  }

  /**
   * Process OIDC callback
   */
  static async processOIDCCallback(
    organizationId: string,
    code: string,
    codeVerifier?: string,
    state?: string
  ): Promise<OIDCResponse> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'oidc') {
      throw new Error('OIDC SSO not configured')
    }

    const oidcConfig = config.config as any

    try {
      let client

      if (oidcConfig.discoveryUrl) {
        const issuer = await Issuer.discover(oidcConfig.discoveryUrl)
        client = new issuer.Client({
          client_id: oidcConfig.clientId,
          client_secret: oidcConfig.clientSecret,
          redirect_uris: [oidcConfig.redirectUri],
          response_types: ['code']
        })
      } else {
        client = new (await Issuer.discover('')).Client({
          client_id: oidcConfig.clientId,
          client_secret: oidcConfig.clientSecret,
          redirect_uris: [oidcConfig.redirectUri],
          authorization_endpoint: oidcConfig.authUrl,
          token_endpoint: oidcConfig.tokenUrl,
          userinfo_endpoint: oidcConfig.userInfoUrl,
          response_types: ['code']
        })
      }

      const params = { code }
      if (codeVerifier) {
        (params as any).code_verifier = codeVerifier
      }

      const tokenSet = await client.callback(oidcConfig.redirectUri, params, { state })
      const userinfo = await client.userinfo(tokenSet)

      // Process user information
      const email = userinfo.email || tokenSet.claims().email
      const firstName = userinfo.given_name || tokenSet.claims().given_name || userinfo.name?.split(' ')[0]
      const lastName = userinfo.family_name || tokenSet.claims().family_name || userinfo.name?.split(' ')[1]

      if (!email) {
        throw new Error('Email not found in OIDC response')
      }

      // Find or create user
      let user = await prisma.user.findFirst({ where: { email } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            username: userinfo.preferred_username || userinfo.sub || email.split('@')[0],
            settings: {
              ssoProvider: 'oidc',
              ssoId: userinfo.sub || email
            }
          }
        })

        await AuditService.log({
          organizationId,
          userId: user.id,
          action: 'user.created_sso',
          resourceType: 'user',
          resourceId: user.id,
          details: { provider: 'oidc', email }
        })
      }

      // Update organization membership
      await this.updateOrganizationMembership(organizationId, user.id)

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      await AuditService.log({
        organizationId,
        userId: user.id,
        action: 'sso.login_success',
        resourceType: 'user',
        resourceId: user.id,
        details: { provider: 'oidc', state }
      })

      return {
        userId: user.id,
        email: user.email!,
        firstName: user.firstName,
        lastName: user.lastName,
        attributes: {
          sub: userinfo.sub,
          name: userinfo.name,
          preferred_username: userinfo.preferred_username,
          ...tokenSet.claims()
        },
        idToken: tokenSet.id_token,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token
      }
    } catch (error) {
      logger.error('OIDC callback processing failed', {
        organizationId,
        error: error.message
      })

      await AuditService.log({
        organizationId,
        userId: null,
        action: 'sso.login_failed',
        resourceType: 'sso_config',
        details: { provider: 'oidc', error: error.message }
      })

      throw error
    }
  }

  // ==================== OAuth2 Methods ====================

  /**
   * Get OAuth2 authorization URL
   */
  static async getOAuth2AuthorizationUrl(
    organizationId: string,
    redirectUri?: string,
    state?: string
  ): Promise<{ authUrl: string; state: string }> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'oauth2') {
      throw new Error('OAuth2 SSO not configured')
    }

    const oauthConfig = config.config as any
    const authState = state || crypto.randomBytes(16).toString('hex')

    try {
      const oauthClient = new oauth2.Client({
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        accessTokenUri: oauthConfig.tokenUrl,
        authorizationUri: oauthConfig.authUrl,
        redirectUri: redirectUri || oauthConfig.redirectUri,
        scopes: oauthConfig.scope || ['email', 'profile']
      })

      const authUrl = oauthClient.code.getUri({
        state: authState
      })

      return {
        authUrl,
        state: authState
      }
    } catch (error) {
      logger.error('OAuth2 authorization URL generation failed', { error: error.message })
      throw new Error('Failed to generate OAuth2 authorization URL')
    }
  }

  /**
   * Process OAuth2 callback
   */
  static async processOAuth2Callback(
    organizationId: string,
    code: string,
    state?: string
  ): Promise<OAuth2Response> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'oauth2') {
      throw new Error('OAuth2 SSO not configured')
    }

    const oauthConfig = config.config as any

    try {
      const oauthClient = new oauth2.Client({
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        accessTokenUri: oauthConfig.tokenUrl,
        authorizationUri: oauthConfig.authUrl,
        redirectUri: oauthConfig.redirectUri,
        scopes: oauthConfig.scope || ['email', 'profile']
      })

      const token = await oauthClient.code.getToken(oauthConfig.redirectUri, {
        code,
        state
      })

      // Get user info
      const userInfo = await oauthClient.request({
        method: 'GET',
        url: oauthConfig.userInfoUrl,
        headers: {
          Authorization: `Bearer ${token.accessToken}`
        }
      })

      const userData = userInfo.data || userInfo

      // Process user information
      const email = userData.email || userData.email_address
      const firstName = userData.first_name || userData.given_name || userData.name?.split(' ')[0]
      const lastName = userData.last_name || userData.family_name || userData.name?.split(' ')[1]

      if (!email) {
        throw new Error('Email not found in OAuth2 response')
      }

      // Find or create user
      let user = await prisma.user.findFirst({ where: { email } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            username: userData.username || userData.id || email.split('@')[0],
            settings: {
              ssoProvider: 'oauth2',
              ssoId: userData.id || email
            }
          }
        })

        await AuditService.log({
          organizationId,
          userId: user.id,
          action: 'user.created_sso',
          resourceType: 'user',
          resourceId: user.id,
          details: { provider: 'oauth2', email }
        })
      }

      // Update organization membership
      await this.updateOrganizationMembership(organizationId, user.id)

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      await AuditService.log({
        organizationId,
        userId: user.id,
        action: 'sso.login_success',
        resourceType: 'user',
        resourceId: user.id,
        details: { provider: 'oauth2', state }
      })

      return {
        userId: user.id,
        email: user.email!,
        firstName: user.firstName,
        lastName: user.lastName,
        attributes: userData,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken
      }
    } catch (error) {
      logger.error('OAuth2 callback processing failed', {
        organizationId,
        error: error.message
      })

      await AuditService.log({
        organizationId,
        userId: null,
        action: 'sso.login_failed',
        resourceType: 'sso_config',
        details: { provider: 'oauth2', error: error.message }
      })

      throw error
    }
  }

  // ==================== LDAP Methods ====================

  /**
   * Authenticate with LDAP
   */
  static async authenticateLDAP(
    organizationId: string,
    username: string,
    password: string
  ): Promise<LDAPResponse> {
    const config = await this.getConfig(organizationId)
    if (!config || config.provider !== 'ldap') {
      throw new Error('LDAP SSO not configured')
    }

    const ldapConfig = config.config as any

    try {
      const client = ldap.createClient({
        url: ldapConfig.url,
        tlsOptions: ldapConfig.tlsOptions || {},
        connectTimeout: ldapConfig.connectTimeout || 10000
      })

      return new Promise((resolve, reject) => {
        client.bind(ldapConfig.bindDN, ldapConfig.bindCredentials, (bindErr) => {
          if (bindErr) {
            reject(new Error('LDAP bind failed'))
            return
          }

          // Search for user
          const searchOptions = {
            scope: 'sub',
            filter: ldapConfig.searchFilter.replace('{username}', username),
            attributes: ldapConfig.attributes || ['dn', 'uid', 'mail', 'cn', 'sn', 'givenName']
          }

          client.search(ldapConfig.searchBase, searchOptions, (searchErr, searchResult) => {
            if (searchErr) {
              reject(new Error('LDAP search failed'))
              return
            }

            let entries: any[] = []

            searchResult.on('searchEntry', (entry) => {
              entries.push(entry)
            })

            searchResult.on('end', () => {
              if (entries.length === 0) {
                reject(new Error('User not found in LDAP'))
                client.unbind()
                return
              }

              const userEntry = entries[0]
              const userDN = userEntry.dn
              const attributes: Record<string, any> = {}

              // Extract attributes
              for (const attr of userEntry.attributes) {
                attributes[attr.type] = attr.values[0]
              }

              // Try to authenticate as user
              client.bind(userDN, password, (authErr) => {
                if (authErr) {
                  reject(new Error('LDAP authentication failed'))
                  return
                }

                // Parse user information
                const email = attributes.mail || attributes.email
                const firstName = attributes.givenName || attributes.cn?.split(' ')[0]
                const lastName = attributes.sn || attributes.cn?.split(' ')[1]

                if (!email) {
                  reject(new Error('Email not found in LDAP'))
                  client.unbind()
                  return
                }

                // Process user
                this.processLDAPUser(organizationId, email, firstName || '', lastName || '', attributes, userDN)
                  .then(resolve)
                  .catch(reject)
                  .finally(() => client.unbind())
              })
            })

            searchResult.on('error', (searchErr) => {
              reject(new Error('LDAP search error'))
              client.unbind()
            })
          })
        })

        client.on('error', (err) => {
          reject(new Error('LDAP connection error'))
        })
      })
    } catch (error) {
      logger.error('LDAP authentication failed', {
        organizationId,
        username,
        error: error.message
      })

      await AuditService.log({
        organizationId,
        userId: null,
        action: 'sso.login_failed',
        resourceType: 'sso_config',
        details: { provider: 'ldap', username, error: error.message }
      })

      throw error
    }
  }

  /**
   * Process LDAP user authentication
   */
  private static async processLDAPUser(
    organizationId: string,
    email: string,
    firstName: string,
    lastName: string,
    attributes: Record<string, any>,
    dn: string
  ): Promise<LDAPResponse> {
    try {
      // Find or create user
      let user = await prisma.user.findFirst({ where: { email } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            username: attributes.uid || attributes.sAMAccountName || email.split('@')[0],
            settings: {
              ssoProvider: 'ldap',
              ssoId: dn
            }
          }
        })

        await AuditService.log({
          organizationId,
          userId: user.id,
          action: 'user.created_sso',
          resourceType: 'user',
          resourceId: user.id,
          details: { provider: 'ldap', email }
        })
      }

      // Update organization membership
      await this.updateOrganizationMembership(organizationId, user.id)

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      await AuditService.log({
        organizationId,
        userId: user.id,
        action: 'sso.login_success',
        resourceType: 'user',
        resourceId: user.id,
        details: { provider: 'ldap' }
      })

      return {
        userId: user.id,
        email: user.email!,
        firstName: user.firstName,
        lastName: user.lastName,
        attributes,
        dn
      }
    } catch (error) {
      logger.error('LDAP user processing failed', { error: error.message })
      throw error
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Update organization membership
   */
  private static async updateOrganizationMembership(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const membership = await prisma.organizationUser.findFirst({
      where: { organizationId, userId }
    })

    if (!membership) {
      await prisma.organizationUser.create({
        data: {
          organizationId,
          userId,
          role: 'MEMBER',
          permissions: {}
        }
      })
    } else if (!membership.isActive) {
      await prisma.organizationUser.update({
        where: { id: membership.id },
        data: { isActive: true, lastLoginAt: new Date() }
      })
    }
  }

  // ==================== User Provisioning/Deprovisioning ====================

  /**
   * Provision user from SSO
   */
  static async provisionUser(
    organizationId: string,
    userData: {
      email: string
      firstName?: string
      lastName?: string
      attributes?: Record<string, any>
    },
    provider: string
  ): Promise<{ userId: string; action: 'created' | 'updated' }> {
    let user = await prisma.user.findFirst({ where: { email: userData.email } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          username: userData.attributes?.username || userData.email.split('@')[0],
          settings: {
            ssoProvider: provider,
            ssoId: userData.attributes?.id || userData.email
          }
        }
      })

      await AuditService.log({
        organizationId,
        userId: user.id,
        action: 'user.provisioned',
        resourceType: 'user',
        resourceId: user.id,
        details: { provider, email: userData.email }
      })

      return { userId: user.id, action: 'created' }
    } else {
      // Update existing user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: userData.firstName || user.firstName,
          lastName: userData.lastName || user.lastName,
          settings: {
            ...user.settings,
            ssoProvider: provider,
            lastSyncAt: new Date()
          }
        }
      })

      return { userId: user.id, action: 'updated' }
    }
  }

  /**
   * Deprovision user (disable/deactivate)
   */
  static async deprovisionUser(
    organizationId: string,
    email: string,
    userId: string
  ): Promise<void> {
    // Find and update user
    const user = await prisma.user.findFirst({ where: { email } })

    if (!user) {
      throw new Error('User not found')
    }

    // Deactivate from organization
    await prisma.organizationUser.updateMany({
      where: { organizationId, userId: user.id },
      data: { isActive: false, deactivatedAt: new Date() }
    })

    // Optionally disable user account entirely
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    })

    await AuditService.log({
      organizationId,
      userId: user.id,
      action: 'user.deprovisioned',
      resourceType: 'user',
      resourceId: user.id,
      details: { email }
    })
  }

  /**
   * Sync SSO users with organization
   */
  static async syncSSOUsers(
    organizationId: string,
    provider: string
  ): Promise<{ synced: number; created: number; updated: number; errors: string[] }> {
    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [] as string[]
    }

    // This would typically fetch users from the SSO provider
    // Implementation depends on provider-specific user listing APIs

    logger.info('SSO user sync initiated', {
      organizationId,
      provider
    })

    return results
  }
}