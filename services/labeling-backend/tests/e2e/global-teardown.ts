import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');

  // Clean up test fixtures
  const fixturesDir = path.join(__dirname, '../fixtures');
  if (fs.existsSync(fixturesDir)) {
    const files = fs.readdirSync(fixturesDir);
    for (const file of files) {
      const filePath = path.join(fixturesDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.warn(`Failed to delete fixture file ${file}:`, error);
      }
    }
  }

  // Clean up test results
  const resultsDir = path.join(__dirname, '../../test-results');
  if (fs.existsSync(resultsDir)) {
    // Keep recent test results, delete old ones
    const files = fs.readdirSync(resultsDir);
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(resultsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtime.getTime() < oneDayAgo) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.warn(`Failed to delete old test result ${file}:`, error);
        }
      }
    }
  }

  // Clean up coverage reports older than 7 days
  const coverageDir = path.join(__dirname, '../../coverage');
  if (fs.existsSync(coverageDir)) {
    const files = fs.readdirSync(coverageDir, { recursive: true });
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (typeof file === 'string') {
        const filePath = path.join(coverageDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && stats.mtime.getTime() < sevenDaysAgo) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
  }

  console.log('✅ E2E test cleanup complete');
}

export default globalTeardown;