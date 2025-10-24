import { vi } from 'vitest'

export interface MockPaymentRequest {
  userId: number
  amount: number
  currency: 'TON' | 'USDT'
  toAddress?: string
  description?: string
  isInternal?: boolean
  toUserId?: number
  metadata?: Record<string, any>
}

export interface MockPaymentResult {
  success: boolean
  transactionId?: string
  txHash?: string
  error?: string
  estimatedFee?: number
  estimatedTime?: number
}

export class MockPaymentService {
  private transactions: Map<string, MockPaymentResult> = new Map()
  private balances: Map<number, number> = new Map()

  constructor() {
    // Initialize with default user balances
    this.balances.set(1, 1000) // 1000 TON
    this.balances.set(2, 500)  // 500 TON
  }

  async processPayment(request: MockPaymentRequest): Promise<MockPaymentResult> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 100))

    const userBalance = this.balances.get(request.userId) || 0
    const fee = request.amount * 0.01 // 1% fee

    if (userBalance < request.amount + fee) {
      return {
        success: false,
        error: 'Insufficient balance',
        transactionId,
        estimatedFee: fee,
        estimatedTime: 0
      }
    }

    // Deduct balance and fee
    this.balances.set(request.userId, userBalance - request.amount - fee)
    this.transactions.set(transactionId, {
      success: true,
      transactionId,
      txHash: `hash_${Math.random().toString(36)}`,
      estimatedFee: fee,
      estimatedTime: 30000 // 30 seconds
    })

    return {
      success: true,
      transactionId,
      txHash: `hash_${Math.random().toString(36)}`,
      estimatedFee: fee,
      estimatedTime: 30000
    }
  }

  async validatePayment(transactionId: string): Promise<MockPaymentResult> {
    const transaction = this.transactions.get(transactionId)

    if (!transaction) {
      return {
        success: false,
        error: 'Transaction not found'
      }
    }

    // Simulate blockchain confirmation
    await new Promise(resolve => setTimeout(resolve, 5000))

    return transaction
  }

  getUserBalance(userId: number): number {
    return this.balances.get(userId) || 0
  }

  setUserBalance(userId: number, balance: number): void {
    this.balances.set(userId, balance)
  }

  getTransaction(transactionId: string): MockPaymentResult | undefined {
    return this.transactions.get(transactionId)
  }

  getAllTransactions(): MockPaymentResult[] {
    return Array.from(this.transactions.values())
  }

  // Helper method for tests
  static create(): MockPaymentService {
    return new MockPaymentService()
  }

  // Helper method for test setup
  static createWithBalances(balances: Record<number, number>): MockPaymentService {
    const service = new MockPaymentService()
    Object.entries(balances).forEach(([userId, balance]) => {
      service.setUserBalance(parseInt(userId), balance)
    })
    return service
  }

  // Reset method for test isolation
  reset(): void {
    this.transactions.clear()
    this.balances.clear()
    this.balances.set(1, 1000)
    this.balances.set(2, 500)
  }
}