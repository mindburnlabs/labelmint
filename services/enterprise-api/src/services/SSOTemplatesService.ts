import { SSOConfig } from './SSOService.js'
import { logger } from '../utils/logger.js'

export class SSOTemplatesService {

  /**
   * Get Azure AD SSO configuration template
   */
  static getAzureADTemplate(): SSOConfig {
    return {
      provider: 'oidc',
      enabled: true,
      config: {
        clientId: '',
        clientSecret: '',
        discoveryUrl: 'https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration',
        redirectUri: '{base-url}/api/v1/organizations/{organization-id}/sso/acs',
        scope: ['openid', 'profile', 'email', 'User.Read'],
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          displayName: 'name',
          groups: 'groups'
        }
      }
    }
  }

  /**
   * Get Google Workspace SSO configuration template
   */
  static getGoogleWorkspaceTemplate(): SSOConfig {
    return {
      provider: 'oidc',
      enabled: true,
      config: {
        clientId: '',
        clientSecret: '',
        discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
        redirectUri: '{base-url}/api/v1/organizations/{organization-id}/sso/acs',
        scope: ['openid', 'profile', 'email'],
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          displayName: 'name',
          picture: 'picture'
        }
      }
    }
  }

  /**
   * Get Okta SSO configuration template
   */
  static getOktaTemplate(): SSOConfig {
    return {
      provider: 'saml',
      enabled: true,
      config: {
        entryPoint: 'https://{your-okta-domain}.okta.com/app/{app-id}/sso/saml',
        issuer: '{your-issuer}',
        cert: '',
        privateKey: '',
        signatureAlgorithm: 'RSA-SHA256',
        digestAlgorithm: 'SHA256',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attributeMapping: {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
          groups: 'http://schemas.xmlsoap.org/claims/Group'
        }
      }
    }
  }

  /**
   * Get Active Directory LDAP configuration template
   */
  static getActiveDirectoryTemplate(): SSOConfig {
    return {
      provider: 'ldap',
      enabled: true,
      config: {
        url: 'ldap://your-domain-controller.com:389',
        bindDN: 'cn=admin,dc=company,dc=com',
        bindCredentials: '',
        searchBase: 'ou=Users,dc=company,dc=com',
        searchFilter: '(sAMAccountName={{username}})',
        attributes: ['mail', 'givenName', 'sn', 'displayName', 'memberOf', 'userPrincipalName'],
        attributeMapping: {
          email: 'mail',
          firstName: 'givenName',
          lastName: 'sn',
          displayName: 'displayName',
          username: 'sAMAccountName',
          groups: 'memberOf'
        },
        secureLDAP: true,
        port: 636
      }
    }
  }

  /**
   * Get all available SSO templates
   */
  static getAllTemplates(): Record<string, SSOConfig> {
    return {
      'azure-ad': this.getAzureADTemplate(),
      'google-workspace': this.getGoogleWorkspaceTemplate(),
      'okta': this.getOktaTemplate(),
      'active-directory': this.getActiveDirectoryTemplate()
    }
  }

  /**
   * Get SSO template by provider type
   */
  static getTemplateByProvider(provider: string): SSOConfig | null {
    const templates = this.getAllTemplates()
    return templates[provider] || null
  }

  /**
   * Validate SSO configuration based on provider
   */
  static validateConfig(config: SSOConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    switch (config.provider) {
      case 'oidc':
        if (!config.config.clientId) errors.push('Client ID is required for OIDC')
        if (!config.config.clientSecret) errors.push('Client secret is required for OIDC')
        if (!config.config.discoveryUrl) errors.push('Discovery URL is required for OIDC')
        if (!config.config.redirectUri) errors.push('Redirect URI is required for OIDC')
        break

      case 'saml':
        if (!config.config.entryPoint) errors.push('Entry point is required for SAML')
        if (!config.config.issuer) errors.push('Issuer is required for SAML')
        if (!config.config.cert) errors.push('Certificate is required for SAML')
        break

      case 'ldap':
        if (!config.config.url) errors.push('LDAP URL is required')
        if (!config.config.searchBase) errors.push('Search base is required')
        if (!config.config.searchFilter) errors.push('Search filter is required')
        break

      case 'oauth2':
        if (!config.config.authUrl) errors.push('Authorization URL is required for OAuth2')
        if (!config.config.tokenUrl) errors.push('Token URL is required for OAuth2')
        break

      default:
        errors.push('Invalid provider type')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate setup instructions for each provider
   */
  static getSetupInstructions(provider: string): { title: string; steps: string[] } | null {
    const instructions: Record<string, { title: string; steps: string[] }> = {
      'azure-ad': {
        title: 'Azure AD Setup Instructions',
        steps: [
          'Sign in to Azure Portal (portal.azure.com)',
          'Navigate to Azure Active Directory > App registrations',
          'Click "New registration"',
          'Enter a name (e.g., "LabelMint Enterprise")',
          'Select "Accounts in this organizational directory only"',
          'Set the redirect URI to Web and enter your callback URL',
          'Copy the Application (client) ID',
          'Go to Certificates & secrets > New client secret',
          'Copy the client secret value',
          'Go to Endpoints and copy the OpenID Connect metadata URL'
        ]
      },
      'google-workspace': {
        title: 'Google Workspace Setup Instructions',
        steps: [
          'Go to Google Cloud Console (console.cloud.google.com)',
          'Create a new project or select an existing one',
          'Go to APIs & Services > Credentials',
          'Click "Create Credentials" > "OAuth client ID"',
          'Select "Web application"',
          'Add your redirect URI',
          'Copy the Client ID and Client Secret',
          'Go to APIs & Services > Library',
          'Enable "Google+ API" and "People API"',
          'Configure OAuth consent screen if required'
        ]
      },
      'okta': {
        title: 'Okta Setup Instructions',
        steps: [
          'Sign in to your Okta admin console',
          'Go to Applications > Applications',
          'Click "Add Application"',
          'Select "SAML 2.0"',
          'Enter a name for your application',
          'Configure SAML settings with LabelMint metadata URL',
          'Configure attribute mappings',
          'Download the Identity Provider certificate',
          'Copy the Identity Provider Single Sign-On URL'
        ]
      },
      'active-directory': {
        title: 'Active Directory LDAP Setup Instructions',
        steps: [
          'Ensure LDAP over SSL (LDAPS) is configured on your domain controller',
          'Create a dedicated service account for LDAP bind operations',
          'Note the LDAP server hostname and port (636 for LDAPS)',
          'Identify the user search base DN',
          'Test LDAP connectivity using ldapsearch or similar tool',
          'Ensure the service account has read permissions to user attributes'
        ]
      }
    }

    return instructions[provider] || null
  }
}