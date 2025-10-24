#!/usr/bin/env node

/**
 * LabelMint Configuration Validation Script
 * ========================================
 *
 * This script validates all configuration files across the LabelMint repository
 * to ensure consistency and compliance with the established standards.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Configuration validation rules
const VALIDATION_RULES = {
  typescript: {
    requiredFields: ['compilerOptions'],
    requiredCompilerOptions: ['target', 'module', 'strict'],
    validTargets: ['ES2022', 'ES2023'],
    validModuleResolutions: ['bundler', 'node'],
    appsMustUseBundler: true,
    servicesMustUseNode: true
  },
  eslint: {
    mustBeFlatFormat: true,
    requiredImports: [],
    forbiddenPatterns: ['.eslintrc.json', '.eslintrc.js']
  },
  nextjs: {
    requiredSecurityHeaders: [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy'
    ],
    recommendedSettings: ['compress', 'poweredByHeader: false']
  },
  environment: {
    requiredVars: ['NODE_ENV'],
    forbiddenInProduction: ['localhost', '127.0.0.1'],
    secretPatterns: [
      /SECRET/i,
      /PASSWORD/i,
      /KEY/i,
      /TOKEN/i
    ]
  }
};

class ConfigValidator {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.errors = [];
    this.warnings = [];
    this.validatedFiles = 0;
  }

  // Main validation entry point
  async validateAll() {
    console.log('🔍 Starting LabelMint configuration validation...\n');

    await this.validateTypeScriptConfigs();
    await this.validateESLintConfigs();
    await this.validateNextJSConfigs();
    await this.validateEnvironmentConfigs();
    await this.validateMonitoringConfigs();

    this.printResults();

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  // TypeScript configuration validation
  async validateTypeScriptConfigs() {
    console.log('📝 Validating TypeScript configurations...');

    const tsConfigFiles = this.findFiles('tsconfig.json', this.rootDir);

    for (const file of tsConfigFiles) {
      try {
        const config = this.readJSONFile(file);
        this.validateTypeScriptConfig(file, config);
        this.validatedFiles++;
      } catch (error) {
        this.errors.push(`Failed to parse ${file}: ${error.message}`);
      }
    }

    console.log(`   ✓ Validated ${tsConfigFiles.length} TypeScript configurations\n`);
  }

  validateTypeScriptConfig(filePath, config) {
    const rules = VALIDATION_RULES.typescript;
    const isApp = filePath.includes('/apps/');
    const isService = filePath.includes('/services/');
    const isTelegramApp = filePath.includes('telegram-mini-app');

    // For TypeScript configs that extend base configs, we need to check if they have their own compilerOptions
    // If they extend a base config, they may not need all required fields
    const hasBaseConfig = config.extends && config.extends.includes('tsconfig.base.json');
    const hasServiceConfig = config.extends && config.extends.includes('tsconfig.service.json');
    const hasAppConfig = config.extends && config.extends.includes('tsconfig.app.json');

    // Special handling for telegram-mini-app which uses project references
    if (isTelegramApp && config.files && config.references) {
      return; // Skip validation for project reference configs
    }

    // For configs that extend base configs, check if they have compilerOptions or inherit them
    if (!config.compilerOptions && !hasBaseConfig && !hasServiceConfig && !hasAppConfig) {
      this.errors.push(`${filePath}: Missing compilerOptions`);
      return;
    }

    // For configs that extend base configs, we should be more lenient about required options
    if (config.compilerOptions) {
      // Check required compiler options only if this is a base config
      if (filePath.includes('tsconfig.base.json')) {
        rules.requiredCompilerOptions.forEach(option => {
          if (!(option in config.compilerOptions)) {
            this.errors.push(`${filePath}: Missing required compiler option: ${option}`);
          }
        });
      }

      // Validate target
      if (config.compilerOptions.target && !rules.validTargets.includes(config.compilerOptions.target)) {
        this.warnings.push(`${filePath}: Consider updating target to ${rules.validTargets.join(' or ')}`);
      }

      // Validate module resolution
      if (config.compilerOptions.moduleResolution) {
        if (isApp && rules.appsMustUseBundler && config.compilerOptions.moduleResolution !== 'bundler') {
          this.errors.push(`${filePath}: Apps should use 'bundler' module resolution`);
        }
        if (isService && rules.servicesMustUseNode && config.compilerOptions.moduleResolution !== 'node') {
          this.errors.push(`${filePath}: Services should use 'node' module resolution`);
        }
      }

      // Check strict mode
      if (!config.compilerOptions.strict) {
        this.warnings.push(`${filePath}: Consider enabling strict mode for better type safety`);
      }
    } else if (hasBaseConfig || hasServiceConfig || hasAppConfig) {
      // For extending configs, just warn about missing strict mode in the inherited config
      // since we can't easily check the inherited values
      this.warnings.push(`${filePath}: Extends base config - ensure strict mode is enabled in base configuration`);
    }
  }

  // ESLint configuration validation
  async validateESLintConfigs() {
    console.log('🔧 Validating ESLint configurations...');

    const eslintFiles = [
      ...this.findFiles('eslint.config.js', this.rootDir),
      ...this.findFiles('.eslintrc.json', this.rootDir),
      ...this.findFiles('.eslintrc.js', this.rootDir)
    ];

    for (const file of eslintFiles) {
      if (file.endsWith('.json')) {
        this.errors.push(`${file}: Legacy ESLint format detected. Convert to flat config (eslint.config.js)`);
        continue;
      }

      try {
        // For JS config files, we'll just check they exist and aren't legacy format
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('module.exports')) {
          this.warnings.push(`${file}: Consider converting to ES module format`);
        }
        this.validatedFiles++;
      } catch (error) {
        this.errors.push(`Failed to read ${file}: ${error.message}`);
      }
    }

    console.log(`   ✓ Validated ${eslintFiles.length} ESLint configurations\n`);
  }

  // Next.js configuration validation
  async validateNextJSConfigs() {
    console.log('🚀 Validating Next.js configurations...');

    const nextConfigFiles = this.findFiles('next.config.js', this.rootDir);

    for (const file of nextConfigFiles) {
      try {
        // Read the config file content
        const content = fs.readFileSync(file, 'utf8');
        this.validateNextJSConfig(file, content);
        this.validatedFiles++;
      } catch (error) {
        this.errors.push(`Failed to read ${file}: ${error.message}`);
      }
    }

    console.log(`   ✓ Validated ${nextConfigFiles.length} Next.js configurations\n`);
  }

  validateNextJSConfig(filePath, content) {
    const rules = VALIDATION_RULES.nextjs;

    // Check for base config extension
    if (!content.includes('baseConfig') && !content.includes('require(\'../../config/shared/next.config.base.js\')')) {
      this.warnings.push(`${filePath}: Consider extending the shared Next.js base configuration`);
    }

    // Only check for security headers if not extending base config (since base config includes them)
    if (!content.includes('baseConfig')) {
      // Check for security headers (basic string check)
      rules.requiredSecurityHeaders.forEach(header => {
        if (!content.includes(header)) {
          this.warnings.push(`${filePath}: Consider adding ${header} security header`);
        }
      });

      // Check for recommended settings
      if (!content.includes('poweredByHeader: false')) {
        this.warnings.push(`${filePath}: Consider setting poweredByHeader: false`);
      }
    }
  }

  // Environment configuration validation
  async validateEnvironmentConfigs() {
    console.log('🌍 Validating environment configurations...');

    const envFiles = [
      ...this.findFiles('.env*', this.rootDir),
      ...this.findFiles('.env.template', this.rootDir)
    ].filter(file => !file.includes('.example'));

    for (const file of envFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        this.validateEnvironmentConfig(file, content);
        this.validatedFiles++;
      } catch (error) {
        this.errors.push(`Failed to read ${file}: ${error.message}`);
      }
    }

    console.log(`   ✓ Validated ${envFiles.length} environment configurations\n`);
  }

  validateEnvironmentConfig(filePath, content) {
    const rules = VALIDATION_RULES.environment;
    const isProduction = filePath.includes('production') || filePath.includes('.env.prod');

    // Check for required variables
    rules.requiredVars.forEach(varName => {
      if (!content.includes(`${varName}=`)) {
        this.warnings.push(`${filePath}: Missing required environment variable: ${varName}`);
      }
    });

    // Check for production issues
    if (isProduction) {
      rules.forbiddenInProduction.forEach(pattern => {
        if (content.includes(pattern)) {
          this.errors.push(`${filePath}: Production config contains development pattern: ${pattern}`);
        }
      });
    }

    // Check for hardcoded secrets (only warn, might be intentional in templates)
    if (!filePath.includes('.template')) {
      rules.secretPatterns.forEach(pattern => {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (pattern.test(line) && !line.includes('CHANGE_THIS') && !line.includes('your-')) {
            this.warnings.push(`${filePath}:${index + 1}: Potential hardcoded secret detected`);
          }
        });
      });
    }
  }

  // Monitoring configuration validation
  async validateMonitoringConfigs() {
    console.log('📊 Validating monitoring configurations...');

    const prometheusFiles = [
      ...this.findFiles('prometheus.yml', this.rootDir),
      ...this.findFiles('prometheus.yaml', this.rootDir)
    ];

    for (const file of prometheusFiles) {
      try {
        const config = yaml.load(fs.readFileSync(file, 'utf8'));
        this.validatePrometheusConfig(file, config);
        this.validatedFiles++;
      } catch (error) {
        this.errors.push(`Failed to parse ${file}: ${error.message}`);
      }
    }

    console.log(`   ✓ Validated ${prometheusFiles.length} monitoring configurations\n`);
  }

  validatePrometheusConfig(filePath, config) {
    if (!config.global) {
      this.warnings.push(`${filePath}: Missing global configuration section`);
    }

    if (!config.scrape_configs || config.scrape_configs.length === 0) {
      this.warnings.push(`${filePath}: No scrape configurations defined`);
    }

    // Check for alertmanager configuration
    if (!config.alerting || !config.alerting.alertmanagers) {
      this.warnings.push(`${filePath}: No alertmanager configuration found`);
    }
  }

  // Utility methods
  findFiles(pattern, startDir) {
    const results = [];

    function traverse(dir) {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          traverse(fullPath);
        } else if (file === pattern || (pattern.includes('*') && file.includes(pattern.replace('*', '')))) {
          results.push(fullPath);
        }
      }
    }

    traverse(startDir);
    return results;
  }

  readJSONFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  printResults() {
    console.log('\n📋 VALIDATION RESULTS');
    console.log('====================');
    console.log(`✅ Files validated: ${this.validatedFiles}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}\n`);

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All configurations passed validation!');
    } else if (this.errors.length === 0) {
      console.log('✅ All configurations are valid (with warnings)');
    } else {
      console.log('💥 Configuration validation failed!');
    }
  }
}

// Run the validator if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ConfigValidator();
  validator.validateAll().catch(console.error);
}

export default ConfigValidator;