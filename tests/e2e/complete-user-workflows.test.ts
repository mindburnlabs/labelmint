import { test, expect } from '@playwright/test';

test.describe('Complete User Workflows - E2E Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Setup comprehensive API mocking for all endpoints
    await setupAPIMocks(page);
  });

  test.describe('User Registration and Onboarding Flow', () => {
    test('should complete full user registration journey @smoke @critical', async ({ page }) => {
      // Step 1: Navigate to registration page
      await page.goto('/register');
      await expect(page.locator('h1')).toContainText('Create Account');

      // Step 2: Fill registration form
      await page.fill('[data-testid=email-input]', 'newuser@example.com');
      await page.fill('[data-testid=password-input]', 'SecurePassword123!');
      await page.fill('[data-testid=confirm-password-input]', 'SecurePassword123!');
      await page.fill('[data-testid=full-name-input]', 'John Doe');
      await page.fill('[data-testid=phone-input]', '+1234567890');

      // Step 3: Submit registration
      await page.click('[data-testid=register-button]');
      await expect(page.locator('[data-testid=success-message]')).toBeVisible({ timeout: 10000 });

      // Step 4: Email verification flow
      await page.goto('/verify-email');
      await page.fill('[data-testid=verification-code-input]', '123456');
      await page.click('[data-testid=verify-button]');
      await expect(page.locator('[data-testid=verification-success]')).toBeVisible({ timeout: 10000 });

      // Step 5: TON wallet setup
      await page.goto('/wallet/setup');
      await expect(page.locator('h1')).toContainText('Setup Your TON Wallet');

      await page.click('[data-testid=create-wallet-button]');
      await expect(page.locator('[data-testid=mnemonic-phrase]')).toBeVisible({ timeout: 15000 });

      // Step 6: Confirm mnemonic phrase
      await page.click('[data-testid=mnemonic-confirmed-checkbox]');
      await page.click('[data-testid=confirm-wallet-button]');
      await expect(page.locator('[data-testid=wallet-created-success]')).toBeVisible({ timeout: 10000 });

      // Step 7: Profile completion
      await page.goto('/profile/complete');
      await page.fill('[data-testid=bio-input]', 'Experienced data labeling professional');
      await page.selectOption('[data-testid=expertise-select]', 'image-classification');
      await page.fill('[data-testid=hourly-rate-input]', '15');
      await page.click('[data-testid=complete-profile-button]');

      // Step 8: Verify dashboard access
      await expect(page.locator('[data-testid=user-dashboard]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid=wallet-balance]')).toBeVisible();
      await expect(page.locator('[data-testid=profile-completion]')).toContainText('100%');
    });

    test('should handle registration errors gracefully @error-handling', async ({ page }) => {
      await page.goto('/register');

      // Test duplicate email
      await page.fill('[data-testid=email-input]', 'existing@example.com');
      await page.fill('[data-testid=password-input]', 'Password123!');
      await page.fill('[data-testid=confirm-password-input]', 'Password123!');
      await page.click('[data-testid=register-button]');

      await expect(page.locator('[data-testid=email-error]')).toBeVisible();
      await expect(page.locator('[data-testid=email-error]')).toContainText('already exists');

      // Test weak password
      await page.fill('[data-testid=email-input]', 'newuser@example.com');
      await page.fill('[data-testid=password-input]', '123');
      await page.fill('[data-testid=confirm-password-input]', '123');
      await page.click('[data-testid=register-button]');

      await expect(page.locator('[data-testid=password-error]')).toBeVisible();
      await expect(page.locator('[data-testid=password-error]')).toContainText('at least 8 characters');
    });
  });

  test.describe('Task Discovery and Assignment Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Set authenticated state
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
        window.localStorage.setItem('userProfile', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          role: 'worker',
          profileCompleted: true,
          tonWalletAddress: 'EQTestWalletAddress1234567890'
        }));
      });
    });

    test('should complete task discovery and assignment journey @smoke @critical', async ({ page }) => {
      // Step 1: Browse available projects
      await page.goto('/projects');
      await expect(page.locator('h1')).toContainText('Available Projects');

      // Verify project cards are loaded
      await expect(page.locator('[data-testid=project-card]')).toHaveCount.greaterThan(0);

      // Step 2: Filter projects by criteria
      await page.click('[data-testid=filter-button]');
      await page.selectOption('[data-testid=category-filter]', 'image-classification');
      await page.selectOption('[data-testid=difficulty-filter]', 'beginner');
      await page.fill('[data-testid=min-payment-input]', '10');
      await page.click('[data-testid=apply-filters-button]');

      // Step 3: View project details
      await page.click('[data-testid=project-card]:first-child');
      await expect(page.locator('[data-testid=project-details]')).toBeVisible();
      await expect(page.locator('[data-testid=project-title]')).toBeVisible();
      await expect(page.locator="[data-testid=task-count]").toBeVisible();

      // Step 4: Browse available tasks
      await page.click('[data-testid=view-tasks-button]');
      await expect(page.locator('[data-testid=tasks-list]')).toBeVisible();

      // Step 5: Filter tasks
      await page.selectOption('[data-testid=task-status-filter]', 'available');
      await page.selectOption('[data-testid=task-priority-filter]', 'medium');

      // Step 6: Select and assign a task
      const availableTask = page.locator('[data-testid=task-item]:has-text("Available")').first();
      await expect(availableTask).toBeVisible();
      await availableTask.click();

      // Verify task details
      await expect(page.locator('[data-testid=task-title]')).toBeVisible();
      await expect(page.locator="[data-testid=task-description]").toBeVisible();
      await expect(page.locator="[data-testid=task-instructions]").toBeVisible();
      await expect(page.locator="[data-testid=task-payment]").toBeVisible();

      // Step 7: Assign task to self
      await page.click('[data-testid=assign-task-button]');
      await expect(page.locator('[data-testid=assignment-success]')).toBeVisible({ timeout: 10000 });

      // Step 8: Verify task appears in assigned tasks
      await page.goto('/my-tasks');
      await expect(page.locator('[data-testid=assigned-tasks-list]')).toBeVisible();
      await expect(page.locator('[data-testid=task-item]:has-text("Assigned")')).toHaveCount.greaterThan(0);
    });

    test('should handle task assignment errors @error-handling', async ({ page }) => {
      await page.goto('/projects/test-project/tasks');

      // Try to assign already assigned task
      await page.click('[data-testid=task-item]:has-text("Already Assigned")');
      await expect(page.locator('[data-testid=already-assigned-error]')).toBeVisible();

      // Try to assign task without sufficient balance (mock scenario)
      await page.evaluate(() => {
        window.localStorage.setItem('walletBalance', '0');
      });

      await page.click('[data-testid=task-item]:has-text("Available").first');
      await page.click('[data-testid=assign-task-button]');
      await expect(page.locator('[data-testid=insufficient-balance-error]')).toBeVisible();
    });
  });

  test.describe('Task Completion and Quality Review Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Setup authenticated user with assigned task
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
        window.localStorage.setItem('userProfile', JSON.stringify({
          id: 1,
          email: 'worker@example.com',
          role: 'worker',
          profileCompleted: true,
          tonWalletAddress: 'EQTestWalletAddress1234567890'
        }));
      });
    });

    test('should complete task submission and review process @smoke @critical', async ({ page }) => {
      // Step 1: Navigate to assigned task
      await page.goto('/my-tasks');
      const assignedTask = page.locator('[data-testid=task-item]:has-text("Assigned")').first();
      await assignedTask.click();

      // Step 2: Review task instructions
      await expect(page.locator('[data-testid=task-instructions]')).toBeVisible();
      await expect(page.locator="[data-testid=task-examples]").toBeVisible();
      await expect(page.locator="[data-testid=task-guidelines]").toBeVisible();

      // Step 3: Start task work
      await page.click('[data-testid=start-task-button]');
      await expect(page.locator('[data-testid=task-workspace]')).toBeVisible();
      await expect(page.locator="[data-testid=task-timer]").toBeVisible();

      // Step 4: Complete the labeling task (example: image classification)
      await page.waitForTimeout(1000); // Wait for task to load

      if (await page.locator('[data-testid=image-classification-interface]').isVisible()) {
        await page.click('[data-testid=option-cat]');
        await page.click('[data-testid=option-dog]');
        await page.click('[data-testid=submit-labels-button]');
      } else if (await page.locator('[data-testid=text-labeling-interface]').isVisible()) {
        await page.fill('[data-testid=label-input]', 'positive sentiment');
        await page.fill('[data-testid=confidence-input]', '0.95');
        await page.click('[data-testid=submit-label-button]');
      }

      // Step 5: Review and confirm submission
      await expect(page.locator('[data-testid=submission-preview]')).toBeVisible();
      await expect(page.locator="[data-testid=submission-summary]").toBeVisible();

      await page.click('[data-testid=confirm-submission-button]');
      await expect(page.locator('[data-testid=submission-success]')).toBeVisible({ timeout: 10000 });

      // Step 6: Track submission status
      await page.goto('/submissions');
      await expect(page.locator('[data-testid=submission-item]:has-text("Pending Review")')).toBeVisible();

      // Step 7: Simulate quality review process (mock reviewer)
      await page.evaluate(() => {
        window.localStorage.setItem('userRole', 'reviewer');
      });

      await page.goto('/review/pending');
      const pendingReview = page.locator('[data-testid=review-item]').first();
      await pendingReview.click();

      // Step 8: Perform quality review
      await expect(page.locator('[data-testid=review-interface]')).toBeVisible();
      await page.click('[data-testid=approve-submission-button]');
      await page.fill('[data-testid=review-comments-input]', 'High quality work, accurate labeling');
      await page.click('[data-testid=submit-review-button]');

      await expect(page.locator('[data-testid=review-success]')).toBeVisible({ timeout: 10000 });

      // Step 9: Verify payment processing
      await page.evaluate(() => {
        window.localStorage.setItem('userRole', 'worker');
      });

      await page.goto('/my-earnings');
      await expect(page.locator('[data-testid=payment-received]')).toBeVisible();
      await expect(page.locator="[data-testid=payment-amount]").toBeVisible();
      await expect(page.locator="[data-testid=transaction-history]").toBeVisible();
    });

    test('should handle submission rejection and resubmission @error-handling', async ({ page }) => {
      // Navigate to assigned task
      await page.goto('/my-tasks');
      const assignedTask = page.locator('[data-testid=task-item]:has-text("Assigned")').first();
      await assignedTask.click();

      // Complete task with poor quality (intentional)
      await page.click('[data-testid=start-task-button]');
      await page.waitForTimeout(1000);

      // Submit incomplete work
      await page.click('[data-testid=submit-incomplete-button]');
      await expect(page.locator('[data-testid=incomplete-warning]')).toBeVisible();

      // Force submission
      await page.click('[data-testid=force-submit-button]');

      // Simulate rejection
      await page.evaluate(() => {
        window.localStorage.setItem('userRole', 'reviewer');
      });

      await page.goto('/review/pending');
      const pendingReview = page.locator('[data-testid=review-item]').first();
      await pendingReview.click();

      await page.click('[data-testid=reject-submission-button]');
      await page.fill('[data-testid=rejection-reason-input]', 'Incomplete work, missing labels');
      await page.click('[data-testid=submit-rejection-button]');

      // Verify worker can resubmit
      await page.evaluate(() => {
        window.localStorage.setItem('userRole', 'worker');
      });

      await page.goto('/my-tasks');
      await expect(page.locator('[data-testid=task-item]:has-text("Needs Revision")')).toBeVisible();

      const revisionTask = page.locator('[data-testid=task-item]:has-text("Needs Revision")').first();
      await revisionTask.click();

      await expect(page.locator('[data-testid=rejection-reason]')).toBeVisible();
      await expect(page.locator="[data-testid=resubmit-button]").toBeVisible();
    });
  });

  test.describe('Payment and Wallet Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
        window.localStorage.setItem('userProfile', JSON.stringify({
          id: 1,
          email: 'worker@example.com',
          role: 'worker',
          profileCompleted: true,
          tonWalletAddress: 'EQTestWalletAddress1234567890',
          balance: 50.25
        }));
      });
    });

    test('should complete wallet management and withdrawal process @smoke @critical', async ({ page }) => {
      // Step 1: View wallet dashboard
      await page.goto('/wallet');
      await expect(page.locator('[data-testid=wallet-dashboard]')).toBeVisible();
      await expect(page.locator="[data-testid=wallet-balance]").toContainText('50.25');
      await expect(page.locator="[data-testid=wallet-address]").toBeVisible();
      await expect(page.locator="[data-testid=transaction-history]").toBeVisible();

      // Step 2: View detailed transaction history
      await page.click('[data-testid=view-all-transactions-button]');
      await expect(page.locator('[data-testid=transactions-list]')).toBeVisible();
      await expect(page.locator="[data-testid=transaction-item]").toHaveCount.greaterThan(0);

      // Step 3: Test withdrawal process
      await page.click('[data-testid=withdraw-button]');
      await expect(page.locator('[data-testid=withdrawal-form]')).toBeVisible();

      // Test withdrawal validation
      await page.fill('[data-testid=withdrawal-amount-input]', '100'); // More than balance
      await page.fill('[data-testid=withdrawal-address-input]', 'EQInvalidAddress');
      await page.click('[data-testid=submit-withdrawal-button]');

      await expect(page.locator('[data-testid=insufficient-funds-error]')).toBeVisible();
      await expect(page.locator="[data-testid=invalid-address-error]").toBeVisible();

      // Submit valid withdrawal
      await page.fill('[data-testid=withdrawal-amount-input]', '25'); // Valid amount
      await page.fill('[data-testid=withdrawal-address-input]', 'EQValidRecipientAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      await page.click('[data-testid=submit-withdrawal-button]');

      // Step 4: Two-factor authentication for withdrawal
      await expect(page.locator('[data-testid=2fa-modal]')).toBeVisible();
      await page.fill('[data-testid=2fa-code-input]', '123456');
      await page.click('[data-testid=confirm-2fa-button]');

      await expect(page.locator('[data-testid=withdrawal-success]')).toBeVisible({ timeout: 10000 });

      // Step 5: Verify withdrawal status
      await page.goto('/wallet/transactions');
      await expect(page.locator('[data-testid=transaction-item]:has-text("Pending")')).toBeVisible();

      // Step 6: Test wallet backup
      await page.click('[data-testid=backup-wallet-button]');
      await expect(page.locator('[data-testid=backup-instructions]')).toBeVisible();
      await page.click('[data-testid=show-mnemonic-button]');
      await expect(page.locator('[data-testid=mnemonic-phrase]')).toBeVisible();

      await page.click('[data-testid=mnemonic-confirmed-checkbox]');
      await page.click('[data-testid=confirm-backup-button]');
      await expect(page.locator('[data-testid=backup-success]')).toBeVisible();
    });

    test('should handle deposit and funding process @critical', async ({ page }) => {
      // Step 1: Navigate to deposit page
      await page.goto('/wallet/deposit');
      await expect(page.locator('[data-testid=deposit-options]')).toBeVisible();

      // Step 2: Generate deposit address
      await page.click('[data-testid=generate-deposit-address-button]');
      await expect(page.locator('[data-testid=deposit-address]')).toBeVisible();
      await expect(page.locator="[data-testid=qr-code]").toBeVisible();

      // Step 3: Copy deposit address
      await page.click('[data-testid=copy-address-button]');
      await expect(page.locator('[data-testid=copied-success]')).toBeVisible();

      // Step 4: View deposit instructions
      await expect(page.locator('[data-testid=deposit-instructions]')).toBeVisible();
      await expect(page.locator="[data-testid=minimum-deposit]").toBeVisible();
      await expect(page.locator="[data-testid=expected-confirmation-time]").toBeVisible();

      // Step 5: Test different deposit methods
      await page.click('[data-testid=ton-deposit-tab]');
      await expect(page.locator('[data-testid=ton-deposit-address]')).toBeVisible();

      await page.click('[data-testid=usdt-deposit-tab]');
      await expect(page.locator('[data-testid=usdt-deposit-address]')).toBeVisible();

      // Step 6: Simulate deposit detection
      await page.evaluate(() => {
        window.localStorage.setItem('pendingDeposit', 'true');
      });

      // Check deposit status
      await page.goto('/wallet/deposits');
      await expect(page.locator('[data-testid=pending-deposit]')).toBeVisible();
    });
  });

  test.describe('Admin Dashboard and Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_admin_jwt_token_for_e2e');
        window.localStorage.setItem('userProfile', JSON.stringify({
          id: 1,
          email: 'admin@example.com',
          role: 'admin',
          profileCompleted: true,
          permissions: ['user_management', 'project_management', 'analytics']
        }));
      });
    });

    test('should complete admin dashboard operations @smoke @critical', async ({ page }) => {
      // Step 1: Access admin dashboard
      await page.goto('/admin');
      await expect(page.locator('[data-testid=admin-dashboard]')).toBeVisible();
      await expect(page.locator="[data-testid=system-overview]").toBeVisible();

      // Step 2: View user management
      await page.click('[data-testid=user-management-tab]');
      await expect(page.locator('[data-testid=users-list]')).toBeVisible();
      await expect(page.locator="[data-testid=search-users-input]").toBeVisible();

      // Search for users
      await page.fill('[data-testid=search-users-input]', 'test@example.com');
      await page.click('[data-testid=search-button]');
      await expect(page.locator('[data-testid=user-item]')).toHaveCount.greaterThan(0);

      // Step 3: Manage user permissions
      const userItem = page.locator('[data-testid=user-item]').first();
      await userItem.click();
      await expect(page.locator('[data-testid=user-details]')).toBeVisible();

      await page.click('[data-testid=edit-permissions-button]');
      await page.check('[data-testid=advanced-user-checkbox]');
      await page.click('[data-testid=save-permissions-button]');
      await expect(page.locator('[data-testid=permissions-saved]')).toBeVisible();

      // Step 4: Project management
      await page.click('[data-testid=project-management-tab]');
      await expect(page.locator('[data-testid=projects-list]')).toBeVisible();

      await page.click('[data-testid=create-project-button]');
      await expect(page.locator('[data-testid=project-form]')).toBeVisible();

      await page.fill('[data-testid=project-name-input]', 'Test Project');
      await page.fill('[data-testid=project-description-input]', 'Test project description');
      await page.selectOption('[data-testid=project-category-select]', 'image-classification');
      await page.fill('[data-testid=budget-input]', '1000');
      await page.click('[data-testid=create-project-button]');

      await expect(page.locator('[data-testid=project-created-success]')).toBeVisible();

      // Step 5: Analytics and reporting
      await page.click('[data-testid=analytics-tab]');
      await expect(page.locator('[data-testid=analytics-dashboard]')).toBeVisible();
      await expect(page.locator="[data-testid=revenue-chart]").toBeVisible();
      await expect(page.locator="[data-testid=user-growth-chart]").toBeVisible();

      // Generate reports
      await page.click('[data-testid=generate-report-button]');
      await page.selectOption('[data-testid=report-type-select]', 'monthly');
      await page.click('[data-testid=download-report-button]');

      // Step 6: System monitoring
      await page.click('[data-testid=system-monitoring-tab]');
      await expect(page.locator('[data-testid=system-health]')).toBeVisible();
      await expect(page.locator="[data-testid=performance-metrics]").toBeVisible();

      // Verify system alerts
      if (await page.locator('[data-testid=system-alerts]').isVisible()) {
        await expect(page.locator('[data-testid=alert-item]')).toHaveCount.greaterThan(0);
      }
    });
  });

  test.describe('Cross-Platform Compatibility', () => {
    test('should work on mobile devices @mobile @responsive', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup authenticated state
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
      });

      // Test mobile navigation
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid=mobile-nav]')).toBeVisible();
      await expect(page.locator="[data-testid=mobile-menu-toggle]").toBeVisible();

      // Test mobile menu
      await page.click('[data-testid=mobile-menu-toggle]');
      await expect(page.locator('[data-testid=mobile-menu]')).toBeVisible();

      // Test mobile task interface
      await page.click('[data-testid=mobile-menu-item]:has-text("Tasks")');
      await expect(page.locator('[data-testid=mobile-tasks-list]')).toBeVisible();

      // Test mobile task completion
      const mobileTask = page.locator('[data-testid=mobile-task-item]').first();
      await mobileTask.click();
      await expect(page.locator('[data-testid=mobile-task-workspace]')).toBeVisible();

      // Test touch interactions
      await page.tap('[data-testid=submit-task-button]');
      await expect(page.locator('[data-testid=submission-success]')).toBeVisible();
    });

    test('should work on tablet devices @tablet @responsive', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Setup authenticated state
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
      });

      // Test tablet layout
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid=tablet-layout]')).toBeVisible();
      await expect(page.locator="[data-testid=sidebar-nav]").toBeVisible();

      // Test tablet project interface
      await page.goto('/projects');
      await expect(page.locator('[data-testid=tablet-projects-grid]')).toBeVisible();

      // Test tablet task workspace
      const projectCard = page.locator('[data-testid=project-card]').first();
      await projectCard.click();
      await expect(page.locator('[data-testid=tablet-task-interface]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network connectivity issues @error-handling @network', async ({ page }) => {
      // Setup authenticated state
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
      });

      // Simulate network offline
      await page.context().setOffline(true);

      await page.goto('/dashboard');
      await expect(page.locator('[data-testid=offline-banner]')).toBeVisible();
      await expect(page.locator="[data-testid=retry-connection-button]").toBeVisible();

      // Test retry functionality
      await page.context().setOffline(false);
      await page.click('[data-testid=retry-connection-button]');
      await expect(page.locator('[data-testid=offline-banner]')).not.toBeVisible({ timeout: 10000 });
    });

    test('should handle session expiration @error-handling @auth', async ({ page }) => {
      // Setup expired token
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'expired_jwt_token');
      });

      await page.goto('/dashboard');
      await expect(page.locator('[data-testid=session-expired-modal]')).toBeVisible();

      // Test re-authentication flow
      await page.click('[data-testid=relogin-button]');
      await expect(page.locator('[data-testid=login-form]')).toBeVisible();

      await page.fill('[data-testid=email-input]', 'test@example.com');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await expect(page.locator('[data-testid=user-dashboard]')).toBeVisible({ timeout: 10000 });
    });

    test('should handle concurrent operations @stress-testing', async ({ page }) => {
      // Setup authenticated state
      await page.evaluate(() => {
        window.localStorage.setItem('token', 'mock_jwt_token_for_e2e');
      });

      // Test multiple rapid requests
      await page.goto('/projects');

      // Rapidly click multiple project cards
      const projectCards = page.locator('[data-testid=project-card]');
      const count = await projectCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        await projectCards.nth(i).click();
      }

      // Verify application handles concurrent operations gracefully
      await expect(page.locator('[data-testid=loading-spinner]')).toBeVisible();
      await expect(page.locator('[data-testid=loading-spinner]')).not.toBeVisible({ timeout: 15000 });

      // Verify no data corruption
      await expect(page.locator('[data-testid=project-details]')).toBeVisible();
      await expect(page.locator="[data-testid=project-title]").toBeVisible();
    });
  });
});

