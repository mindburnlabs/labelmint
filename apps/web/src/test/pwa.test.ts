/**
 * PWA Feature Tests for LabelMint
 * Validates all PWA functionality
 */

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 30000,
  retryAttempts: 3
};

// PWA Test Suite
class PWATestSuite {
  private results: { [key: string]: boolean } = {};

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting PWA Test Suite for LabelMint...\n');

    await this.testServiceWorker();
    await this.testManifest();
    await this.testOfflineSupport();
    await this.testCaching();
    await this.testNotifications();
    await this.testInstallPrompt();
    await this.testAppBadging();
    await this.testBackgroundSync();
    await this.testResponsiveDesign();
    await this.testPerformance();

    this.displayResults();
  }

  private async testServiceWorker(): Promise<void> {
    console.log('📋 Testing Service Worker...');

    try {
      // Check if service worker is registered
      const registration = await navigator.serviceWorker.ready;
      this.assert(!!registration, 'Service worker is registered');

      // Check if service worker is active
      this.assert(registration.active?.state === 'activated', 'Service worker is active');

      // Check sync support
      this.assert('sync' in registration, 'Background sync is supported');

      this.results.serviceWorker = true;
      console.log('✅ Service Worker tests passed\n');
    } catch (error) {
      console.error('❌ Service Worker tests failed:', error);
      this.results.serviceWorker = false;
    }
  }

  private async testManifest(): Promise<void> {
    console.log('📱 Testing Web App Manifest...');

    try {
      // Fetch manifest
      const response = await fetch('/manifest.json');
      this.assert(response.ok, 'Manifest is accessible');

      const manifest = await response.json();

      // Check required fields
      this.assert(manifest.name, 'Manifest has name');
      this.assert(manifest.short_name, 'Manifest has short_name');
      this.assert(manifest.start_url, 'Manifest has start_url');
      this.assert(manifest.display, 'Manifest has display mode');
      this.assert(manifest.icons && manifest.icons.length > 0, 'Manifest has icons');

      // Check icons
      const hasRequiredSizes = manifest.icons.some((icon: any) =>
        icon.sizes === '192x192' || icon.sizes === '512x512'
      );
      this.assert(hasRequiredSizes, 'Manifest has required icon sizes');

      this.results.manifest = true;
      console.log('✅ Manifest tests passed\n');
    } catch (error) {
      console.error('❌ Manifest tests failed:', error);
      this.results.manifest = false;
    }
  }

  private async testOfflineSupport(): Promise<void> {
    console.log('🌐 Testing Offline Support...');

    try {
      // Go offline
      await this.setOfflineMode(true);

      // Test offline page
      const response = await fetch('/offline');
      this.assert(response.ok, 'Offline page is accessible');

      // Test cached resources
      const cachedResponse = await caches.match('/');
      this.assert(cachedResponse, 'Home page is cached');

      // Test IndexedDB
      const dbRequest = indexedDB.open('TestDB', 1);
      await new Promise((resolve, reject) => {
        dbRequest.onsuccess = resolve;
        dbRequest.onerror = reject;
      });
      this.assert(true, 'IndexedDB is functional');

      // Go back online
      await this.setOfflineMode(false);

      this.results.offlineSupport = true;
      console.log('✅ Offline support tests passed\n');
    } catch (error) {
      console.error('❌ Offline support tests failed:', error);
      this.results.offlineSupport = false;
      await this.setOfflineMode(false);
    }
  }

  private async testCaching(): Promise<void> {
    console.log('💾 Testing Caching Strategy...');

    try {
      // Check cache names
      const cacheNames = await caches.keys();
      this.assert(cacheNames.length > 0, 'Caches exist');

      // Check specific caches
      const staticCache = await caches.open('labelmint-v1.0.0');
      const staticKeys = await staticCache.keys();
      this.assert(staticKeys.length > 0, 'Static cache has entries');

      // Test cache-first strategy for images
      const imgResponse = await fetch('/icons/icon-192x192.png');
      this.assert(imgResponse.ok, 'Cached image is accessible');

      this.results.caching = true;
      console.log('✅ Caching tests passed\n');
    } catch (error) {
      console.error('❌ Caching tests failed:', error);
      this.results.caching = false;
    }
  }

  private async testNotifications(): Promise<void> {
    console.log('🔔 Testing Push Notifications...');

    try {
      // Check notification permission
      const permission = Notification.permission;
      this.assert(permission !== 'denied', 'Notifications are not blocked');

      // Check push manager support
      this.assert('PushManager' in window, 'Push API is supported');

      // Request permission (if not granted)
      if (permission === 'default') {
        const granted = await Notification.requestPermission();
        this.assert(granted === 'granted', 'Notification permission granted');
      }

      // Test notification display
      const notification = new Notification('Test Notification', {
        body: 'This is a test notification from LabelMint',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png'
      });

      this.assert(!!notification, 'Notification displayed successfully');
      setTimeout(() => notification.close(), 2000);

      this.results.notifications = true;
      console.log('✅ Notification tests passed\n');
    } catch (error) {
      console.error('❌ Notification tests failed:', error);
      this.results.notifications = false;
    }
  }

  private async testInstallPrompt(): Promise<void> {
    console.log('⬇️ Testing Install Prompt...');

    try {
      // Check if install prompt event is supported
      this.assert('onbeforeinstallprompt' in window, 'Install prompt event is supported');

      // Check display mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      this.assert(true, `Display mode: ${isStandalone ? 'standalone' : 'browser'}`);

      // Check iOS standalone
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      this.assert(true, `iOS standalone: ${isInWebAppiOS}`);

      this.results.installPrompt = true;
      console.log('✅ Install prompt tests passed\n');
    } catch (error) {
      console.error('❌ Install prompt tests failed:', error);
      this.results.installPrompt = false;
    }
  }

  private async testAppBadging(): Promise<void> {
    console.log('🏷️ Testing App Badging...');

    try {
      // Check badge API support
      const hasBadgeAPI = 'setAppBadge' in navigator;
      this.assert(hasBadgeAPI, 'Badge API is supported');

      if (hasBadgeAPI) {
        // Test setting badge
        await navigator.setAppBadge(5);
        console.log('  Badge set to 5');

        // Test clearing badge
        await navigator.clearAppBadge();
        console.log('  Badge cleared');
      }

      this.results.badging = hasBadgeAPI;
      console.log('✅ App badging tests passed\n');
    } catch (error) {
      console.error('❌ App badging tests failed:', error);
      this.results.badging = false;
    }
  }

  private async testBackgroundSync(): Promise<void> {
    console.log('🔄 Testing Background Sync...');

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check sync support
      this.assert('sync' in registration, 'Background Sync API is supported');

      if ('sync' in registration) {
        // Register a test sync
        await registration.sync.register('test-sync');
        console.log('  Test sync registered');

        // Get sync registrations
        const tags = await registration.sync.getTags();
        this.assert(tags.includes('test-sync'), 'Sync registration found');

        // Unregister test sync
        await registration.sync.unregister('test-sync');
        console.log('  Test sync unregistered');
      }

      this.results.backgroundSync = true;
      console.log('✅ Background sync tests passed\n');
    } catch (error) {
      console.error('❌ Background sync tests failed:', error);
      this.results.backgroundSync = false;
    }
  }

  private async testResponsiveDesign(): Promise<void> {
    console.log('📐 Testing Responsive Design...');

    try {
      // Test viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]');
      this.assert(viewport?.getAttribute('content')?.includes('width=device-width'), 'Viewport meta tag is correct');

      // Test media queries
      const mobileQuery = window.matchMedia('(max-width: 768px)');
      const tabletQuery = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');
      const desktopQuery = window.matchMedia('(min-width: 1025px)');

      this.assert(true, `Mobile query: ${mobileQuery.matches}`);
      this.assert(true, `Tablet query: ${tabletQuery.matches}`);
      this.assert(true, `Desktop query: ${desktopQuery.matches}`);

      // Test touch support
      this.assert('ontouchstart' in window, 'Touch events are supported');

      this.results.responsive = true;
      console.log('✅ Responsive design tests passed\n');
    } catch (error) {
      console.error('❌ Responsive design tests failed:', error);
      this.results.responsive = false;
    }
  }

  private async testPerformance(): Promise<void> {
    console.log('⚡ Testing Performance...');

    try {
      // Test Core Web Vitals
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      // Time to First Byte
      const ttfb = navigation.responseStart - navigation.requestStart;
      this.assert(ttfb < 800, `TTFB: ${Math.round(ttfb)}ms (< 800ms)`);

      // First Contentful Paint
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcp) {
        this.assert(fcp.startTime < 2000, `FCP: ${Math.round(fcp.startTime)}ms (< 2000ms)`);
      }

      // Test LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        console.log(`  LCP: ${Math.round(lcp.startTime)}ms`);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // Test memory usage
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
        console.log(`  Memory usage: ${usedMB}MB`);
      }

      this.results.performance = true;
      console.log('✅ Performance tests passed\n');
    } catch (error) {
      console.error('❌ Performance tests failed:', error);
      this.results.performance = false;
    }
  }

  private async setOfflineMode(offline: boolean): Promise<void> {
    // Simulate offline mode for testing
    if (offline) {
      // Disconnect service worker
      if (navigator.serviceWorker.controller) {
        await (navigator.serviceWorker.controller as any).postMessage({ type: 'FORCE_OFFLINE' });
      }
    } else {
      // Reconnect
      window.location.reload();
    }
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ ${message}`);
  }

  private displayResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    const totalTests = Object.keys(this.results).length;
    const passedTests = Object.values(this.results).filter(Boolean).length;
    const failedTests = totalTests - passedTests;

    Object.entries(this.results).forEach(([test, passed]) => {
      const icon = passed ? '✅' : '❌';
      const formattedTest = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${icon} ${formattedTest}`);
    });

    console.log('\n========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (failedTests === 0) {
      console.log('\n🎉 All PWA tests passed! LabelMint is ready for production.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review and fix the issues.');
    }
  }
}

// Export test suite
export default PWATestSuite;

// Auto-run tests if in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Add test runner to window for manual testing
  window.runPWATests = async () => {
    const testSuite = new PWATestSuite();
    await testSuite.runAllTests();
  };

  console.log('💡 PWA tests loaded. Run window.runPWATests() to execute all tests.');
}