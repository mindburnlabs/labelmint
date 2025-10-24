import { test, expect } from '@playwright/test'

test.describe('Task Labeling Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Telegram Web App SDK
    await page.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          sendData: (data: any) => console.log('Send to Telegram:', data),
          close: () => {},
          theme: { getScheme: () => 'light' },
          viewport: { getStableHeight: () => 800 },
          backButton: { isVisible: false, hide: () => {}, show: () => {} },
          mainButton: {
            text: 'Submit',
            onClick: () => {},
            show: () => {},
            hide: () => {},
            enable: () => {},
            disable: () => {}
          },
          initData: {
            user: {
              id: 12345,
              username: 'testuser',
              first_name: 'Test',
              last_name: 'User'
            }
          }
        }
      }
    })
  })

  test('should load the labeling interface', async ({ page }) => {
    await page.goto('/mini-app')

    // Check if the main container loads
    await expect(page.locator('[data-testid="labeling-container"]')).toBeVisible()

    // Check for task information
    await expect(page.locator('[data-testid="task-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-type"]')).toContainText('Image Classification')
  })

  test('should complete image classification task', async ({ page }) => {
    await page.goto('/mini-app')

    // Start a task
    await page.click('[data-testid="start-task-btn"]')
    await expect(page.locator('[data-testid="task-image"]')).toBeVisible()

    // Select a label
    await page.click('[data-testid="label-cat"]')
    await expect(page.locator('[data-testid="label-cat"]')).toHaveClass(/selected/)

    // Add confidence score
    await page.fill('[data-testid="confidence-input"]', '95')

    // Add comment
    await page.fill('[data-testid="comment-input"]', 'Clearly a cat in the image')

    // Submit the task
    await page.click('[data-testid="submit-btn"]')

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Task submitted successfully')

    // Check earnings update
    await expect(page.locator('[data-testid="earnings"]')).toContainText('$0.10')
  })

  test('should handle text labeling task', async ({ page }) => {
    await page.goto('/mini-app')

    // Mock API response for text task
    await page.route('/api/tasks/current', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2,
          type: 'TEXT_LABELING',
          data: {
            text: 'The weather today is beautiful and sunny.',
            labels: ['positive', 'negative', 'neutral']
          },
          reward: 0.15
        })
      })
    })

    await page.click('[data-testid="start-task-btn"]')

    // Verify text is displayed
    await expect(page.locator('[data-testid="task-text"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-text"]')).toContainText('The weather today is beautiful')

    // Select sentiment
    await page.click('[data-testid="label-positive"]')

    // Submit
    await page.click('[data-testid="submit-btn"]')
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should show task history', async ({ page }) => {
    await page.goto('/mini-app')

    // Navigate to history
    await page.click('[data-testid="history-tab"]')

    // Check if history loads
    await expect(page.locator('[data-testid="task-history"]')).toBeVisible()

    // Verify task items
    const taskItems = page.locator('[data-testid="task-item"]')
    await expect(taskItems.first()).toBeVisible()

    // Check task details
    await expect(taskItems.first().locator('[data-testid="task-type"]')).toBeVisible()
    await expect(taskItems.first().locator('[data-testid="task-reward"]')).toBeVisible()
    await expect(taskItems.first().locator('[data-testid="task-status"]')).toBeVisible()
  })

  test('should handle error states gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/tasks/current', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No tasks available' })
      })
    })

    await page.goto('/mini-app')
    await page.click('[data-testid="start-task-btn"]')

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('No tasks available')

    // Verify retry button
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible()
  })

  test('should respect time limits', async ({ page }) => {
    await page.goto('/mini-app')

    // Mock task with time limit
    await page.route('/api/tasks/current', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 3,
          type: 'IMAGE_CLASSIFICATION',
          data: {
            image_url: 'https://example.com/test.jpg',
            labels: ['cat', 'dog', 'bird'],
            timeLimit: 30 // 30 seconds
          },
          reward: 0.20
        })
      })
    })

    await page.click('[data-testid="start-task-btn"]')

    // Check timer is visible
    await expect(page.locator('[data-testid="timer"]')).toBeVisible()

    // Let timer run
    await page.waitForTimeout(31000) // Wait for time to expire

    // Verify timeout message
    await expect(page.locator('[data-testid="timeout-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="submit-btn"]')).toBeDisabled()
  })

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/mini-app')
    await page.click('[data-testid="start-task-btn"]')

    // Use keyboard to select labels (1, 2, 3 keys)
    await page.keyboard.press('1')
    await expect(page.locator('[data-testid="label-cat"]')).toHaveClass(/selected/)

    // Press Enter to submit
    await page.keyboard.press('Enter')

    // Check for confirmation dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()

    // Press Enter again to confirm
    await page.keyboard.press('Enter')

    // Verify submission
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should show profile information', async ({ page }) => {
    await page.goto('/mini-app')

    // Navigate to profile
    await page.click('[data-testid="profile-tab"]')

    // Check profile sections
    await expect(page.locator('[data-testid="user-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="stats-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="wallet-info"]')).toBeVisible()

    // Verify stats
    await expect(page.locator('[data-testid="tasks-completed"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-earned"]')).toBeVisible()
    await expect(page.locator('[data-testid="accuracy-rate"]')).toBeVisible()
  })

  test('should handle withdrawal process', async ({ page }) => {
    await page.goto('/mini-app')

    // Navigate to wallet
    await page.click('[data-testid="wallet-tab"]')

    // Check balance
    await expect(page.locator('[data-testid="balance"]')).toBeVisible()

    // Click withdraw
    await page.click('[data-testid="withdraw-btn"]')

    // Fill withdrawal form
    await page.fill('[data-testid="withdraw-amount"]', '10')
    await page.fill('[data-testid="wallet-address"]', 'EQD_test_address')

    // Submit withdrawal
    await page.click('[data-testid="confirm-withdraw"]')

    // Verify success
    await expect(page.locator('[data-testid="withdrawal-success"]')).toBeVisible()
  })
})