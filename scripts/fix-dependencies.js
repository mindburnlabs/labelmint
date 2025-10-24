#!/usr/bin/env node

/**
 * LabelMint Dependency Fixer Script
 * =================================
 *
 * This script automatically fixes common dependency inconsistencies across
 * the LabelMint repository by standardizing versions.
 */

import fs from 'fs';
import path from 'path';

class DependencyFixer {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.packageJsonFiles = [];
    this.fixesApplied = 0;
    this.errors = [];
  }

  async fixAll() {
    console.log('🔧 Fixing LabelMint dependency inconsistencies...\n');

    await this.findPackageJsonFiles();
    await this.fixESLintVersions();
    await this.fixTypeScriptVersions();
    await this.fixReactVersions();
    await this.fixUtilityLibraries();
    await this.fixTailwindVersions();
    await this.fixBackendDependencies();
    await this.fixRemainingDependencies();
    await this.fixPeerDependencies();

    this.printResults();
  }

  async findPackageJsonFiles() {
    const files = this.findFiles('package.json', this.rootDir);
    this.packageJsonFiles = files.filter(file =>
      !file.includes('/node_modules/') &&
      !file.includes('/dist/') &&
      !file.includes('/build/')
    );
    console.log(`📦 Found ${this.packageJsonFiles.length} package.json files\n`);
  }

  async fixESLintVersions() {
    console.log('🔧 Fixing ESLint versions...');

    const standardVersions = {
      'eslint': '^9.15.0',
      '@eslint/js': '^9.15.0',
      '@typescript-eslint/eslint-plugin': '^8.15.0',
      '@typescript-eslint/parser': '^8.15.0',
      'eslint-plugin-react-hooks': '^5.2.0',
      'eslint-plugin-react': '^7.37.2',
      'eslint-plugin-import': '^2.31.0',
      'eslint-plugin-jsx-a11y': '^6.10.2'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update devDependencies
        if (packageJson.devDependencies) {
          Object.keys(standardVersions).forEach(dep => {
            if (packageJson.devDependencies[dep]) {
              packageJson.devDependencies[dep] = standardVersions[dep];
              modified = true;
            }
          });
        }

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated ESLint dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixTypeScriptVersions() {
    console.log('🔧 Fixing TypeScript versions...');

    const standardVersions = {
      'typescript': '^5.7.2',
      '@types/node': '^20.10.0'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update devDependencies and dependencies
        ['devDependencies', 'dependencies'].forEach(depType => {
          if (packageJson[depType]) {
            Object.keys(standardVersions).forEach(dep => {
              if (packageJson[depType][dep]) {
                packageJson[depType][dep] = standardVersions[dep];
                modified = true;
              }
            });
          }
        });

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated TypeScript dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixReactVersions() {
    console.log('🔧 Fixing React versions...');

    const standardVersions = {
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^5.0.4',
      'vite': '^7.1.7'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update devDependencies
        if (packageJson.devDependencies) {
          Object.keys(standardVersions).forEach(dep => {
            if (packageJson.devDependencies[dep]) {
              packageJson.devDependencies[dep] = standardVersions[dep];
              modified = true;
            }
          });
        }

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated React dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixUtilityLibraries() {
    console.log('🔧 Fixing utility library versions...');

    const standardVersions = {
      'clsx': '^2.1.1',
      'tailwind-merge': '^2.5.4',
      'axios': '^1.7.9'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update dependencies
        if (packageJson.dependencies) {
          Object.keys(standardVersions).forEach(dep => {
            if (packageJson.dependencies[dep]) {
              packageJson.dependencies[dep] = standardVersions[dep];
              modified = true;
            }
          });
        }

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated utility libraries in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixTailwindVersions() {
    console.log('🔧 Fixing TailwindCSS versions...');

    const standardVersions = {
      'tailwindcss': '^3.3.6',
      'postcss': '^8.4.32',
      'autoprefixer': '^10.4.16'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update devDependencies
        if (packageJson.devDependencies) {
          Object.keys(standardVersions).forEach(dep => {
            if (packageJson.devDependencies[dep]) {
              packageJson.devDependencies[dep] = standardVersions[dep];
              modified = true;
            }
          });
        }

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated TailwindCSS dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixBackendDependencies() {
    console.log('🔧 Fixing backend service dependencies...');

    const standardVersions = {
      'express': '^4.21.2',
      'express-rate-limit': '^7.4.1',
      'helmet': '^8.0.0',
      'redis': '^4.7.0',
      'ioredis': '^5.4.1',
      'node-cron': '^3.0.3',
      'swagger-ui-express': '^5.0.1',
      'uuid': '^10.0.0',
      'dotenv': '^16.4.7',
      '@types/express': '^5.0.0',
      '@types/swagger-ui-express': '^4.1.8',
      '@types/uuid': '^10.0.0',
      'nodemailer': '^6.9.16',
      'pg': '^8.16.3',
      '@supabase/supabase-js': '^2.76.1',
      'zod': '^3.23.8'
    };

    // Only apply to backend services
    const backendFiles = this.packageJsonFiles.filter(file =>
      file.includes('/services/') || file.includes('payment-backend')
    );

    for (const file of backendFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update both dependencies and devDependencies
        ['dependencies', 'devDependencies'].forEach(depType => {
          if (packageJson[depType]) {
            Object.keys(standardVersions).forEach(dep => {
              if (packageJson[depType][dep]) {
                packageJson[depType][dep] = standardVersions[dep];
                modified = true;
              }
            });
          }
        });

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated backend dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixRemainingDependencies() {
    console.log('🔧 Fixing remaining dependency inconsistencies...');

    const standardVersions = {
      'framer-motion': '^12.23.24',
      'pg': '^8.16.3',
      '@playwright/test': '^1.44.0',
      'node-fetch': '^3.3.2',
      '@types/jest': '^29.5.8',
      'jest': '^29.7.0',
      'ts-jest': '^29.1.1',
      'tsup': '^8.3.5',
      'http-proxy-middleware': '^3.0.0',
      'sharp': '^0.34.4',
      'ws': '^8.18.1',
      '@types/ws': '^8.5.13',
      'vitest': '^4.0.3'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update both dependencies and devDependencies
        ['dependencies', 'devDependencies'].forEach(depType => {
          if (packageJson[depType]) {
            Object.keys(standardVersions).forEach(dep => {
              if (packageJson[depType][dep]) {
                packageJson[depType][dep] = standardVersions[dep];
                modified = true;
              }
            });
          }
        });

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated remaining dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
  }

  async fixPeerDependencies() {
    console.log('🔧 Fixing peer dependency inconsistencies...');

    const standardVersions = {
      'typescript': '>=5.0.0'
    };

    for (const file of this.packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        let modified = false;

        // Update peerDependencies
        if (packageJson.peerDependencies) {
          Object.keys(standardVersions).forEach(dep => {
            if (packageJson.peerDependencies[dep]) {
              packageJson.peerDependencies[dep] = standardVersions[dep];
              modified = true;
            }
          });
        }

        if (modified) {
          fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
          this.fixesApplied++;
          console.log(`   ✓ Updated peer dependencies in ${path.relative(this.rootDir, file)}`);
        }
      } catch (error) {
        this.errors.push(`Failed to update ${file}: ${error.message}`);
      }
    }

    console.log('');
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

  printResults() {
    console.log('📋 DEPENDENCY FIX RESULTS');
    console.log('========================\n');
    console.log(`✅ Fixes applied: ${this.fixesApplied}`);
    console.log(`❌ Errors: ${this.errors.length}\n`);

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }

    if (this.fixesApplied > 0) {
      console.log('✅ Dependency fixes completed successfully!');
      console.log('💡 Run "npm run check-deps" again to verify the fixes.');
      console.log('💡 Run "npm install" to apply the changes.');
    } else {
      console.log('ℹ️  No dependency fixes were needed.');
    }
  }
}

// Run the fixer if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new DependencyFixer();
  fixer.fixAll().catch(console.error);
}

export default DependencyFixer;