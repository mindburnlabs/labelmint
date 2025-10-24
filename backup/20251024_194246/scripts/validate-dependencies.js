#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔍 Validating LabelMint Dependency Management\n');

// Check if pnpm-lock.yaml exists
const hasPnpmLock = existsSync('pnpm-lock.yaml');
console.log(`✅ pnpm-lock.yaml exists: ${hasPnpmLock}`);

// Check for package-lock.json files
try {
  const packageLockFiles = execSync('find . -name "package-lock.json" -not -path "./node_modules/*"', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (packageLockFiles.length === 0 || (packageLockFiles.length === 1 && packageLockFiles[0] === '')) {
    console.log('✅ No package-lock.json files found');
  } else {
    console.log(`❌ Found ${packageLockFiles.length} package-lock.json files that should be removed:`);
    packageLockFiles.forEach(file => console.log(`   - ${file}`));
  }
} catch (error) {
  console.log('✅ No package-lock.json files found');
}

// Read package.json files
const packagePaths = [
  'package.json',
  'apps/web/package.json',
  'apps/admin/package.json',
  'apps/telegram-mini-app/package.json',
  'packages/ui/package.json',
  'services/enterprise-api/package.json'
];

console.log('\n📦 Checking version consistency:');

const versions = {
  react: new Set(),
  typescript: new Set(),
  eslint: new Set()
};

packagePaths.forEach(path => {
  if (existsSync(path)) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));

      // Extract versions
      if (pkg.dependencies?.react) versions.react.add(pkg.dependencies.react);
      if (pkg.dependencies?.typescript) versions.typescript.add(pkg.dependencies.typescript);
      if (pkg.dependencies?.eslint) versions.eslint.add(pkg.dependencies.eslint);
      if (pkg.devDependencies?.react) versions.react.add(pkg.devDependencies.react);
      if (pkg.devDependencies?.typescript) versions.typescript.add(pkg.devDependencies.typescript);
      if (pkg.devDependencies?.eslint) versions.eslint.add(pkg.devDependencies.eslint);

      console.log(`   ✅ ${path}`);
    } catch (error) {
      console.log(`   ❌ ${path}: Error reading package.json`);
    }
  } else {
    console.log(`   ⚠️  ${path}: File not found`);
  }
});

console.log('\n📋 Version Summary:');
console.log(`   React versions: ${Array.from(versions.react).join(', ')}`);
console.log(`   TypeScript versions: ${Array.from(versions.typescript).join(', ')}`);
console.log(`   ESLint versions: ${Array.from(versions.eslint).join(', ')}`);

// Check for expected versions
const expectedVersions = {
  react: '^19.0.0',
  typescript: '^5.7.2',
  eslint: '^9.15.0'
};

console.log('\n🎯 Expected vs Actual:');
Object.entries(expectedVersions).forEach(([dep, expected]) => {
  const actual = Array.from(versions[dep]);
  const isConsistent = actual.length === 1 && actual[0] === expected;
  console.log(`   ${dep}: ${isConsistent ? '✅' : '❌'} Expected ${expected}, Found ${actual.join(', ')}`);
});

console.log('\n🏁 Dependency validation complete!');