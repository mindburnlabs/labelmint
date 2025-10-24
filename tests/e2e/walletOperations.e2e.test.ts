import { test, expect, type Page } from '@playwright/test';
import { TonWalletService } from '../../../packages/ui/src/services/tonWalletService';
import { ApiService, initializeApiService } from '../../../packages/ui/src/services/apiService';

class WalletPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/wallet');
  }

  async waitForWalletLoad() {
    await this.page.waitForSelector('[data-testid="wallet-balance"]');
  }

  async getBalanceDisplay() {
    return this.page.locator('[data-testid="wallet-balance"]');
  }

  async getTonBalance() {
    return this.page.locator('[data-testid="ton-balance"]');
  }

  async getUSDTBalance() {
    return this.page.locator('[data-testid="usdt-balance"]');
  }

  async getTransactionHistory() {
    return this.page.locator('[data-testid="transaction-history"]');
  }

  async getSendButton() {
    return this.page.locator('[data-testid="send-button"]');
  }

  async getReceiveButton() {
    return this.page.locator('[data-testid="receive-button"]');
  }

  async openSendModal() {
    await this.getSendButton().click();
    await this.page.waitForSelector('[data-testid="send-modal"]');
  }

  async fillSendForm(params: { address: string; amount: string; message?: string }) {
    await this.page.fill('[data-testid="recipient-address"]', params.address);
    await this.page.fill('[data-testid="send-amount"]', params.amount);

    if (params.message) {
      await this.page.fill('[data-testid="send-message"]', params.message);
    }
  }

  async confirmSend() {
    await this.page.click('[data-testid="confirm-send"]');
  }

  async waitForTransactionComplete() {
    await this.page.waitForSelector('[data-testid="transaction-success"]', { timeout: 10000 });
  }

  async getErrorMessage() {
    return this.page.locator('[data-testid="error-message"]');
  }

  async connectTelegramWallet() {
    await this.page.click('[data-testid="connect-telegram-wallet"]');
    await this.page.waitForSelector('[data-testid="wallet-connected"]', { timeout: 5000 });
  }

  async disconnectWallet() {
    await this.page.click('[data-testid="disconnect-wallet"]');
    await this.page.waitForSelector('[data-testid="connect-wallet-button"]');
  }
}

