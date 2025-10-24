#!/usr/bin/env node

/**
 * Supabase Remote Database Management Script
 * Provides automated utilities for managing remote Supabase databases
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG = {
  projectRef: process.env.SUPABASE_PROJECT_REF,
  accessToken: process.env.SUPABASE_ACCESS_TOKEN,
  localDbUrl: process.env.LOCAL_DB_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
  remoteDbUrl: process.env.REMOTE_DB_URL,
  env: process.env.NODE_ENV || 'development'
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function execCommand(command, { silent = false } = {}) {
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return result;
  } catch (err) {
    error(`Command failed: ${command}`);
    if (!silent) {
      console.error(err.message);
    }
    process.exit(1);
  }
}

function checkPrerequisites() {
  info('Checking prerequisites...');

  // Check if Supabase CLI is installed
  try {
    execSync('supabase --version', { stdio: 'pipe' });
  } catch {
    error('Supabase CLI is not installed');
    info('Install with: brew install supabase/tap/supabase');
    process.exit(1);
  }

  // Check environment variables
  if (!CONFIG.projectRef) {
    error('SUPABASE_PROJECT_REF environment variable is required');
    process.exit(1);
  }

  if (!CONFIG.accessToken) {
    error('SUPABASE_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  success('Prerequisites check passed');
}

function initSupabase() {
  info('Initializing Supabase project...');

  if (!fs.existsSync('supabase')) {
    execCommand('supabase init');
    success('Supabase project initialized');
  } else {
    warning('Supabase project already initialized');
  }

  // Link to remote project
  if (!fs.existsSync('supabase/.branches/_current_branch')) {
    execCommand(`supabase link --project-ref ${CONFIG.projectRef}`);
    success('Linked to remote Supabase project');
  }
}

function startLocal() {
  info('Starting local Supabase development...');
  execCommand('supabase start', { silent: true });
  success('Local Supabase started');
}

function stopLocal() {
  info('Stopping local Supabase...');
  execCommand('supabase stop');
  success('Local Supabase stopped');
}

function generateMigration(name = 'new_migration') {
  info(`Generating migration: ${name}`);

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const migrationName = `${timestamp}_${name}.sql`;

  execCommand(`supabase db diff --use-migra --schema public --local > supabase/migrations/${migrationName}`);

  success(`Migration generated: supabase/migrations/${migrationName}`);
}

function applyMigrations() {
  info('Applying migrations locally...');
  execCommand('supabase db reset');
  success('Local migrations applied');
}

function pushToRemote() {
  info('Pushing changes to remote Supabase...');

  // Confirmation prompt
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  This will push changes to PRODUCTION. Continue? (y/N): ', (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'y') {
        execCommand('supabase db push');
        success('Changes pushed to remote');
        resolve();
      } else {
        warning('Push cancelled');
        process.exit(0);
      }
    });
  });
}

function pullFromRemote() {
  info('Pulling schema from remote...');

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const fileName = `supabase/migrations/${timestamp}_remote_schema.sql`;

  execCommand(`supabase db diff --use-migra --schema public --remote > ${fileName}`);
  success(`Remote schema pulled: ${fileName}`);
}

function generateTypes(outputDir = './src/types') {
  info('Generating TypeScript types...');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  execCommand(`supabase gen types typescript --local > ${outputDir}/supabase.ts`);
  success(`Types generated in ${outputDir}/supabase.ts`);
}

function seedDatabase() {
  info('Seeding local database...');

  if (fs.existsSync('scripts/seed-database.sql')) {
    execCommand('supabase db reset < scripts/seed-database.sql');
    success('Database seeded');
  } else {
    warning('Seed file not found');
  }
}

function backupDatabase(fileName = null) {
  const backupName = fileName || `backup_${new Date().toISOString().replace(/[:.]/g, '_')}.sql`;

  info(`Creating backup: ${backupName}`);

  if (CONFIG.remoteDbUrl) {
    execCommand(`pg_dump "${CONFIG.remoteDbUrl}" > ${backupName}`);
    success(`Backup created: ${backupName}`);
  } else {
    error('REMOTE_DB_URL environment variable is required');
  }
}

function restoreDatabase(backupFile) {
  if (!backupFile) {
    error('Backup file path is required');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    error(`Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  info(`Restoring from backup: ${backupFile}`);
  execCommand(`supabase db reset < ${backupFile}`);
  success('Database restored from backup');
}

function showStatus() {
  info('Supabase Status:');
  console.log();

  // Show local status
  try {
    const status = execSync('supabase status', { encoding: 'utf8', stdio: 'pipe' });
    console.log(status);
  } catch {
    warning('Local Supabase not running');
  }

  // Show linked project
  if (fs.existsSync('supabase/.branches/_current_branch')) {
    const branch = fs.readFileSync('supabase/.branches/_current_branch', 'utf8').trim();
    console.log(`\nLinked Project: ${branch}`);
  }
}

function generateBranchName() {
  const branch = process.env.GIT_BRANCH || 'main';
  const sanitized = branch.replace(/[^a-zA-Z0-9-_]/g, '-');
  return sanitized;
}

function createDevBranch() {
  const branchName = generateBranchName();

  info(`Creating development branch: ${branchName}`);
  execCommand(`supabase branches create ${branchName}`);
  success(`Development branch created: ${branchName}`);
}

function syncBranch() {
  const branchName = generateBranchName();

  info(`Syncing branch: ${branchName}`);
  execCommand(`supabase branches switch ${branchName}`);
  success(`Switched to branch: ${branchName}`);
}

// Main CLI
const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'init':
        checkPrerequisites();
        initSupabase();
        break;

      case 'start':
        checkPrerequisites();
        startLocal();
        break;

      case 'stop':
        stopLocal();
        break;

      case 'migrate':
      case 'migration':
        generateMigration(process.argv[3]);
        break;

      case 'apply':
        applyMigrations();
        break;

      case 'push':
        checkPrerequisites();
        await pushToRemote();
        break;

      case 'pull':
        checkPrerequisites();
        pullFromRemote();
        break;

      case 'types':
        generateTypes(process.argv[3]);
        break;

      case 'seed':
        seedDatabase();
        break;

      case 'backup':
        checkPrerequisites();
        backupDatabase(process.argv[3]);
        break;

      case 'restore':
        restoreDatabase(process.argv[3]);
        break;

      case 'status':
        showStatus();
        break;

      case 'branch':
        createDevBranch();
        break;

      case 'sync':
        syncBranch();
        break;

      default:
        console.log(`
Supabase Remote Database Management

Usage: node scripts/supabase-remote-management.js <command> [options]

Commands:
  init                    Initialize Supabase project
  start                   Start local development
  stop                    Stop local development
  migrate [name]          Generate new migration
  apply                   Apply migrations locally
  push                    Push changes to remote (PRODUCTION)
  pull                    Pull schema from remote
  types [dir]             Generate TypeScript types
  seed                    Seed local database
  backup [file]           Backup remote database
  restore <file>          Restore from backup
  status                  Show status
  branch                  Create development branch
  sync                    Sync to development branch

Environment Variables:
  SUPABASE_PROJECT_REF    Your Supabase project reference
  SUPABASE_ACCESS_TOKEN   Your Supabase access token
  REMOTE_DB_URL          Remote database connection string
  LOCAL_DB_URL           Local database connection string
        `);
        break;
    }
  } catch (err) {
    error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();