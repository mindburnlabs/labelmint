import { test, expect } from '@playwright/test'

test.describe('Payment and Withdrawal Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated worker with balance
    await page.goto('/worker/login')
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-worker-token')
      localStorage.setItem('userRole', 'worker')
      localStorage.setItem('userBalance', '50.00')
    })
  })

  test('should display worker earnings and balance', async ({ page }) => {
    await page.goto('/worker/wallet')

    // Verify balance display
    await expect(page.locator('.current-balance')).toHaveText('$50.00')
    await expect(page.locator('.total-earned')).toBeVisible()
    await expect(page.locator('.pending-earnings')).toBeVisible()
    await expect(page.locator('.last-withdrawal')).toBeVisible()

    // Check transaction history
    await expect(page.locator('.transaction-list')).toBeVisible()
    await expect(page.locator('.transaction-item')).toHaveCount.greaterThan(0)
  })

  test('should allow withdrawal to TON wallet', async ({ page }) => {
    await page.goto('/worker/wallet')

    // Click withdraw button
    await page.click('[data-testid="withdraw-button"]')

    // Withdrawal modal appears
    await expect(page.locator('.withdrawal-modal')).toBeVisible()

    // Enter withdrawal amount
    await page.fill('[name="amount"]', '10.00')

    // Verify amount validation
    const feeElement = page.locator('.withdrawal-fee')
    await expect(feeElement).toBeVisible()
    const feeText = await feeElement.textContent()
    expect(feeText).toContain('Fee: $0.10')

    // Select withdrawal method
    await page.selectOption('[name="method"]', 'ton')

    // Enter wallet address
    await page.fill('[name="walletAddress"]', 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')

    // Confirm withdrawal
    await page.click('[data-testid="confirm-withdrawal"]')

    // 2FA verification
    await expect(page.locator('.two-factor-modal')).toBeVisible()
    await page.fill('[name="verificationCode"]', '123456')
    await page.click('[data-testid="verify-2fa"]')

    // Success message
    await expect(page.locator('.withdrawal-success')).toBeVisible()
    await expect(page.locator('.transaction-id')).toBeVisible()
  })

  test('should validate withdrawal limits and fees', async ({ page }) => {
    await page.goto('/worker/wallet')
    await page.click('[data-testid="withdraw-button"]')

    // Test minimum withdrawal amount
    await page.fill('[name="amount"]', '0.50')
    await page.click('[data-testid="confirm-withdrawal"]')

    // Should show minimum amount error
    await expect(page.locator('.amount-error')).toHaveText('Minimum withdrawal amount is $1.00')

    // Test maximum withdrawal limit
    await page.fill('[name="amount"]', '1000.00')
    await page.click('[data-testid="confirm-withdrawal"]')

    // Should show daily limit error
    await expect(page.locator('.amount-error')).toHaveText('Daily withdrawal limit is $500.00')

    // Test insufficient balance
    await page.fill('[name="amount"]', '100.00')
    await page.click('[data-testid="confirm-withdrawal"]')

    // Should show insufficient balance error
    await expect(page.locator('.amount-error')).toHaveText('Insufficient balance')
  })

  test('should allow withdrawal to bank account', async ({ page }) => {
    await page.goto('/worker/wallet')
    await page.click('[data-testid="withdraw-button"]')

    // Select bank transfer method
    await page.selectOption('[name="method"]', 'bank')

    // Fill bank details
    await page.fill('[name="accountName"]', 'John Doe')
    await page.fill('[name="accountNumber"]', '1234567890')
    await page.fill('[name="routingNumber"]', '987654321')
    await page.fill('[name="bankName"]', 'Test Bank')
    await page.fill('[name="amount"]', '25.00')

    // Higher fee for bank transfer
    await expect(page.locator('.withdrawal-fee')).toHaveText('Fee: $2.50')

    // Confirm withdrawal
    await page.click('[data-testid="confirm-withdrawal"]')

    // Bank withdrawal requires additional verification
    await expect(page.locator('.bank-verification')).toBeVisible()
    await page.check('[name="confirm-account"]')
    await page.click('[data-testid="submit-bank-withdrawal"]')

    // Success
    await expect(page.locator('.withdrawal-success')).toBeVisible()
  })

  test('should save payment methods for future use', async ({ page }) => {
    await page.goto('/worker/wallet/payment-methods')

    // Add new payment method
    await page.click('[data-testid="add-payment-method"]')

    // Add TON wallet
    await page.selectOption('[name="type"]', 'ton')
    await page.fill('[name="name"]', 'My TON Wallet')
    await page.fill('[name="address"]', 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')
    await page.check('[name="default"]')

    await page.click('[data-testid="save-method"]')

    // Verify method saved
    await expect(page.locator('.payment-method-saved')).toBeVisible()
    await expect(page.locator('.payment-method-item')).toHaveCount.greaterThan(0)

    // Use saved method for withdrawal
    await page.goto('/worker/wallet')
    await page.click('[data-testid="withdraw-button"]')

    // Select saved method
    await page.selectOption('[name="savedMethod"]', 'My TON Wallet')

    // Auto-filled address
    await expect(page.locator('[name="walletAddress"]')).toHaveValue('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')
  })

  test('should display transaction history with filters', async ({ page }) => {
    await page.goto('/worker/wallet/history')

    // Verify transaction list
    await expect(page.locator('.transaction-list')).toBeVisible()

    // Filter by date range
    await page.fill('[name="fromDate"]', '2024-01-01')
    await page.fill('[name="toDate"]', '2024-12-31')
    await page.click('[data-testid="apply-filter"]')

    // Filter by transaction type
    await page.selectOption('[name="transactionType"]', 'withdrawal')
    await page.click('[data-testid="apply-filter"]')

    // Verify filtered results
    const transactions = page.locator('.transaction-item')
    if (await transactions.count() > 0) {
      await expect(transactions.first().locator('.transaction-type')).toHaveText('Withdrawal')
    }

    // Export history
    await page.click('[data-testid="export-history"]')
    await expect(page.locator('.export-options')).toBeVisible()
    await page.selectOption('[name="format"]', 'csv')
    await page.click('[data-testid="download-export"]')
  })

  test('should handle withdrawal disputes', async ({ page }) => {
    await page.goto('/worker/wallet/history')

    // Find a withdrawal transaction
    const withdrawalTransaction = page.locator('.transaction-item').filter({ hasText: 'Withdrawal' }).first()
    if (await withdrawalTransaction.count() === 0) {
      test.skip('No withdrawal transactions found')
    }

    // Click dispute button
    await withdrawalTransaction.locator('[data-testid="dispute-button"]').click()

    // Dispute modal
    await expect(page.locator('.dispute-modal')).toBeVisible()

    // Select dispute reason
    await page.selectOption('[name="reason"]', 'not_received')
    await page.fill('[name="description"]', 'Withdrawal not received after 24 hours')

    // Upload evidence
    const fileInput = page.locator('[name="evidence"]')
    await fileInput.setInputFiles('test-evidence.png')

    // Submit dispute
    await page.click('[data-testid="submit-dispute"]')

    // Verify dispute created
    await expect(page.locator('.dispute-created')).toBeVisible()
    await expect(page.locator('.dispute-ticket-id')).toBeVisible()

    // Check status in transaction details
    await expect(withdrawalTransaction.locator('.transaction-status')).toHaveText('Under Review')
  })

  test('should show earnings analytics', async ({ page }) => {
    await page.goto('/worker/wallet/analytics')

    // Verify charts are displayed
    await expect(page.locator('.earnings-chart')).toBeVisible()
    await expect(page.locator('.task-type-chart')).toBeVisible()
    await expect(page.locator('.daily-earnings-chart')).toBeVisible()

    // View different time periods
    await page.selectOption('[name="period"]', 'week')
    await expect(page.locator('.chart-weekly')).toBeVisible()

    await page.selectOption('[name="period"]', 'month')
    await expect(page.locator('.chart-monthly')).toBeVisible()

    // Check earnings breakdown
    await expect(page.locator('.earnings-breakdown')).toBeVisible()
    await expect(page.locator('.task-earnings')).toBeVisible()
    await expect(page.locator('.bonus-earnings')).toBeVisible()
    await expect(page.locator('.total-earnings-summary')).toBeVisible()

    // Download report
    await page.click('[data-testid="download-report"]')
    await expect(page.locator('.report-generated')).toBeVisible()
  })

  test('should handle failed withdrawals', async ({ page }) => {
    await page.goto('/worker/wallet')

    // Simulate a failed withdrawal
    await page.evaluate(() => {
      const transaction = {
        id: 'failed_tx_123',
        type: 'withdrawal',
        amount: 10.00,
        status: 'failed',
        reason: 'Network timeout',
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('transactions', JSON.stringify([transaction]))
    })

    // Reload to see failed transaction
    await page.reload()

    // Failed transaction alert
    await expect(page.locator('.failed-transaction-alert')).toBeVisible()

    // Retry withdrawal
    await page.click('[data-testid="retry-withdrawal"]')

    // Check if retry options are available
    await expect(page.locator('.retry-options')).toBeVisible()
    await expect(page.locator('[data-testid="retry-same-wallet"]')).toBeVisible()
    await expect(page.locator('[data-testid="change-wallet"]')).toBeVisible()

    // Cancel failed transaction
    await page.click('[data-testid="cancel-transaction"]')
    await expect(page.locator('.transaction-cancelled')).toBeVisible()
  })
})