test.describe('Wallet Operations E2E Tests', () => {
  let walletPage: WalletPage;
  let walletService: TonWalletService;
  let apiService: ApiService;

  test.beforeAll(async () => {
    // Initialize services for testing
    walletService = new TonWalletService({
      network: 'testnet',
      apiKey: 'test-key'
    });

    apiService = initializeApiService({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      timeout: 30000,
      getAuthToken: () => process.env.TEST_AUTH_TOKEN || 'test-token'
    });
  });

  test.beforeEach(async ({ page }) => {
    walletPage = new WalletPage(page);

    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('authToken', 'test-mock-token');
    });

    // Mock API responses
    await page.route('**/api/payments/wallet*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          wallet: {
            address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            balances: {
              ton: '10.5',
              usdt: '250.75',
              jettons: {
                USDT: '250.75',
                USDC: '100.25'
              }
            }
          }
        })
      });
    });

    await page.route('**/api/payments/transactions*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            onChain: [
              {
                id: 'tx_123',
                txHash: '0x123abc',
                fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
                toAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
                amount: '1.5',
                currency: 'TON',
                status: 'confirmed',
                timestamp: '2024-01-15T10:30:00Z',
                description: 'Test transaction'
              }
            ],
            internal: []
          }
        })
      });
    });
  });

  test('should load wallet page and display balance', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Verify wallet balance is displayed
    const balanceElement = walletPage.getBalanceDisplay();
    await expect(balanceElement).toBeVisible();

    // Verify individual currency balances
    const tonBalance = walletPage.getTonBalance();
    const usdtBalance = walletPage.getUSDTBalance();

    await expect(tonBalance).toContainText('10.5');
    await expect(usdtBalance).toContainText('250.75');

    // Verify transaction history is loaded
    const transactionHistory = walletPage.getTransactionHistory();
    await expect(transactionHistory).toBeVisible();
  });

  test('should send TON transaction successfully', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Mock successful transaction
    await page.route('**/api/payments/transaction/send', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          txHash: '0xnewtransaction123',
          message: 'Transaction sent successfully'
        })
      });
    });

    // Open send modal
    await walletPage.openSendModal();

    // Fill send form
    await walletPage.fillSendForm({
      address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      amount: '1.5',
      message: 'Test E2E transaction'
    });

    // Confirm send
    await walletPage.confirmSend();

    // Wait for transaction completion
    await walletPage.waitForTransactionComplete();

    // Verify success message
    await expect(page.locator('[data-testid="transaction-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-success"]')).toContainText('0xnewtransaction123');
  });

  test('should handle transaction failure gracefully', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Mock failed transaction
    await page.route('**/api/payments/transaction/send', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Insufficient balance'
        })
      });
    });

    // Open send modal and fill form
    await walletPage.openSendModal();
    await walletPage.fillSendForm({
      address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      amount: '1000', // More than balance
      message: 'Should fail'
    });

    // Confirm send
    await walletPage.confirmSend();

    // Verify error message
    const errorMessage = walletPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Insufficient balance');
  });

  test('should validate transaction form inputs', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Open send modal
    await walletPage.openSendModal();

    // Try to send with empty form
    await walletPage.confirmSend();

    // Verify validation errors
    await expect(page.locator('[data-testid="address-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="amount-error"]')).toBeVisible();

    // Fill with invalid address
    await page.fill('[data-testid="recipient-address"]', 'invalid-address');
    await walletPage.confirmSend();

    await expect(page.locator('[data-testid="address-error"]')).toContainText('Invalid address format');

    // Fill with invalid amount
    await page.fill('[data-testid="recipient-address"]', 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP');
    await page.fill('[data-testid="send-amount"]', '-10');
    await walletPage.confirmSend();

    await expect(page.locator("[data-testid='amount-error']")).toContainText('Amount must be positive');
  });

  test('should display transaction history with correct formatting', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Verify transaction history items
    const transactionItems = page.locator('[data-testid="transaction-item"]');
    await expect(transactionItems).toHaveCount(1);

    const firstTransaction = transactionItems.first();
    await expect(firstTransaction.locator('[data-testid="transaction-amount"]')).toContainText('1.5');
    await expect(firstTransaction.locator('[data-testid="transaction-currency"]')).toContainText('TON');
    await expect(firstTransaction.locator('[data-testid="transaction-status"]')).toContainText('confirmed');
    await expect(firstTransaction.locator('[data-testid="transaction-hash"]')).toContainText('0x123abc');
  });

  test('should handle wallet connection and disconnection', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Mock Telegram WebApp
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          initData: 'mock_init_data',
          initDataUnsafe: {
            user: {
              id: 123456,
              first_name: 'Test',
              last_name: 'User',
              username: 'testuser'
            }
          }
        }
      };
    });

    // Mock Telegram wallet connection
    await page.route('**/api/payments/wallet/telegram/connect', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          walletAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          message: 'Telegram wallet connected successfully'
        })
      });
    });

    // Connect wallet
    await walletPage.connectTelegramWallet();

    // Verify wallet is connected
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-address"]')).toContainText('EQDk2VTvn04S...');

    // Disconnect wallet
    await walletPage.disconnectWallet();

    // Verify wallet is disconnected
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
  });

  test('should refresh balance and transactions after sending', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    let transactionCount = 0;

    // Mock transaction endpoints and count calls
    await page.route('**/api/payments/transaction/send', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          txHash: '0xnewtransaction456',
          message: 'Transaction sent successfully'
        })
      });
    });

    await page.route('**/api/payments/wallet*', async route => {
      transactionCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          wallet: {
            address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            balances: {
              ton: (9.0 - transactionCount * 0.1).toString(), // Decrease balance
              usdt: '250.75'
            }
          }
        })
      });
    });

    // Send transaction
    await walletPage.openSendModal();
    await walletPage.fillSendForm({
      address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      amount: '0.1',
      message: 'Balance refresh test'
    });
    await walletPage.confirmSend();

    // Wait for transaction completion
    await walletPage.waitForTransactionComplete();

    // Wait a bit for balance refresh
    await page.waitForTimeout(1000);

    // Verify balance was updated (should be called multiple times)
    expect(transactionCount).toBeGreaterThan(1);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Mock network error
    await page.route('**/api/payments/transaction/send', async route => {
      await route.abort('failed');
    });

    // Open send modal and fill form
    await walletPage.openSendModal();
    await walletPage.fillSendForm({
      address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      amount: '1.0'
    });

    // Confirm send
    await walletPage.confirmSend();

    // Verify network error handling
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-error"]')).toContainText('Network error');
  });

  test('should handle real-time balance updates', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Mock WebSocket or polling for balance updates
    let updateCount = 0;

    await page.route('**/api/payments/wallet*', async route => {
      updateCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          wallet: {
            address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            balances: {
              ton: (10.5 + updateCount * 0.5).toString(), // Increase balance
              usdt: '250.75'
            }
          }
        })
      });
    });

    // Wait for balance updates
    await page.waitForTimeout(35000); // Wait for polling interval

    // Verify balance was updated
    const tonBalance = walletPage.getTonBalance();
    await expect(tonBalance).toContainText('11.0'); // Should be updated at least once
  });

  test('should handle currency selection for transactions', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Open send modal
    await walletPage.openSendModal();

    // Select USDT
    await page.click('[data-testid="currency-selector"]');
    await page.click('[data-testid="currency-usdt"]');

    // Fill USDT transaction form
    await walletPage.fillSendForm({
      address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      amount: '25',
      message: 'USDT test transaction'
    });

    // Verify currency is displayed correctly
    await expect(page.locator('[data-testid="selected-currency"]')).toContainText('USDT');

    // Mock successful USDT transaction
    await page.route('**/api/payments/transaction/send', async route => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');

      expect(postData.tokenType).toBe('USDT');
      expect(postData.amount).toBe('25');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          txHash: '0xusdttransaction789',
          message: 'USDT transaction sent successfully'
        })
      });
    });

    // Confirm send
    await walletPage.confirmSend();
    await walletPage.waitForTransactionComplete();

    // Verify success
    await expect(page.locator('[data-testid="transaction-success"]')).toContainText('0xusdttransaction789');
  });

  test('should maintain responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-wallet-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-balance-card"]')).toBeVisible();

    // Test mobile send flow
    await page.click('[data-testid="mobile-send-button"]');
    await expect(page.locator('[data-testid="mobile-send-modal"]')).toBeVisible();

    // Verify form is usable on mobile
    await page.fill('[data-testid="mobile-recipient-address"]', 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP');
    await page.fill('[data-testid="mobile-send-amount"]', '1.0');
    await page.tap('[data-testid="mobile-confirm-send"]');

    // Should handle mobile-specific interactions
    await expect(page.locator('[data-testid="mobile-transaction-success"]')).toBeVisible();
  });

  test('should handle accessibility features', async ({ page }) => {
    await walletPage.navigate();
    await walletPage.waitForWalletLoad();

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Test ARIA labels
    await expect(page.locator('[aria-label="TON balance"]')).toBeVisible();
    await expect(page.locator('[aria-label="USDT balance"]')).toBeVisible();
    await expect(page.locator('[aria-label="Send transaction"]')).toBeVisible();

    // Test screen reader compatibility
    const tonBalance = page.locator('[data-testid="ton-balance"]');
    await expect(tonBalance).toHaveAttribute('aria-live', 'polite');
  });
});