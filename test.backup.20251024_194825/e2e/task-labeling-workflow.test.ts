import { test, expect } from '@playwright/test'

test.describe('Task Labeling Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated worker
    await page.goto('/worker/login')
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-worker-token')
      localStorage.setItem('userRole', 'worker')
    })
  })

  test('should display available tasks to worker', async ({ page }) => {
    await page.goto('/worker/dashboard')

    // Check task list is loaded
    await expect(page.locator('.task-list')).toBeVisible()
    await expect(page.locator('.task-card')).toHaveCount.greaterThan(0)

    // Verify task information is displayed
    const firstTask = page.locator('.task-card').first()
    await expect(firstTask.locator('.task-type')).toBeVisible()
    await expect(firstTask.locator('.task-reward')).toBeVisible()
    await expect(firstTask.locator('.task-time')).toBeVisible()
  })

  test('should filter tasks by category and type', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Filter by category
    await page.selectOption('[name="category"]', 'images')
    await page.click('[data-testid="apply-filters"]')

    // Verify filtered results
    await expect(page.locator('.task-card')).toHaveCount.greaterThan(0)
    const taskTypes = await page.locator('.task-type').allTextContents()
    expect(taskTypes.every(type => type.includes('Image'))).toBe(true)

    // Filter by difficulty
    await page.selectOption('[name="difficulty"]', 'easy')
    await page.click('[data-testid="apply-filters"]')

    // Clear filters
    await page.click('[data-testid="clear-filters"]')
    await expect(page.locator('.filter-active')).not.toBeVisible()
  })

  test('should start and complete image classification task', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Find and start an image classification task
    const imageTask = page.locator('.task-card').filter({ hasText: 'Image Classification' }).first()
    await imageTask.click()

    // Task loading screen
    await expect(page.locator('.task-loading')).toBeVisible()
    await expect(page.locator('.task-workspace')).toBeVisible({ timeout: 5000 })

    // Verify task interface
    await expect(page.locator('.task-image')).toBeVisible()
    await expect(page.locator('.label-options')).toBeVisible()
    await expect(page.locator('.task-instructions')).toBeVisible()

    // Select a label
    await page.click('[data-label="cat"]')

    // Submit label
    await page.click('[data-testid="submit-label"]')

    // Confirmation dialog
    await expect(page.locator('.submit-confirmation')).toBeVisible()
    await page.click('[data-testid="confirm-submit"]')

    // Success feedback
    await expect(page.locator('.task-success')).toBeVisible()
    await expect(page.locator('.reward-earned')).toHaveText('$0.02')

    // Return to task list
    await page.click('[data-testid="next-task"]')
    await expect(page).toHaveURL(/\/worker\/tasks/)
  })

  test('should handle bounding box annotation task', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Find bounding box task
    const bboxTask = page.locator('.task-card').filter({ hasText: 'Bounding Box' }).first()
    if (await bboxTask.count() === 0) {
      test.skip('No bounding box tasks available')
    }

    await bboxTask.click()

    // Wait for annotation tools
    await expect(page.locator('.annotation-canvas')).toBeVisible()
    await expect(page.locator('.annotation-tools')).toBeVisible()

    // Draw bounding box
    const canvas = page.locator('.annotation-canvas')
    await canvas.hover()
    await page.mouse.down()
    await page.mouse.move(100, 100)
    await page.mouse.up()

    // Verify box is created
    await expect(page.locator('.bounding-box')).toBeVisible()

    // Label the box
    await page.selectOption('.box-label', 'person')
    await page.click('[data-testid="save-annotation"]')

    // Submit task
    await page.click('[data-testid="submit-task"]')
    await page.click('[data-testid="confirm-submit"]')

    // Verify completion
    await expect(page.locator('.task-complete')).toBeVisible()
  })

  test('should handle keyboard shortcuts for efficient labeling', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Start a multi-label task
    const multiLabelTask = page.locator('.task-card').filter({ hasText: 'Multi-label' }).first()
    if (await multiLabelTask.count() === 0) {
      test.skip('No multi-label tasks available')
    }

    await multiLabelTask.click()

    // Use keyboard shortcuts
    await page.keyboard.press('1') // Select first option
    await page.keyboard.press('Enter') // Submit
    await page.keyboard.press('Space') // Skip to next

    // Verify shortcuts work
    await expect(page.locator('.keyboard-shortcuts-active')).toBeVisible()
  })

  test('should provide help and instructions', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Start any task
    await page.locator('.task-card').first().click()

    // Open help modal
    await page.click('[data-testid="help-button"]')

    // Verify help content
    await expect(page.locator('.help-modal')).toBeVisible()
    await expect(page.locator('.task-instructions')).toBeVisible()
    await expect(page.locator('.labeling-guidelines')).toBeVisible()

    // Close help
    await page.keyboard.press('Escape')
    await expect(page.locator('.help-modal')).not.toBeVisible()
  })

  test('should handle session timeout gracefully', async ({ page }) => {
    // Mock session timeout
    await page.goto('/worker/tasks')
    await page.evaluate(() => {
      // Simulate session expiration
      localStorage.removeItem('authToken')
    })

    // Try to start a task
    await page.locator('.task-card').first().click()

    // Should redirect to login
    await expect(page).toHaveURL(/\/worker\/login/)
    await expect(page.locator('.session-expired')).toBeVisible()
  })

  test('should track work statistics', async ({ page }) => {
    await page.goto('/worker/dashboard')

    // Check stats display
    await expect(page.locator('.stats-tasks-completed')).toBeVisible()
    await expect(page.locator('.stats-earnings')).toBeVisible()
    await expect(page.locator('.stats-accuracy')).toBeVisible()
    await expect(page.locator('.stats-time-worked')).toBeVisible()

    // Complete a task
    await page.goto('/worker/tasks')
    await page.locator('.task-card').first().click()
    await page.click('[data-label="cat"]')
    await page.click('[data-testid="submit-label"]')
    await page.click('[data-testid="confirm-submit"]')

    // Return to dashboard
    await page.goto('/worker/dashboard')

    // Verify stats updated
    const completedTasks = await page.locator('.stats-tasks-completed .value').textContent()
    const earnings = await page.locator('.stats-earnings .value').textContent()
    expect(parseInt(completedTasks || '0')).toBeGreaterThanOrEqual(1)
    expect(parseFloat(earnings || '0')).toBeGreaterThanOrEqual(0.02)
  })

  test('should allow worker to skip difficult tasks', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Start a task
    await page.locator('.task-card').first().click()

    // Use skip option
    await page.click('[data-testid="skip-task"]')

    // Provide skip reason
    await page.selectOption('[name="skipReason"]', 'unclear')
    await page.fill('[name="skipComment"]', 'Image quality is too poor')
    await page.click('[data-testid="confirm-skip"]')

    // Verify task skipped and moved to next
    await expect(page.locator('.task-skipped')).toBeVisible()
    await expect(page).toHaveURL(/\/worker\/tasks/)
  })

  test('should show quality feedback for honeypot tasks', async ({ page }) => {
    await page.goto('/worker/tasks')

    // Start a task
    await page.locator('.task-card').first().click()

    // Submit correct answer for honeypot
    await page.click('[data-label="correct_answer"]')
    await page.click('[data-testid="submit-label"]')
    await page.click('[data-testid="confirm-submit"]')

    // Check for quality feedback (if it was a honeypot)
    const qualityFeedback = page.locator('.quality-feedback')
    if (await qualityFeedback.isVisible()) {
      await expect(qualityFeedback).toHaveText(/Good job|Well done/)
      await expect(page.locator('.accuracy-score')).toBeVisible()
    }
  })
})