import { test, expect } from '@playwright/test'

test.describe('User Journey E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for testing
    await page.route('/api/auth/login', async (route, request) => {
      if (request.postData()?.password === 'password123') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 1,
              email: 'test@example.com',
              role: 'worker',
              balance: 1000
            },
            token: 'mock_jwt_token_for_e2e'
          })
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          })
        }
      }
    })

    await page.route('/api/me', async (route, request) => {
      if (request.headers().authorization === 'Bearer mock_jwt_token_for_e2e') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            email: 'test@example.com',
            role: 'worker',
            balance: 1000
          })
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized'
          })
        }
      }
    })

    await page.route('/api/projects', async (route) => {
      if (request.headers().authorization === 'Bearer mock_jwt_token_for_e2e') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'proj_1',
              name: 'Test Project',
              description: 'Project for E2E testing',
              clientId: 1,
              status: 'active',
              totalTasks: 10,
              completedTasks: 2,
              paymentPerTask: 5,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ])
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized'
          })
        }
      }
    })

    await page.route('/api/tasks', async (route) => {
      if (request.headers().authorization === 'Bearer mock_jwt_token_for_e2e') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'task_1',
              projectId: 'proj_1',
              title: 'Available Task',
              description: 'Task available for work',
              type: 'image_classification',
              status: 'pending',
              priority: 'medium',
              createdAt: new Date().toISOString(),
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 'task_2',
              projectId: 'proj_1',
              title: 'Assigned Task',
              description: 'Task assigned to user',
              type: 'text_labeling',
              status: 'assigned',
              priority: 'high',
              assignedTo: 1,
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            }
          ])
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized'
          })
        }
      }
    })
  })

  test('user login flow @smoke', async ({ page }) => {
    await page.goto('/login')

    // Fill login form
    await page.fill('[data-testid=email-input]', 'test@example.com')
    await page.fill('[data-testid=password-input]', 'password123')
    await page.click('[data-testid=login-button]')

    // Wait for successful login
    await expect(page.locator('[data-testid=user-dashboard]')).toBeVisible({ timeout: 10000 })
  })

  test('user views dashboard and projects @smoke', async ({ page }) => {
    // Set authenticated state (in real app, this would be via cookies)
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/dashboard')

    // Verify dashboard elements
    await expect(page.locator('h1')).toContainText('Dashboard')
    await expect(page.locator('[data-testid=projects-list]')).toBeVisible()

    // Navigate to projects
    await page.click('[data-testid=projects-tab]')

    // Verify projects are loaded
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(1)
    await expect(page.locator('[data-testid=project-card]').first()).toContainText('Test Project')
  })

  test('user views and manages tasks @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/projects/proj_1/tasks')

    // Verify tasks are loaded
    await expect(page.locator('[data-testid=tasks-list]')).toBeVisible()
    await expect(page.locator('[data-testid=task-item]')).toHaveCount(2)

    // Click on available task
    await page.click('[data-testid=task-item]:has-text("Available Task")')
    await expect(page.locator('[data-testid=task-title]')).toContainText('Available Task')
  })

  test('user can complete a task @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/projects/proj_1/tasks')

    // Click on available task to assign it
    await page.click('[data-testid=task-item]:has-text("Available Task")')
    await expect(page.locator('[data-testid=task-status]')).toContainText('assigned')

    // Complete the task
    await page.click('[data-testid=task-item]:has-text("Available Task")')
    await expect(page.locator('[data-testid=complete-task-form]')).toBeVisible()

    // Fill completion form
    await page.fill('[data-testid=label-input]', 'cat')
    await page.fill('[data-testid=confidence-input]', '0.95')
    await page.click('[data-testid=submit-task-button]')

    // Verify task completion
    await expect(page.locator('[data-testid=success-message]')).toBeVisible({ timeout: 5000 })
  })

  test('user can view analytics @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/analytics')

    // Verify analytics elements
    await expect(page.locator('h1')).toContainText('Analytics')
    await expect(page.locator('[data-testid=stats-cards]')).toHaveCount(3)
    await expect(page.locator('[data-testid=chart-container]')).toBeVisible()
  })

  test('user can access settings @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/settings')

    // Verify settings elements
    await expect(page.locator('h1')).toContainText('Settings')
    await expect(page.locator('[data-testid=settings-form]')).toBeVisible()
    await expect(page.locator('[data-testid=save-settings-button]')).toBeVisible()
  })

  test('user can logout @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    await page.goto('/dashboard')

    // Click logout
    await page.click('[data-testid=logout-button]')

    // Verify logout
    await expect(page.locator('[data-testid=login-form]')).toBeVisible({ timeout: 5000 })
    expect(page.locator('[data-testid=user-dashboard]')).not.toBeVisible()
  })

  test('unauthorized access is blocked @smoke', async ({ page }) => {
    // Try to access protected routes without token
    await page.goto('/projects')
    await expect(page.locator('[data-testid=login-prompt]')).toBeVisible({ timeout: 3000 })

    await page.goto('/tasks')
    await expect(page.locator('[data-testid=login-prompt]')).toBeVisible({ timeout: 3000 })

    await page.goto('/analytics')
    await expect(page.locator('[data-testid=login-prompt]')).toBeVisible({ timeout: 3000 })
  })

  test('responsive design works on mobile @smoke', async ({ page }) => {
    // Set authenticated state
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'mock_jwt_token_for_e2e')
    })

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // Verify mobile layout
    await expect(page.locator('[data-testid=mobile-nav]')).toBeVisible()
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(1)

    // Test mobile menu toggle
    await page.click('[data-testid=mobile-menu-toggle]')
    await expect(page.locator('[data-testid=mobile-menu]').toBeVisible()

    await page.click('[data-testid=mobile-menu-close]')
    await expect(page.locator('[data-testid=mobile-menu]').not.toBeVisible()
  })
})