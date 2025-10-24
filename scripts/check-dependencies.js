#!/usr/bin/env node

/**
 * LabelMint Dependency Consistency Checker
 * =======================================
 *
 * This script checks for dependency version inconsistencies across all packages
 * in the LabelMint monorepo.
 */

import fs from 'fs';
import path from 'path';

class DependencyChecker {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.packageJsonFiles = [];
    this.dependencyMap = new Map();
    this.inconsistencies = [];
  }

  async check() {
    console.log('🔍 Checking dependency consistency across packages...\n');

    await this.findPackageJsonFiles();
    await this.analyzeDependencies();
    this.printResults();

    if (this.inconsistencies.length > 0) {
      process.exit(1);
    }
  }

  async findPackageJsonFiles() {
    const files = this.findFiles('package.json', this.rootDir);
    this.packageJsonFiles = files.filter(file =>
      !file.includes('/node_modules/') &&
      !file.includes('/dist/') &&
      !file.includes('/build/')
    );
  }

  async analyzeDependencies() {
    console.log('📦 Analyzing package.json files...');

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        const relativePath = path.relative(this.rootDir, file);

        this.analyzePackageDependencies(relativePath, packageJson);
      } catch (error) {
        console.error(`❌ Failed to parse ${file}: ${error.message}`);
      }
    }
  }

  analyzePackageDependencies(filePath, packageJson) {
    const dependencyTypes = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ];

    dependencyTypes.forEach(depType => {
      if (packageJson[depType]) {
        Object.entries(packageJson[depType]).forEach(([name, version]) => {
          const key = `${depType}:${name}`;

          if (!this.dependencyMap.has(key)) {
            this.dependencyMap.set(key, []);
          }

          this.dependencyMap.get(key).push({
            package: filePath,
            version,
            type: depType
          });
        });
      }
    });
  }

  printResults() {
    console.log('\n📋 DEPENDENCY CONSISTENCY REPORT');
    console.log('===============================\n');

    this.findInconsistencies();
    this.printInconsistencies();
    this.printCriticalIssues();
    this.printSummary();
  }

  findInconsistencies() {
    for (const [dependency, usages] of this.dependencyMap) {
      const versions = [...new Set(usages.map(u => u.version))];

      if (versions.length > 1) {
        this.inconsistencies.push({
          dependency,
          versions,
          usages
        });
      }
    }
  }

  printInconsistencies() {
    if (this.inconsistencies.length === 0) {
      console.log('✅ No dependency inconsistencies found!\n');
      return;
    }

    console.log('⚠️  DEPENDENCY INCONSISTENCIES:');
    console.log('===============================\n');

    this.inconsistencies.forEach(inconsistency => {
      const [depType, depName] = inconsistency.dependency.split(':');

      console.log(`📦 ${depName} (${depType})`);
      console.log(`   Versions found: ${inconsistency.versions.join(', ')}\n`);

      inconsistency.usages.forEach(usage => {
        console.log(`   ${usage.package}: ${usage.version}`);
      });

      console.log('');
    });
  }

  printCriticalIssues() {
    console.log('🚨 CRITICAL ISSUES:');
    console.log('===================\n');

    // Check for ESLint version conflicts
    const eslintDeps = Array.from(this.dependencyMap.keys())
      .filter(key => key.includes('eslint'))
      .filter(key => this.dependencyMap.get(key).length > 1);

    if (eslintDeps.length > 0) {
      console.log('ESLint Version Conflicts:');
      eslintDeps.forEach(dep => {
        const usages = this.dependencyMap.get(dep);
        const versions = [...new Set(usages.map(u => u.version))];
        if (versions.length > 1) {
          console.log(`  ❌ ${dep}: ${versions.join(' vs ')}`);
        }
      });
      console.log('');
    }

    // Check for TypeScript version conflicts
    const tsDeps = Array.from(this.dependencyMap.keys())
      .filter(key => key.includes('typescript'))
      .filter(key => this.dependencyMap.get(key).length > 1);

    if (tsDeps.length > 0) {
      console.log('TypeScript Version Conflicts:');
      tsDeps.forEach(dep => {
        const usages = this.dependencyMap.get(dep);
        const versions = [...new Set(usages.map(u => u.version))];
        if (versions.length > 1) {
          console.log(`  ❌ ${dep}: ${versions.join(' vs ')}`);
        }
      });
      console.log('');
    }

    // Check for React version conflicts
    const reactDeps = Array.from(this.dependencyMap.keys())
      .filter(key => key.includes('react') && !key.includes('react-'))
      .filter(key => this.dependencyMap.get(key).length > 1);

    if (reactDeps.length > 0) {
      console.log('React Version Conflicts:');
      reactDeps.forEach(dep => {
        const usages = this.dependencyMap.get(dep);
        const versions = [...new Set(usages.map(u => u.version))];
        if (versions.length > 1) {
          console.log(`  ❌ ${dep}: ${versions.join(' vs ')}`);
        }
      });
      console.log('');
    }
  }

  printSummary() {
    const totalPackages = this.packageJsonFiles.length;
    const totalDependencies = this.dependencyMap.size;
    const totalInconsistencies = this.inconsistencies.length;

    console.log('📊 SUMMARY:');
    console.log('===========');
    console.log(`📦 Packages analyzed: ${totalPackages}`);
    console.log(`🔗 Dependencies found: ${totalDependencies}`);
    console.log(`⚠️  Inconsistencies: ${totalInconsistencies}`);

    if (totalInconsistencies === 0) {
      console.log('\n🎉 All dependencies are consistent across packages!');
    } else {
      console.log(`\n💥 Found ${totalInconsistencies} dependency inconsistencies that should be resolved.`);
      console.log('💡 Consider using workspace tools like npm-workspace or pnpm to manage versions.');
    }
  }

  findFiles(pattern, startDir) {
    const results = [];

    function traverse(dir) {
      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            traverse(fullPath);
          } else if (file === pattern) {
            results.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    }

    traverse(startDir);
    return results;
  }
}

// Run the checker if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new DependencyChecker();
  checker.check().catch(console.error);
}

export default DependencyChecker;