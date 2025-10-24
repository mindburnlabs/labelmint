import { test, expect } from '@playwright/test'

test.describe('Client Registration Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies()
  })

  test('should register new client successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register')

    // Fill out registration form
    await page.fill('[name="name"]', 'Test Client Corp')
    await page.fill('[name="email"]', 'client@example.com')
    await page.fill('[name="telegram"]', '@test_client')
    await page.fill('[name="password"]', 'SecurePass123!')
    await page.fill('[name="confirmPassword"]', 'SecurePass123!')
    await page.check('[name="terms"]')

    // Submit registration
    await page.click('button[type="submit"]')

    // Verify successful registration
    await expect(page.locator('.success-message')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard/)

    // Verify user is logged in
    await expect(page.locator('.user-menu')).toBeVisible()
    await expect(page.locator('.user-name')).toHaveText('Test Client Corp')
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/register')

    // Try to submit without filling required fields
    await page.click('button[type="submit"]')

    // Verify error messages
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.name-error')).toHaveText('Name is required')
    await expect(page.locator('.email-error')).toHaveText('Email is required')
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/register')

    // Fill with invalid email
    await page.fill('[name="name"]', 'Test Client')
    await page.fill('[name="email"]', 'invalid-email')
    await page.fill('[name="password"]', 'SecurePass123!')
    await page.fill('[name="confirmPassword"]', 'SecurePass123!')
    await page.check('[name="terms"]')
    await page.click('button[type="submit"]')

    // Verify email validation error
    await expect(page.locator('.email-error')).toHaveText('Please enter a valid email address')
  })

  test('should validate password strength', async ({ page }) => {
    await page.goto('/register')

    // Fill with weak password
    await page.fill('[name="name"]', 'Test Client')
    await page.fill('[name="email"]', 'client@example.com')
    await page.fill('[name="password"]', '123')
    await page.fill('[name="confirmPassword"]', '123')
    await page.check('[name="terms"]')
    await page.click('button[type="submit"]')

    // Verify password strength error
    await expect(page.locator('.password-error')).toHaveText('Password must be at least 8 characters long')
  })

  test('should require terms acceptance', async ({ page }) => {
    await page.goto('/register')

    // Fill form but don't accept terms
    await page.fill('[name="name"]', 'Test Client')
    await page.fill('[name="email"]', 'client@example.com')
    await page.fill('[name="password"]', 'SecurePass123!')
    await page.fill('[name="confirmPassword"]', 'SecurePass123!')
    await page.click('button[type="submit"]')

    // Verify terms acceptance error
    await expect(page.locator('.terms-error')).toHaveText('You must accept the terms and conditions')
  })

  test('should prevent duplicate registration', async ({ page }) => {
    // First register successfully
    await page.goto('/register')
    await page.fill('[name="name"]', 'Test Client')
    await page.fill('[name="email"]', 'client@example.com')
    await page.fill('[name="password"]', 'SecurePass123!')
    await page.fill('[name="confirmPassword"]', 'SecurePass123!')
    await page.check('[name="terms"]')
    await page.click('button[type="submit"]')

    await expect(page.locator('.success-message')).toBeVisible()

    // Clear cookies and try to register again with same email
    await page.context().clearCookies()
    await page.goto('/register')
    await page.fill('[name="name"]', 'Test Client 2')
    await page.fill('[name="email"]', 'client@example.com')
    await page.fill('[name="password"]', 'SecurePass456!')
    await page.fill('[name="confirmPassword"]', 'SecurePass456!')
    await page.check('[name="terms"]')
    await page.click('button[type="submit"]')

    // Verify duplicate email error
    await expect(page.locator('.email-error')).toHaveText('An account with this email already exists')
  })
})