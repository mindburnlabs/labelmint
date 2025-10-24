import axios, { AxiosRequestConfig } from 'axios'
import { NodeExecutor, RuntimeContext, NodeResult } from '../../WorkflowEngine.js'

export class ApiCallExecutor implements NodeExecutor {
  async execute(node: any, context: RuntimeContext): Promise<NodeResult> {
    const {
      method,
      url,
      headers,
      params,
      body,
      bodyType,
      timeout = 30000,
      authentication,
      responseMapping
    } = node.data.config

    await context.logger.info('Making API call', {
      method,
      url,
      timeout
    })

    try {
      // Prepare request configuration
      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: this.interpolateUrl(url, context),
        timeout,
        headers: this.processHeaders(headers || {}, context)
      }

      // Handle query parameters
      if (params) {
        config.params = this.interpolateObject(params, context)
      }

      // Handle request body
      if (body && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
        switch (bodyType) {
          case 'json':
            config.data = this.interpolateObject(body, context)
            config.headers = {
              ...config.headers,
              'Content-Type': 'application/json'
            }
            break
          case 'form':
            config.data = this.interpolateObject(body, context)
            config.headers = {
              ...config.headers,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
            break
          case 'raw':
            config.data = this.interpolateString(body, context)
            break
        }
      }

      // Handle authentication
      if (authentication) {
        await this.applyAuthentication(config, authentication, context)
      }

      // Make the API call
      const response = await axios(config)

      // Process response
      const processedResponse = await this.processResponse(response, responseMapping, context)

      await context.logger.info('API call successful', {
        status: response.status,
        responseSize: JSON.stringify(response.data).length
      })

      // Store response in context
      context.execution.context.variables.lastApiResponse = processedResponse

      return {
        output: {
          statusCode: response.status,
          headers: response.headers,
          data: processedResponse,
          success: true
        }
      }

    } catch (error: any) {
      await context.logger.error('API call failed', error)

      // Check if we should fail the workflow
      const errorHandling = node.data.errorHandling || { continueOnError: false }
      if (!errorHandling.continueOnError) {
        throw error
      }

      return {
        output: {
          statusCode: error.response?.status || 0,
          error: error.message,
          data: error.response?.data,
          success: false
        }
      }
    }
  }

  private interpolateUrl(url: string, context: RuntimeContext): string {
    // Replace variables in URL
    return this.interpolateString(url, context)
  }

  private interpolateString(template: string, context: RuntimeContext): string {
    const variables = context.execution.context.variables
    const input = context.execution.input

    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      // Handle nested paths like ${user.id} or ${data.items[0]}
      const keys = path.split('.')
      let value: any = { ...variables, ...input }

      for (const key of keys) {
        // Handle array access
        const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
        if (arrayMatch) {
          value = value[arrayMatch[1]]
          if (value && Array.isArray(value)) {
            value = value[parseInt(arrayMatch[2])]
          }
        } else {
          value = value[key]
        }

        if (value === undefined) {
          return match // Return original if not found
        }
      }

      return String(value)
    })
  }

  private interpolateObject(obj: any, context: RuntimeContext): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, context))
    } else if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = typeof value === 'string'
          ? this.interpolateString(value, context)
          : this.interpolateObject(value, context)
      }
      return result
    }
    return obj
  }

  private processHeaders(headers: Record<string, string>, context: RuntimeContext): Record<string, string> {
    const processed: Record<string, string> = {}

    for (const [key, value] of Object.entries(headers)) {
      processed[key] = this.interpolateString(value, context)
    }

    // Add default headers
    processed['User-Agent'] = processed['User-Agent'] || 'LabelMint-Workflow/1.0'

    return processed
  }

  private async applyAuthentication(
    config: AxiosRequestConfig,
    auth: any,
    context: RuntimeContext
  ): Promise<void> {
    switch (auth.type) {
      case 'bearer':
        const token = this.interpolateString(auth.token, context)
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`
        }
        break

      case 'basic':
        const username = this.interpolateString(auth.username, context)
        const password = this.interpolateString(auth.password, context)
        config.auth = { username, password }
        break

      case 'api_key':
        const apiKey = this.interpolateString(auth.key, context)
        const keyName = auth.name || 'X-API-Key'
        config.headers = {
          ...config.headers,
          [keyName]: apiKey
        }
        break

      case 'oauth2':
        // In a real implementation, handle OAuth2 flow
        const accessToken = await this.getOAuth2AccessToken(auth, context)
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${accessToken}`
        }
        break

      default:
        await context.logger.warn('Unknown authentication type', { type: auth.type })
    }
  }

  private async getOAuth2AccessToken(auth: any, context: RuntimeContext): Promise<string> {
    // Simplified OAuth2 token retrieval
    // In production, this would handle token refresh, caching, etc.
    try {
      const response = await axios.post(auth.tokenUrl, {
        grant_type: 'client_credentials',
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        scope: auth.scope
      })

      return response.data.access_token
    } catch (error) {
      throw new Error(`Failed to get OAuth2 access token: ${error.message}`)
    }
  }

  private async processResponse(
    response: any,
    mapping: any,
    context: RuntimeContext
  ): Promise<any> {
    if (!mapping) {
      return response.data
    }

    const result: any = {}

    for (const [outputKey, sourcePath] of Object.entries(mapping)) {
      if (typeof sourcePath === 'string') {
        // Extract value from response using path
        result[outputKey] = this.extractValue(response.data, sourcePath)
      } else if (typeof sourcePath === 'object') {
        // Handle transformation
        const { path, transform } = sourcePath as any
        let value = this.extractValue(response.data, path as string)

        if (transform) {
          value = await this.applyTransformation(value, transform, context)
        }

        result[outputKey] = value
      }
    }

    return result
  }

  private extractValue(obj: any, path: string): any {
    const keys = path.split('.')
    let value = obj

    for (const key of keys) {
      if (value && typeof value === 'object') {
        // Handle array access
        const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
        if (arrayMatch) {
          value = value[arrayMatch[1]]
          if (value && Array.isArray(value)) {
            value = value[parseInt(arrayMatch[2])]
          }
        } else {
          value = value[key]
        }
      } else {
        return undefined
      }
    }

    return value
  }

  private async applyTransformation(
    value: any,
    transform: any,
    context: RuntimeContext
  ): Promise<any> {
    switch (transform.type) {
      case 'map':
        // Apply mapping
        return transform.mapping[value] || value

      case 'filter':
        // Filter array
        if (Array.isArray(value)) {
          return value.filter((item: any) => {
            return this.extractValue(item, transform.field) === transform.value
          })
        }
        return value

      case 'format':
        // Format value
        return transform.template.replace('{value}', String(value))

      case 'script':
        // Execute custom transformation script
        return await this.executeTransformationScript(value, transform.script, context)

      default:
        return value
    }
  }

  private async executeTransformationScript(
    value: any,
    script: string,
    context: RuntimeContext
  ): Promise<any> {
    // Simple script execution for transformation
    // In production, use a proper sandbox
    try {
      const { Script } = await import('vm')
      const scriptObj = new Script(`
        (function(value) {
          ${script}
        })
      `)

      const result = scriptObj.runInNewContext({ value })
      return result
    } catch (error) {
      await context.logger.warn('Transformation script failed', {
        error: error.message
      })
      return value
    }
  }
}