// Helper function to setup comprehensive API mocks
async function setupAPIMocks(page: any) {
  // Authentication endpoints
  await page.route('/api/auth/login', async (route) => {
    if (route.request().postData()?.includes('password123')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            email: 'test@example.com',
            role: 'worker',
            balance: 1000,
            profileCompleted: true
          },
          token: 'mock_jwt_token_for_e2e'
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        })
      });
    }
  });

  // User profile endpoint
  await page.route('/api/me', async (route) => {
    const authHeader = route.request().headers().authorization;
    if (authHeader === 'Bearer mock_jwt_token_for_e2e' || authHeader === 'Bearer mock_admin_jwt_token_for_e2e') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email: 'test@example.com',
          role: authHeader.includes('admin') ? 'admin' : 'worker',
          balance: 1000,
          profileCompleted: true,
          tonWalletAddress: 'EQTestWalletAddress1234567890'
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Unauthorized'
        })
      });
    }
  });

  // Projects endpoint
  await page.route('/api/projects*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'proj_1',
          name: 'Test Project',
          description: 'Project for E2E testing',
          category: 'image-classification',
          status: 'active',
          totalTasks: 10,
          completedTasks: 2,
          paymentPerTask: 5,
          clientId: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'proj_2',
          name: 'Advanced Project',
          description: 'Advanced project for testing',
          category: 'text-labeling',
          status: 'active',
          totalTasks: 20,
          completedTasks: 5,
          paymentPerTask: 10,
          clientId: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
    });
  });

  // Tasks endpoint
  await page.route('/api/tasks*', async (route) => {
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
          payment: 5,
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
          payment: 10,
          assignedTo: 1,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ])
    });
  });

  // Wallet endpoint
  await page.route('/api/wallet*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: 'EQTestWalletAddress1234567890',
        balance: 50.25,
        transactions: [
          {
            hash: '0x1234567890abcdef',
            type: 'deposit',
            amount: 25.50,
            status: 'confirmed',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            hash: '0xabcdef1234567890',
            type: 'withdrawal',
            amount: 10.00,
            status: 'pending',
            timestamp: new Date().toISOString()
          }
        ]
      })
    });
  });
}