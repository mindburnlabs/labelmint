import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  // Ensure test fixtures directory exists
  const fixturesDir = path.join(__dirname, '../fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // Create test images of different sizes
  const sizes = [
    { name: 'small.png', width: 100, height: 100 },
    { name: 'medium.png', width: 500, height: 500 },
    { name: 'large.png', width: 1000, height: 1000 },
  ];

  for (const size of sizes) {
    const filePath = path.join(fixturesDir, size.name);
    if (!fs.existsSync(filePath)) {
      // Create a simple test image using canvas if available
      try {
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(size.width, size.height);
        const ctx = canvas.getContext('2d');

        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.5, '#00ff00');
        gradient.addColorStop(1, '#0000ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size.width, size.height);

        // Add text
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${size.width}x${size.height}`, size.width / 2, size.height / 2);

        fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
      } catch (error) {
        // Fallback: create simple PNG header
        const pngHeader = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          // Minimal PNG with specified dimensions
          ...Buffer.from(`IHDR${size.width.toString(16).padStart(8, '0')}${size.height.toString(16).padStart(8, '0')}0802000000`),
        ]);
        fs.writeFileSync(filePath, pngHeader);
      }
    }
  }

  // Create test PDF
  const pdfPath = path.join(fixturesDir, 'document.pdf');
  if (!fs.existsSync(pdfPath)) {
    const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
72 720 Td
(End-to-End Test Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000067 00000 n
0000000120 00000 n
0000000260 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
361
%%EOF`);
    fs.writeFileSync(pdfPath, pdfContent);
  }

  // Create test JSON data file
  const jsonPath = path.join(fixturesDir, 'data.json');
  if (!fs.existsSync(jsonPath)) {
    const jsonData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: Math.random(),
        label: `Item ${i}`,
      })),
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  }

  // Verify server is running
  const baseURL = config.webServer?.url || 'http://localhost:3001';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const response = await page.goto(`${baseURL}/health`, { timeout: 30000 });
    const health = await response?.json();

    if (!response?.ok() || health?.status !== 'OK') {
      throw new Error('Server health check failed');
    }

    console.log('✅ Server is healthy and ready for E2E tests');
  } catch (error) {
    console.error('❌ Server health check failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ E2E test setup complete');
}

export default globalSetup;