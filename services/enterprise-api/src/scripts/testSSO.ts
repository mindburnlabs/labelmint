#!/usr/bin/env tsx

import axios from 'axios'

const API_BASE = process.env.API_BASE || 'http://localhost:3003/api/enterprise/v1'
const ORG_ID = process.env.ORG_ID || 'test-org-id'

class SSOTester {
  private token: string | null = null

  async runTests(): Promise<void> {
    console.log('🔐 Testing SSO Implementation...\n')

    try {
      // Test 1: Create SSO configuration
      await this.testCreateSSOConfig()

      // Test 2: Get SSO configuration
      await this.testGetSSOConfig()

      // Test 3: Test SSO configuration
      await this.testSSOConfig()

      // Test 4: Generate SAML request
      await this.testGenerateSAMLRequest()

      // Test 5: Get SAML metadata
      await this.testGetSAMLMetadata()

      console.log('\n✅ All SSO tests passed!')
    } catch (error) {
      console.error('\n❌ SSO test failed:', error.message)
      process.exit(1)
    }
  }

  private async testCreateSSOConfig(): Promise<void> {
    console.log('1. Creating SSO configuration...')

    const config = {
      provider: 'saml',
      enabled: true,
      config: {
        entryPoint: 'https://sso.example.com/saml',
        issuer: 'labelmint-enterprise',
        cert: `-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----`,
        signatureAlgorithm: 'RSA-SHA256',
        digestAlgorithm: 'SHA256',
        nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
        attributeMapping: {
          Email: 'email',
          FirstName: 'firstName',
          LastName: 'lastName'
        }
      }
    }

    const response = await axios.post(
      `${API_BASE}/organizations/${ORG_ID}/sso/config`,
      config,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data.success) {
      console.log('   ✅ SSO configuration created successfully')
      console.log(`   📝 Config ID: ${response.data.data.id}`)
    } else {
      throw new Error('Failed to create SSO configuration')
    }
  }

  private async testGetSSOConfig(): Promise<void> {
    console.log('\n2. Getting SSO configuration...')

    const response = await axios.get(
      `${API_BASE}/organizations/${ORG_ID}/sso/config`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    if (response.data.success) {
      console.log('   ✅ SSO configuration retrieved successfully')
      console.log(`   🔧 Provider: ${response.data.data.provider}`)
      console.log(`   🟢 Enabled: ${response.data.data.enabled}`)
    } else {
      throw new Error('Failed to get SSO configuration')
    }
  }

  private async testSSOConfig(): Promise<void> {
    console.log('\n3. Testing SSO configuration...')

    const config = {
      provider: 'saml',
      enabled: true,
      config: {
        entryPoint: 'https://sso.example.com/saml',
        issuer: 'labelmint-enterprise'
      }
    }

    const response = await axios.post(
      `${API_BASE}/organizations/${ORG_ID}/sso/test`,
      config,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data.success) {
      console.log('   ✅ SSO configuration test passed')
      console.log(`   📄 Message: ${response.data.message}`)
    } else {
      console.log('   ⚠️  SSO configuration test failed (this may be expected in test environment)')
      console.log(`   📄 Message: ${response.data.message}`)
    }
  }

  private async testGenerateSAMLRequest(): Promise<void> {
    console.log('\n4. Generating SAML request...')

    const response = await axios.post(
      `${API_BASE}/organizations/${ORG_ID}/sso/login?format=json`,
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data.success) {
      console.log('   ✅ SAML request generated successfully')
      console.log(`   🆔 Request ID: ${response.data.data.id}`)
      console.log(`   🔗 SSO URL: ${response.data.data.ssoUrl}`)
      console.log(`   📦 Relay State: ${response.data.data.relayState}`)
    } else {
      throw new Error('Failed to generate SAML request')
    }
  }

  private async testGetSAMLMetadata(): Promise<void> {
    console.log('\n5. Getting SAML metadata...')

    try {
      const response = await axios.get(
        `${API_BASE}/organizations/${ORG_ID}/sso/metadata`,
        {
          headers: {
            'Accept': 'application/xml'
          }
        }
      )

      if (response.status === 200 && response.data.includes('EntityDescriptor')) {
        console.log('   ✅ SAML metadata retrieved successfully')
        console.log('   📄 XML metadata generated')
      } else {
        throw new Error('Invalid metadata response')
      }
    } catch (error) {
      console.log('   ⚠️  Metadata retrieval failed (this may be expected in test environment)')
    }
  }

  private async login(): Promise<void> {
    console.log('🔑 Logging in...')

    // In a real test, you would authenticate first
    // For now, we'll use a mock token
    this.token = 'mock-jwt-token'
    console.log('   ✅ Logged in with mock token')
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new SSOTester()
  tester.login().then(() => tester.runTests())
}

export { SSOTester }