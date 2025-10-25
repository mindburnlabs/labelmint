export interface ApiServiceConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}

class ApiService {
  private config: ApiServiceConfig | null = null

  initialize(config: ApiServiceConfig) {
    this.config = config
  }

  getConfig(): ApiServiceConfig {
    if (!this.config) {
      throw new Error('ApiService not initialized. Call initialize() first.')
    }
    return this.config
  }

  // Basic API methods can be added here as needed
  async get<T>(endpoint: string): Promise<T> {
    const config = this.getConfig()
    const response = await fetch(`${config.baseURL}${endpoint}`, {
      method: 'GET',
      headers: config.headers,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const config = this.getConfig()
    const response = await fetch(`${config.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}

// Singleton instance
const apiService = new ApiService()

export function initializeApiService(config: ApiServiceConfig) {
  apiService.initialize(config)
}

export function getApiService(): ApiService {
  return apiService
}

// API service singleton
export default apiService