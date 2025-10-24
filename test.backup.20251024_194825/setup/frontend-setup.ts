import { beforeAll, afterEach, vi } from 'vitest'
import { TextEncoder, TextDecoder } from 'util'
import { setup as setupUnit } from './unit-setup'

// Frontend-specific test setup
export function setupFrontend() {
  const { cleanup: unitCleanup } = setupUnit()

  // Mock browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {}

    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString()
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      get length() {
        return Object.keys(store).length
      },
      key: vi.fn((index: number) => {
        const keys = Object.keys(store)
        return keys[index] || null
      }),
    }
  })()

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })

  // Mock sessionStorage
  const sessionStorageMock = (() => {
    let store: Record<string, string> = {}

    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString()
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
    }
  })()

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  })

  // Mock geolocation
  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  }

  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  })

  // Mock Canvas API
  const mockCanvas = {
    getContext: vi.fn(() => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Array(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Array(4) })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    })),
    width: 300,
    height: 150,
    toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  }

  global.HTMLCanvasElement = vi.fn().mockImplementation(() => mockCanvas) as any

  // Mock WebGL context
  const mockWebGLContext = {
    canvas: mockCanvas,
    getExtension: vi.fn(),
    getParameter: vi.fn(),
    getShaderPrecisionFormat: vi.fn(),
  }

  global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockWebGLContext)

  // Setup TextEncoder/TextDecoder for jsdom
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder as any

  // Mock window methods that might not be available in jsdom
  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    value: vi.fn((cb: FrameRequestCallback) => setTimeout(cb, 0)),
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    value: vi.fn((id: number) => clearTimeout(id)),
  })

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  })) as any

  // Mock fetch for frontend tests
  global.fetch = vi.fn() as any

  // Extend test utilities with frontend-specific helpers
  global.testUtils = {
    ...global.testUtils,

    // Frontend-specific helpers
    mockRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      pathname: '/test',
      query: {},
      asPath: '/test',
    }),

    mockMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isLoading: false,
      error: null,
      data: null,
      reset: vi.fn(),
    }),

    mockQuery: () => ({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),

    mockForm: () => ({
      register: vi.fn(),
      unregister: vi.fn(),
      setValue: vi.fn(),
      getValue: vi.fn(),
      trigger: vi.fn(),
      formState: {
        errors: {},
        isValid: true,
        isDirty: false,
      },
    }),

    // React component testing helpers
    renderComponent: vi.fn(),
    fireEvent: vi.fn(),
    userEvent: vi.fn(),

    // Screen reader helpers
    getByRole: vi.fn(),
    getByText: vi.fn(),
    getByLabelText: vi.fn(),
    queryByRole: vi.fn(),
    queryByText: vi.fn(),
    queryByLabelText: vi.fn(),
  }

  // Cleanup after each test
  afterEach(() => {
    // Clear localStorage
    localStorageMock.clear()
    sessionStorageMock.clear()

    // Clear all mocks
    vi.clearAllMocks()
  })

  return {
    cleanup: () => {
      unitCleanup()
      vi.clearAllMocks()
    },
  }
}

// Auto-setup for frontend tests
const { cleanup } = setupFrontend()

export { cleanup }