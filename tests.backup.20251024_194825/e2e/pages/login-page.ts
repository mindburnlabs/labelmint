import { Page, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly telegramLoginButton = this.page.locator('[data-testid="telegram-login-button"]');
  readonly connectWalletButton = this.page.locator('[data-testid="connect-wallet"]');
  readonly errorMessage = this.page.locator('[data-testid="error-message"]');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
  }

  async loginWithTelegram() {
    // Mock Telegram authentication response
    await this.page.route('**/api/auth/telegram', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 123456789,
              telegramId: 123456789,
              telegramUsername: 'testuser',
              telegramFirstName: 'Test',
              telegramLastName: 'User',
              role: 'WORKER',
              isVerified: true,
              reputation: 95
            },
            token: 'mock_jwt_token_12345'
          }
        })
      });
    });

    await this.telegramLoginButton.click();
    await this.page.waitForURL('/dashboard');
  }

  async loginAsClient() {
    // Mock Telegram authentication for client
    await this.page.route('**/api/auth/telegram', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 987654321,
              telegramId: 987654321,
              telegramUsername: 'testclient',
              telegramFirstName: 'Test',
              telegramLastName: 'Client',
              role: 'CLIENT',
              isVerified: true,
              reputation: 100
            },
            token: 'mock_client_jwt_token_67890'
          }
        })
      });
    });

    await this.telegramLoginButton.click();
    await this.page.waitForURL('/dashboard');
  }

  async loginAsAdmin() {
    await this.page.route('**/api/auth/telegram', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 555555555,
              telegramId: 555555555,
              telegramUsername: 'testadmin',
              telegramFirstName: 'Test',
              telegramLastName: 'Admin',
              role: 'ADMIN',
              isVerified: true,
              reputation: 100
            },
            token: 'mock_admin_jwt_token_11111'
          }
        })
      });
    });

    await this.telegramLoginButton.click();
    await this.page.waitForURL('/admin/dashboard');
  }

  async loginWithInvalidData() {
    await this.page.route('**/api/auth/telegram', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Authentication failed'
        })
      });
    });

    await this.telegramLoginButton.click();
  }

  async connectWallet() {
    // Mock wallet connection
    await this.page.evaluate(() => {
      (window as any).tonConnect = {
        connect: (wallets: any) => ({
          request: (method: string, params: any) => {
            if (method === 'ton_connect') {
              return Promise.resolve({
                device: {
                  platform: 'test'
                }
              });
            }
          }
        })
      };
    });

    await this.connectWalletButton.click();
    await expect(this.page.locator('[data-testid="wallet-connected"]')).toBeVisible();
  }

  async verifySuccessMessage() {
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  async verifyErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async waitForLoginRedirect() {
    await this.page.waitForNavigation({
      url: (url) => {
        return url.pathname === '/dashboard' ||
               url.pathname === '/admin/dashboard' ||
               url.pathname === '/onboarding';
      }
    });
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout"]');
    await this.page.waitForURL('/');
  }
}