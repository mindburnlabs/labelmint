import { test, expect } from '@playwright/test'

test.describe('Worker Onboarding Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test('should onboard new Telegram worker successfully', async ({ page }) => {
    // Navigate to Telegram bot onboarding flow
    await page.goto('/worker/start')

    // Click "Start with Telegram" button
    await page.click('[data-testid="telegram-start-button"]')

    // Simulate Telegram authentication
    await expect(page.locator('.telegram-auth-modal')).toBeVisible()
    await page.click('[data-testid="auth-with-telegram"]')

    // Worker is redirected to Telegram (simulated)
    await page.goto('/worker/telegram/callback?status=success&user_id=12345&username=testworker')

    // Verify onboarding steps
    await expect(page.locator('.onboarding-welcome')).toBeVisible()
    await page.click('[data-testid="next-step"]')

    // Step 1: Language selection
    await expect(page.locator('.language-selection')).toBeVisible()
    await page.selectOption('[name="language"]', 'en')
    await page.click('[data-testid="next-step"]')

    // Step 2: Skills assessment
    await expect(page.locator('.skills-assessment')).toBeVisible()
    await page.check('[value="image_classification"]')
    await page.check('[value="text_annotation"]')
    await page.fill('[name="experience"]', 'I have experience in data labeling for ML projects.')
    await page.click('[data-testid="next-step"]')

    // Step 3: Payment setup
    await expect(page.locator('.payment-setup')).toBeVisible()
    await page.fill('[name="walletAddress"]', 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')
    await page.check('[name="terms"]')
    await page.click('[data-testid="complete-onboarding"]')

    // Verify successful onboarding
    await expect(page.locator('.onboarding-success')).toBeVisible()
    await expect(page.locator('.worker-dashboard')).toBeVisible()
  })

  test('should show tutorial for new workers', async ({ page }) => {
    // Simulate returning worker who hasn't completed tutorial
    await page.goto('/worker/dashboard?tutorial=true')

    // Verify tutorial modal appears
    await expect(page.locator('.tutorial-modal')).toBeVisible()

    // Go through tutorial steps
    await page.click('[data-testid="tutorial-next"]')
    await expect(page.locator('.tutorial-step-2')).toBeVisible()

    await page.click('[data-testid="tutorial-next"]')
    await expect(page.locator('.tutorial-step-3')).toBeVisible()

    // Skip tutorial
    await page.click('[data-testid="skip-tutorial"]')
    await expect(page.locator('.tutorial-modal')).not.toBeVisible()
  })

  test('should allow workers to select preferred task types', async ({ page }) => {
    // Start onboarding process
    await page.goto('/worker/preferences')

    // Select preferred task categories
    await page.check('[data-testid="category-images"]')
    await page.check('[data-testid="category-text"]')
    await page.uncheck('[data-testid="category-audio"]')

    // Set hourly rate expectations
    await page.fill('[name="minRate"]', '5')
    await page.fill('[name="maxRate"]', '15')

    // Set availability
    await page.check('[data-testid="available-weekdays"]')
    await page.check('[data-testid="available-weekends"]')

    // Save preferences
    await page.click('[data-testid="save-preferences"]')

    // Verify preferences saved
    await expect(page.locator('.success-toast')).toHaveText('Preferences saved successfully')
  })

  test('should verify worker identity with Telegram', async ({ page }) => {
    // Worker initiates identity verification
    await page.goto('/worker/verify')

    await page.click('[data-testid="start-verification"]')

    // Mock verification code sent to Telegram
    await page.fill('[name="verificationCode"]', '123456')
    await page.click('[data-testid="verify-code"]')

    // Successful verification
    await expect(page.locator('.verification-success')).toBeVisible()
    await expect(page.locator('.verified-badge')).toBeVisible()
  })

  test('should handle verification failures gracefully', async ({ page }) => {
    await page.goto('/worker/verify')

    await page.click('[data-testid="start-verification"]')

    // Enter wrong code
    await page.fill('[name="verificationCode"]', '000000')
    await page.click('[data-testid="verify-code"]')

    // Show error message
    await expect(page.locator('.verification-error')).toHaveText('Invalid verification code. Please try again.')

    // Allow retry after timeout
    await page.waitForTimeout(5000)
    await expect(page.locator('[data-testid="verify-code"]')).toBeEnabled()
  })

  test('should complete worker profile setup', async ({ page }) => {
    // Complete basic profile
    await page.goto('/worker/profile')

    // Add bio
    await page.fill('[name="bio"]', 'Experienced data annotator with attention to detail.')

    // Add portfolio links
    await page.fill('[name="portfolio"]', 'https://example.com/portfolio')

    // Select languages
    await page.selectOption('[name="languages"]', ['en', 'es', 'fr'])

    // Add certifications
    await page.click('[data-testid="add-certification"]')
    await page.fill('[name="certName"]', 'Data Labeling Certificate')
    await page.fill('[name="certIssuer"]', 'ML Training Institute')
    await page.fill('[name="certYear"]', '2023')

    // Save profile
    await page.click('[data-testid="save-profile"]')

    // Verify profile completion
    await expect(page.locator('.profile-completion')).toHaveText('100%')
    await expect(page.locator('.profile-success')).toBeVisible()
  })
})