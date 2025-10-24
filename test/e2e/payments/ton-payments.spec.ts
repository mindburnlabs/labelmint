import { test, expect } from '@playwright/test'

test.describe('TON Payment Integration', () => {
  const API_BASE = 'http://localhost:3002/api'
  let authToken: string
  let walletAddress: string

  test.beforeAll(async ({ request }) => {
    // Authenticate and get token
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: 'testworker',
        password: 'testpassword123'
      }
    })

    const data = await response.json()
    authToken = data.token

    // Create test wallet
    const walletResponse = await request.post(`${API_BASE}/wallet/create`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        type: 'TON'
      }
    })

    const walletData = await walletResponse.json()
    walletAddress = walletData.address
  })

  test('POST /wallet/deposit - should generate deposit address', async ({ request }) => {
    const response = await request.post(`${API_BASE}/wallet/deposit`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        currency: 'TON',
        amount: 10
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('deposit_address')
    expect(data).toHaveProperty('qr_code')
    expect(data).toHaveProperty('expires_at')
    expect(data.currency).toBe('TON')
  })

  test('POST /payments/verify - should verify TON transaction', async ({ request }) => {
    // Mock transaction hash
    const txHash = '0x1234567890abcdef1234567890abcdef12345678'

    const response = await request.post(`${API_BASE}/payments/verify`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        transaction_hash: txHash,
        currency: 'TON',
        amount: 10
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('verified')
    expect(data).toHaveProperty('amount')
    expect(data).toHaveProperty('from_address')
    expect(data).toHaveProperty('to_address')
    expect(data).toHaveProperty('block_number')
  })

  test('POST /wallet/withdraw - should withdraw TON to external address', async ({ request }) => {
    // First, ensure sufficient balance
    await request.post(`${API_BASE}/wallet/balance/add`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        currency: 'TON',
        amount: 100,
        reason: 'test_balance'
      }
    })

    const response = await request.post(`${API_BASE}/wallet/withdraw`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        currency: 'TON',
        amount: 5,
        to_address: 'EQD_test_external_address',
        fee: 0.1
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('transaction_id')
    expect(data).toHaveProperty('transaction_hash')
    expect(data.status).toBe('PENDING')
    expect(data.amount).toBe(5)
  })

  test('GET /wallet/balance - should fetch wallet balances', async ({ request }) => {
    const response = await request.get(`${API_BASE}/wallet/balance`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('balances')
    expect(Array.isArray(data.balances)).toBe(true)

    const tonBalance = data.balances.find((b: any) => b.currency === 'TON')
    expect(tonBalance).toBeDefined()
    expect(tonBalance).toHaveProperty('amount')
    expect(tonBalance).toHaveProperty('usd_value')
  })

  test('GET /transactions - should fetch transaction history', async ({ request }) => {
    const response = await request.get(`${API_BASE}/transactions`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        currency: 'TON',
        type: 'deposit',
        limit: 10,
        offset: 0
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('transactions')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('page')
    expect(Array.isArray(data.transactions)).toBe(true)
  })

  test('POST /payments/batch - should process batch payments', async ({ request }) => {
    const batchData = [
      {
        user_id: 12345,
        amount: 5,
        currency: 'TON',
        reason: 'Task completion reward'
      },
      {
        user_id: 12346,
        amount: 7.5,
        currency: 'TON',
        reason: 'Bonus payment'
      },
      {
        user_id: 12347,
        amount: 3,
        currency: 'TON',
        reason: 'Refund'
      }
    ]

    const response = await request.post(`${API_BASE}/payments/batch`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        payments: batchData
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('batch_id')
    expect(data).toHaveProperty('results')
    expect(Array.isArray(data.results)).toBe(true)
    expect(data.results).toHaveLength(3)
  })

  test('GET /payments/estimate - should estimate transaction fees', async ({ request }) => {
    const response = await request.get(`${API_BASE}/payments/estimate`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        currency: 'TON',
        amount: 10,
        to_address: 'EQD_test_external_address'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('fee')
    expect(data).toHaveProperty('total_cost')
    expect(data).toHaveProperty('estimated_time')
    expect(data.currency).toBe('TON')
  })

  test('POST /payments/escrow - should create escrow payment', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/escrow`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        amount: 20,
        currency: 'TON',
        recipient_id: 12346,
        conditions: {
          task_completion: true,
          accuracy_threshold: 0.9
        },
        release_timeout: 86400 // 24 hours
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('escrow_id')
    expect(data).toHaveProperty('transaction_hash')
    expect(data.status).toBe('HELD')
    expect(data.amount).toBe(20)
  })

  test('POST /payments/escrow/:id/release - should release escrow payment', async ({ request }) => {
    // First create an escrow
    const createResponse = await request.post(`${API_BASE}/payments/escrow`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        amount: 15,
        currency: 'TON',
        recipient_id: 12346,
        conditions: {
          task_completion: true
        }
      }
    })
    const escrow = await createResponse.json()

    // Release the escrow
    const response = await request.post(`${API_BASE}/payments/escrow/${escrow.escrow_id}/release`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        reason: 'Task completed successfully'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('RELEASED')
    expect(data).toHaveProperty('released_at')
    expect(data).toHaveProperty('transaction_hash')
  })

  test('GET /wallet/stats - should fetch wallet statistics', async ({ request }) => {
    const response = await request.get(`${API_BASE}/wallet/stats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        period: '30d'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('total_deposited')
    expect(data).toHaveProperty('total_withdrawn')
    expect(data).toHaveProperty('net_balance')
    expect(data).toHaveProperty('transaction_count')
    expect(data).toHaveProperty('currency_breakdown')
  })

  test('POST /payments/webhook - should handle TON webhook', async ({ request }) => {
    const webhookData = {
      event: 'transaction.confirmed',
      data: {
        transaction_hash: '0x1234567890abcdef',
        from_address: 'EQD_sender_address',
        to_address: walletAddress,
        amount: 50,
        currency: 'TON',
        block_number: 123456,
        timestamp: new Date().toISOString()
      },
      signature: 'test_signature'
    }

    const response = await request.post(`${API_BASE}/payments/webhook`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ton-Signature': 'test_signature'
      },
      data: webhookData
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('processed')
    expect(data).toHaveProperty('balance_updated')
  })

  test('GET /payments/rates - should fetch TON exchange rates', async ({ request }) => {
    const response = await request.get(`${API_BASE}/payments/rates`, {
      params: {
        base: 'TON',
        targets: 'USD,EUR,BTC'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('base')
    expect(data).toHaveProperty('rates')
    expect(data.rates).toHaveProperty('USD')
    expect(data.rates).toHaveProperty('EUR')
    expect(data.rates).toHaveProperty('BTC')
    expect(data).toHaveProperty('updated_at')
  })

  test('POST /wallet/convert - should convert TON to USDT', async ({ request }) => {
    const response = await request.post(`${API_BASE}/wallet/convert`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        from_currency: 'TON',
        to_currency: 'USDT',
        amount: 10,
        rate: 5.5 // 1 TON = 5.5 USDT
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('transaction_id')
    expect(data).toHaveProperty('from_amount')
    expect(data).toHaveProperty('to_amount')
    expect(data).toHaveProperty('rate_used')
    expect(data.from_amount).toBe(10)
    expect(data.to_amount).toBe(55)
  })
})