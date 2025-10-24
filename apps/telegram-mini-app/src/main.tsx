import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getApiService, initializeApiService } from '@labelmint/ui'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.MODE === 'production' ? 'https://api.labelmint.it/api' : 'http://localhost:3000/api')

if (typeof window !== 'undefined') {
  try {
    getApiService()
  } catch {
    initializeApiService({
      baseURL: API_BASE_URL,
      timeout: 15000,
      getAuthToken: () => {
        try {
          return (
            window.localStorage?.getItem('authToken') ??
            window.localStorage?.getItem('auth_token') ??
            window.sessionStorage?.getItem('authToken') ??
            null
          )
        } catch {
          return null
        }
      },
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
