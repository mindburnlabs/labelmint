import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { DashboardPage } from '../pages/dashboard-page';
import { ProjectPage } from '../pages/project-page';
import { TaskManagementPage } from '../pages/task-management-page';

test.describe('Client Task Creation Journey', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let projectPage: ProjectPage;
  let taskPage: TaskManagementPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    projectPage = new ProjectPage(page);
    taskPage = new TaskManagementPage(page);

    // Navigate to the application
    await page.goto('/');

    // Mock Telegram WebApp init
    await page.evaluate(() => {
      window.Telegram = {
        WebApp: {
          initData: 'test_init_data',
          initDataUnsafe: {
            user: {
              id: 123456789,
              first_name: 'Test',
              last_name: 'Client',
              username: 'testclient',
              language_code: 'en'
            }
          },
          ready: () => {},
          expand: () => {},
          close: () => {},
          sendData: (data: any) => console.log('sendData', data),
          enableClosingConfirmation: () => {},
          disableClosingConfirmation: () => {}
        }
      };
    });
  });

  test('should create project and upload tasks successfully', async ({ page }) => {
    // Step 1: Login as client
    await loginPage.loginWithTelegram();
    await expect(page).toHaveURL('/dashboard');

    // Step 2: Navigate to projects
    await dashboardPage.navigateToProjects();
    await expect(page).toHaveURL('/projects');

    // Step 3: Create new project
    await page.click('[data-testid="create-project-button"]');

    // Fill project details
    await page.fill('[data-testid="project-name"]', 'Test Image Classification');
    await page.fill('[data-testid="project-description"]', 'Classify images into categories');
    await page.fill('[data-testid="project-instructions"]', 'Please carefully label each image with the appropriate category');

    // Set project parameters
    await page.selectOption('[data-testid="project-category"]', 'image_classification');
    await page.fill('[data-testid="project-budget"]', '1000');
    await page.fill('[data-testid="total-tasks"]', '100');
    await page.fill('[data-testid="tasks-per-worker"]', '10');
    await page.fill('[data-testid="consensus-required"]', '3');
    await page.fill('[data-testid="payment-per-task"]', '10');

    // Set deadline
    await page.fill('[data-testid="project-deadline"]', '2024-12-31');
    await page.click('[data-testid="project-difficulty"] button');
    await page.click('[data-value="EASY"]');

    // Add tags
    await page.fill('[data-testid="project-tags"]', 'image, classification, test');

    // Create project
    await page.click('[data-testid="create-project-submit"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-id"]')).toContainText('Project #');

    // Step 4: Upload task data
    const projectId = await page.getAttribute('[data-testid="project-id"]', 'data-project-id');

    // Download sample CSV template
    await page.click('[data-testid="download-template"]');

    // Verify download initiated
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="upload-csv"]')
    ]);

    // Verify CSV structure
    const fileName = download.suggestedFilename();
    expect(fileName).toBe('task_template.csv');

    // Step 5: Upload sample images
    const fileInput = page.locator('[data-testid="image-upload"]');
    const testImagePath = 'test/fixtures/sample-images/test-image-1.jpg';

    // Upload multiple images
    await fileInput.setInputFiles([
      testImagePath,
      'test/fixtures/sample-images/test-image-2.jpg',
      'test/fixtures/sample-images/test-image-3.jpg'
    ]);

    // Wait for upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({ timeout: 10000 });

    // Step 6: Configure task distribution
    await page.click('[data-testid="configure-distribution"]');
    await page.selectOption('[data-testid="distribution-strategy"]', 'random');
    await page.fill('[data-testid="tasks-per-batch"]', '10');
    await page.check('[data-testid="enable-honeypot"]');
    await page.fill('[data-testid="honeypot-percentage"]', '5');

    await page.click('[data-testid="save-distribution"]');

    // Step 7: Preview and publish
    await page.click('[data-testid="preview-project"]');

    // Verify preview data
    await expect(page.locator('[data-testid="preview-total-tasks"]')).toContainText('3');
    await expect(page.locator('[data-testid="preview-total-cost"]')).toContainText('30');
    await expect(page.locator('[data-testid="preview-estimated-completion"]')).toBeVisible();

    // Publish project
    await page.click('[data-testid="publish-project"]');
    await expect(page.locator('[data-testid="publish-modal"]')).toBeVisible();

    // Confirm publishing
    await page.click('[data-testid="confirm-publish"]');

    // Step 8: Monitor project status
    await expect(page.locator('[data-testid="project-status"]')).toContainText('ACTIVE');
    await expect(page.locator('[data-testid="tasks-completed"]')).toContainText('0 / 3');

    // Navigate to project dashboard
    await page.click('[data-testid="view-project-dashboard"]');

    // Verify dashboard elements
    await expect(page.locator('[data-testid="progress-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="worker-activity"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-metrics"]')).toBeVisible();
  });

  test('should handle project creation with validation errors', async ({ page }) => {
    await loginPage.loginWithTelegram();
    await dashboardPage.navigateToProjects();
    await page.click('[data-testid="create-project-button"]');

    // Try to submit without required fields
    await page.click('[data-testid="create-project-submit"]');

    // Check validation errors
    await expect(page.locator('[data-testid="error-name-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-description-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-budget-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-tasks-required"]')).toBeVisible();

    // Fill with invalid data
    await page.fill('[data-testid="project-name"]', 'A'); // Too short
    await page.fill('[data-testid="project-budget"]', '-100'); // Negative
    await page.fill('[data-testid="total-tasks"]', '5'); // Below minimum

    await page.click('[data-testid="create-project-submit"]');

    // Check specific validation errors
    await expect(page.locator('[data-testid="error-name-too-short"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-budget-invalid"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-tasks-too-few"]')).toBeVisible();
  });

  test('should save project as draft', async ({ page }) => {
    await loginPage.loginWithTelegram();
    await dashboardPage.navigateToProjects();
    await page.click('[data-testid="create-project-button"]');

    // Fill some project details
    await page.fill('[data-testid="project-name"]', 'Draft Project');
    await page.fill('[data-testid="project-description"]', 'This is a draft project');

    // Save as draft
    await page.click('[data-testid="save-draft"]');

    // Verify draft saved
    await expect(page.locator('[data-testid="draft-saved"]')).toBeVisible();

    // Check draft appears in projects list
    await page.goto('/projects');
    await expect(page.locator('[data-status="DRAFT"]')).toContainText('Draft Project');
  });

  test('should clone existing project', async ({ page }) => {
    // First create a project to clone
    await loginPage.loginWithTelegram();
    await dashboardPage.navigateToProjects();
    await page.click('[data-testid="create-project-button"]');

    await page.fill('[data-testid="project-name"]', 'Original Project');
    await page.fill('[data-testid="project-description"]', 'Original description');
    await page.fill('[data-testid="project-budget"]', '500');
    await page.fill('[data-testid="total-tasks"]', '50');
    await page.fill('[data-testid="payment-per-task"]', '10');

    await page.click('[data-testid="create-project-submit"]');
    await page.waitForSelector('[data-testid="project-id"]');

    // Now clone the project
    await page.click('[data-testid="project-actions"]');
    await page.click('[data-testid="clone-project"]');

    // Verify pre-filled data
    await expect(page.locator('[data-testid="project-name"]')).toHaveValue('Copy of Original Project');
    await expect(page.locator('[data-testid="project-description"]')).toHaveValue('Original description');
    await expect(page.locator('[data-testid="project-budget"]')).toHaveValue('500');
    await expect(page.locator('[data-testid="total-tasks"]')).toHaveValue('50');
    await expect(page.locator('[data-testid="payment-per-task"]')).toHaveValue('10');

    // Modify and save
    await page.fill('[data-testid="project-name"]', 'Cloned Project');
    await page.click('[data-testid="create-project-submit"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-name"]')).toContainText('Cloned Project');
  });

  test('should handle large file uploads', async ({ page }) => {
    await loginPage.loginWithTelegram();
    await dashboardPage.navigateToProjects();
    await page.click('[data-testid="create-project-button"]');

    // Fill minimal required fields
    await page.fill('[data-testid="project-name"]', 'Large File Project');
    await page.fill('[data-testid="project-description"]', 'Testing large file uploads');
    await page.fill('[data-testid="project-budget"]', '1000');
    await page.fill('[data-testid="total-tasks"]', '10');
    await page.click('[data-testid="create-project-submit"]');

    // Simulate large file upload
    const fileInput = page.locator('[data-testid="image-upload"]');

    // Create a large mock file
    const largeFile = await page.evaluateHandle(() => {
      const buffer = new ArrayBuffer(50 * 1024 * 1024); // 50MB
      return new File([buffer], 'large-image.jpg', { type: 'image/jpeg' });
    });

    await fileInput.setInputFiles(largeFile);

    // Check upload progress indicator
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-percentage"]')).toBeVisible();

    // Wait for upload to complete or timeout
    await Promise.race([
      page.locator('[data-testid="upload-complete"]').waitFor({ timeout: 30000 }),
      page.locator('[data-testid="upload-error"]').waitFor({ timeout: 30000 })
    ]);

    // Check if upload succeeded or handle error
    if (await page.locator('[data-testid="upload-error"]').isVisible()) {
      const errorMessage = await page.textContent('[data-testid="upload-error"]');
      expect(errorMessage).toContain('file too large');
    } else {
      await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible();
    }
  });

  test('should handle payment confirmation', async ({ page }) => {
    await loginPage.loginWithTelegram();
    await dashboardPage.navigateToProjects();
    await page.click('[data-testid="create-project-button"]');

    // Fill project details
    await page.fill('[data-testid="project-name"]', 'Payment Test Project');
    await page.fill('[data-testid="project-description"]', 'Testing payment flow');
    await page.fill('[data-testid="project-budget"]', '100');
    await page.fill('[data-testid="total-tasks"]', '10');
    await page.fill('[data-testid="payment-per-task"]', '10');

    await page.click('[data-testid="create-project-submit"]');

    // Upload at least one task
    const fileInput = page.locator('[data-testid="image-upload"]');
    await fileInput.setInputFiles(['test/fixtures/sample-images/test-image-1.jpg']);
    await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible();

    // Try to publish
    await page.click('[data-testid="publish-project"]');

    // Mock payment modal
    await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-amount"]')).toContainText('10');
    await expect(page.locator('[data-testid="payment-currency"]')).toContainText('TON');

    // Mock successful payment
    await page.evaluate(() => {
      (window as any).tonConnect = {
        sendTransaction: (options: any) => Promise.resolve({
          boc: 'test_boc'
        })
      };
    });

    await page.click('[data-testid="confirm-payment"]');
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-status"]')).toContainText('ACTIVE');
  });
});