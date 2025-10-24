// Simple SVG icon generator for LabelMint PWA
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background circle with gradient -->
  <circle cx="256" cy="256" r="240" fill="url(#gradient)" />

  <!-- Letter L -->
  <path d="M 180 160 L 180 340 L 220 340 L 220 200 L 260 200 L 260 160 Z" fill="white" />

  <!-- Label tag shape -->
  <rect x="260" y="220" width="80" height="60" rx="8" fill="white" opacity="0.9" />
  <circle cx="320" cy="250" r="8" fill="#4F46E5" />

  <!-- Mint leaf decoration -->
  <path d="M 200 300 Q 210 290, 220 300 T 240 300" stroke="white" stroke-width="3" fill="none" opacity="0.8" />
</svg>`;

// Create the badge icon
const svgBadge = `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
  <circle cx="36" cy="36" r="32" fill="#4F46E5" />
  <text x="36" y="45" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="32" font-weight="bold">L</text>
</svg>`;

// Save SVG files
fs.writeFileSync(path.join(__dirname, '../public/icons/icon-512x512.svg'), svgIcon);
fs.writeFileSync(path.join(__dirname, '../public/icons/badge-72x72.svg'), svgBadge);

console.log('SVG icons generated successfully!');
console.log('For production, convert these SVGs to PNG files using:');
console.log('- Online converter like https://convertio.co/svg-png/');
console.log('- Or use ImageMagick: convert icon-512x512.svg icon-512x512.png');
console.log('');
console.log('Required PNG sizes:');
console.log('- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512');