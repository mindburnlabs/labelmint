#!/usr/bin/env node

/**
 * AI Orchestrator Agent for LabelMint
 *
 * This agent analyzes the codebase, identifies all remaining tasks,
 * and coordinates multiple specialized AI agents to work simultaneously
 * on different parts of the system.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AIOrchestrator {
  constructor() {
    this.projectRoot = process.cwd();
    this.tasks = [];
    this.agents = [];
    this.dependencies = new Map();
    this.completedTasks = new Set();
  }

  /**
   * Analyze the entire codebase and identify tasks
   */
  async analyzeCodebase() {
    console.log('🔍 Analyzing LabelMint codebase...\n');

    // Define analysis patterns for different task types
    const analysisPatterns = {
      // Critical issues
      critical: [
        {
          pattern: /TODO|FIXME|HACK|XXX/gi,
          description: 'Critical TODOs and FIXMEs',
          priority: 'critical'
        },
        {
          pattern: /throw new Error\("Not implemented"\)|console\.log\("TODO"|\/\/ TODO/gi,
          description: 'Unimplemented functions',
          priority: 'critical'
        },
        {
          pattern: /\.skip\(|\.only\(/gi,
          description: 'Skipped or exclusive tests',
          priority: 'critical'
        }
      ],

      // Security issues
      security: [
        {
          pattern: /process\.env\.\w+.*auth|password|secret/gi,
          description: 'Potential security exposures',
          priority: 'high'
        },
        {
          pattern: /cors\(\{\s*origin:\s*['"`]\*['"`]/gi,
          description: 'Permissive CORS policies',
          priority: 'high'
        },
        {
          pattern: /\/\/.*auth.*disabled|\/\/.*no.*auth/gi,
          description: 'Disabled authentication',
          priority: 'critical'
        }
      ],

      // Performance issues
      performance: [
        {
          pattern: /SELECT \*|findMany\(\)\s*$/gi,
          description: 'Potential performance issues',
          priority: 'medium'
        },
        {
          pattern: /setInterval|setTimeout.*[^,]$/gi,
          description: 'Unbounded timers or intervals',
          priority: 'medium'
        }
      ],

      // Testing issues
      testing: [
        {
          pattern: /it\('.*todo|test\('.*todo|describe\('.*todo|\.skip\(|\.only\(/gi,
          description: 'Incomplete tests',
          priority: 'high'
        },
        {
          pattern: /expect\(.*\)\.toBe\(undefined\)|expect\(.*\)\.toBeFalsy\(\)/gi,
          description: 'Weak assertions',
          priority: 'medium'
        }
      ],

      // Documentation issues
      documentation: [
        {
          pattern: /\/\*\*[\s\S]*?\*\//gi,
          description: 'Missing JSDoc comments',
          priority: 'low'
        },
        {
          pattern: /@param.*undefined|@returns.*undefined/gi,
          description: 'Incomplete documentation',
          priority: 'low'
        }
      ]
    };

    // Perform analysis
    const results = await this.scanProject(analysisPatterns);
    this.processResults(results);

    return this.generateAgentPrompts();
  }

  /**
   * Scan project files for patterns
   */
  async scanProject(patterns) {
    const results = {
      critical: [],
      security: [],
      performance: [],
      testing: [],
      documentation: [],
      features: []
    };

    // Key directories to scan
    const directories = [
      'apps',
      'services',
      'packages',
      'contracts',
      'infrastructure',
      'supabase'
    ];

    for (const dir of directories) {
      await this.scanDirectory(dir, patterns, results);
    }

    // Check for missing features based on project structure
    await this.identifyMissingFeatures(results);

    return results;
  }

  /**
   * Scan a directory recursively
   */
  async scanDirectory(dir, patterns, results, depth = 0) {
    if (depth > 5) return; // Prevent infinite recursion

    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        await this.scanDirectory(fullPath, patterns, results, depth + 1);
      } else if (stat.isFile() && this.shouldScanFile(item)) {
        await this.scanFile(fullPath, patterns, results);
      }
    }
  }

  /**
   * Check if file should be scanned
   */
  shouldScanFile(filename) {
    const scanExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml'];
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    return scanExtensions.some(ext => filename.endsWith(ext)) &&
           !ignorePatterns.some(pattern => filename.includes(pattern));
  }

  /**
   * Scan a single file for patterns
   */
  async scanFile(filePath, patterns, results) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Scan for each pattern category
      for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
          const matches = content.match(pattern.pattern);
          if (matches) {
            // Find line numbers for matches
            matches.forEach(match => {
              const lineNumber = lines.findIndex(line => line.includes(match)) + 1;
              results[category].push({
                file: filePath,
                line: lineNumber,
                match: match.trim(),
                description: pattern.description,
                priority: pattern.priority,
                context: this.getContext(lines, lineNumber - 1)
              });
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan file ${filePath}:`, error.message);
    }
  }

  /**
   * Get context around a line
   */
  getContext(lines, lineNumber, contextSize = 3) {
    const start = Math.max(0, lineNumber - contextSize);
    const end = Math.min(lines.length, lineNumber + contextSize + 1);
    return lines.slice(start, end).map((line, i) => ({
      line: start + i + 1,
      content: line
    }));
  }

  /**
   * Identify missing features based on project structure
   */
  async identifyMissingFeatures(results) {
    const fs = await import('fs');

    // Check for missing configurations
    const requiredFiles = [
      { path: '.env.example', feature: 'Environment configuration' },
      { path: 'docker-compose.prod.yml', feature: 'Production Docker setup' },
      { path: 'infrastructure/monitoring/prometheus.yml', feature: 'Prometheus monitoring' },
      { path: 'docs/API.md', feature: 'API documentation' }
    ];

    requiredFiles.forEach(({ path, feature }) => {
      if (!fs.existsSync(path)) {
        results.features.push({
          type: 'missing_file',
          file: path,
          feature: feature,
          priority: 'high',
          description: `Missing ${feature}`
        });
      }
    });

    // Check for incomplete implementations
    const services = ['labeling-backend', 'payment-backend', 'enterprise-api'];
    services.forEach(service => {
      const servicePath = `services/${service}`;
      if (fs.existsSync(servicePath)) {
        const testPath = `${servicePath}/test`;
        if (!fs.existsSync(testPath)) {
          results.testing.push({
            file: servicePath,
            feature: `Test suite for ${service}`,
            priority: 'high',
            description: `Missing test coverage for ${service}`
          });
        }
      }
    });
  }

  /**
   * Process analysis results and organize into tasks
   */
  processResults(results) {
    // Process all results into tasks
    Object.entries(results).forEach(([category, items]) => {
      items.forEach(item => {
        this.tasks.push({
          id: this.generateTaskId(),
          category,
          ...item,
          estimatedTime: this.estimateTime(item),
          complexity: this.assessComplexity(item)
        });
      });
    });

    // Analyze dependencies
    this.analyzeDependencies();

    // Sort by priority
    this.tasks.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Analyze task dependencies
   */
  analyzeDependencies() {
    // Define common dependencies
    const dependencyRules = {
      'TON blockchain integration': ['Test suite fixes'],
      'Admin authentication': ['Security review'],
      'Payment processing': ['TON blockchain integration'],
      'Production deployment': ['All features complete', 'Security audit']
    };

    // Apply dependency rules
    this.tasks.forEach(task => {
      const dependencies = [];
      Object.entries(dependencyRules).forEach(([key, deps]) => {
        if (task.match?.toLowerCase().includes(key.toLowerCase()) ||
            task.feature?.toLowerCase().includes(key.toLowerCase())) {
          deps.forEach(dep => {
            const depTask = this.tasks.find(t =>
              t.match?.toLowerCase().includes(dep.toLowerCase()) ||
              t.feature?.toLowerCase().includes(dep.toLowerCase())
            );
            if (depTask) {
              dependencies.push(depTask.id);
            }
          });
        }
      });

      if (dependencies.length > 0) {
        this.dependencies.set(task.id, dependencies);
      }
    });
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate time for task
   */
  estimateTime(task) {
    const baseTimes = {
      critical: '2-4 hours',
      high: '1-3 hours',
      medium: '30 minutes - 2 hours',
      low: '15-30 minutes'
    };

    const complexityMultiplier = {
      simple: 1,
      moderate: 1.5,
      complex: 2.5
    };

    const base = baseTimes[task.priority] || baseTimes.medium;
    const multiplier = complexityMultiplier[task.complexity] || 1;

    return base;
  }

  /**
   * Assess task complexity
   */
  assessComplexity(task) {
    // Simple heuristics for complexity
    if (task.match?.includes('TODO') || task.match?.includes('FIXME')) {
      return 'simple';
    }
    if (task.file?.includes('backend') || task.file?.includes('service')) {
      return 'moderate';
    }
    if (task.file?.includes('infrastructure') || task.file?.includes('contracts')) {
      return 'complex';
    }
    return 'moderate';
  }

  /**
   * Generate prompts for specialized agents
   */
  generateAgentPrompts() {
    const agents = [
      {
        name: 'Blockchain Developer',
        expertise: ['TON', 'smart contracts', 'payments', 'wallet integration'],
        tasks: this.tasks.filter(t =>
          t.file?.includes('ton') ||
          t.file?.includes('payment') ||
          t.file?.includes('contracts') ||
          t.match?.includes('TON') ||
          t.match?.includes('blockchain')
        ),
        capabilities: ['Solidity/Tact', 'Cryptography', 'Web3', 'DeFi']
      },

      {
        name: 'Backend Developer',
        expertise: ['API development', 'databases', 'authentication', 'microservices'],
        tasks: this.tasks.filter(t =>
          t.file?.includes('backend') ||
          t.file?.includes('service') ||
          t.category === 'security' ||
          t.category === 'performance'
        ),
        capabilities: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker']
      },

      {
        name: 'Frontend Developer',
        expertise: ['React', 'TypeScript', 'UI/UX', 'mobile optimization'],
        tasks: this.tasks.filter(t =>
          t.file?.includes('apps') ||
          t.file?.includes('ui') ||
          t.file?.includes('components')
        ),
        capabilities: ['React', 'Next.js', 'Tailwind CSS', 'Web3 Integration']
      },

      {
        name: 'DevOps Engineer',
        expertise: ['infrastructure', 'deployment', 'monitoring', 'security'],
        tasks: this.tasks.filter(t =>
          t.file?.includes('infrastructure') ||
          t.file?.includes('docker') ||
          t.file?.includes('k8s') ||
          t.category === 'testing'
        ),
        capabilities: ['Kubernetes', 'Docker', 'CI/CD', 'Monitoring', 'AWS/GCP']
      },

      {
        name: 'Testing Engineer',
        expertise: ['unit tests', 'integration tests', 'E2E testing', 'performance testing'],
        tasks: this.tasks.filter(t =>
          t.category === 'testing' ||
          t.file?.includes('test') ||
          t.match?.includes('skip') ||
          t.match?.includes('TODO')
        ),
        capabilities: ['Jest', 'Playwright', 'K6', 'Cypress', 'Testing Library']
      },

      {
        name: 'Enterprise Integrations Specialist',
        expertise: ['SSO', 'enterprise features', 'API integrations', 'compliance'],
        tasks: this.tasks.filter(t =>
          t.file?.includes('enterprise') ||
          t.match?.includes('SSO') ||
          t.match?.includes('email') ||
          t.match?.includes('organization')
        ),
        capabilities: ['SAML', 'OIDC', 'OAuth2', 'LDAP', 'Enterprise Security']
      }
    ];

    // Generate detailed prompts for each agent
    return agents.map(agent => ({
      ...agent,
      prompt: this.generateAgentPrompt(agent),
      canStart: this.canAgentStart(agent),
      estimatedDuration: this.calculateAgentDuration(agent.tasks)
    }));
  }

  /**
   * Generate detailed prompt for an agent
   */
  generateAgentPrompt(agent) {
    const prompt = `# ${agent.name} - LabelMint Project Tasks

You are a ${agent.name.toLowerCase()} specialist working on the LabelMint decentralized data labeling platform.

## YOUR EXPERTISE
${agent.expertise.map(e => `- ${e}`).join('\n')}
${agent.capabilities.map(c => `- ${c}`).join('\n')}

## YOUR ASSIGNED TASKS (${agent.tasks.length})

### CRITICAL TASKS (Do These First)
${agent.tasks.filter(t => t.priority === 'critical').map(task => this.formatTask(task)).join('\n\n')}

### HIGH PRIORITY TASKS
${agent.tasks.filter(t => t.priority === 'high').map(task => this.formatTask(task)).join('\n\n')}

### MEDIUM PRIORITY TASKS
${agent.tasks.filter(t => t.priority === 'medium').map(task => this.formatTask(task)).join('\n\n')}

### LOW PRIORITY TASKS
${agent.tasks.filter(t => t.priority === 'low').map(task => this.formatTask(task)).join('\n\n')}

## WORKING GUIDELINES

1. **START with critical tasks** - These block other agents from completing their work
2. **Follow existing patterns** - Maintain consistency with the current codebase
3. **Add tests** - Write comprehensive tests for any new functionality
4. **Document changes** - Update relevant documentation
5. **Handle errors gracefully** - Include proper error handling and logging
6. **Consider security** - Follow security best practices for all changes
7. **Communicate blockers** - If you encounter dependencies on other agents, note them clearly

## DELIVERABLES

For each task:
- [ ] Complete the implementation
- [ ] Add or update tests
- [ ] Update documentation if needed
- [ ] Verify the functionality works end-to-end

## ESTIMATED WORKLOAD
- Total tasks: ${agent.tasks.length}
- Estimated duration: ${this.calculateAgentDuration(agent.tasks)}
- Can start immediately: ${this.canAgentStart(agent) ? 'Yes' : 'No'}

## COORDINATION NOTES
${this.generateCoordinationNotes(agent)}

Begin with the highest priority task that has no unmet dependencies. Mark each task as complete as you finish it.

---

*Generated by LabelMint AI Orchestrator*
`;

    return prompt;
  }

  /**
   * Format a task for display
   */
  formatTask(task) {
    let formatted = `**Task:** ${task.feature || task.description || task.match}\n`;
    formatted += `**Location:** ${task.file}${task.line ? `:${task.line}` : ''}\n`;
    formatted += `**Priority:** ${task.priority.toUpperCase()}\n`;
    formatted += `**Estimated Time:** ${task.estimatedTime}\n`;
    formatted += `**Complexity:** ${task.complexity}\n`;

    if (task.context && task.context.length > 0) {
      formatted += `**Context:**\n\`\`\`\n`;
      task.context.slice(-3).forEach(ctx => {
        formatted += `${ctx.line}: ${ctx.content}\n`;
      });
      formatted += `\`\`\`\n`;
    }

    return formatted;
  }

  /**
   * Check if agent can start based on dependencies
   */
  canAgentStart(agent) {
    // Check if agent has tasks without dependencies
    const tasksWithoutDeps = agent.tasks.filter(task => {
      const deps = this.dependencies.get(task.id);
      return !deps || deps.length === 0;
    });

    return tasksWithoutDeps.length > 0;
  }

  /**
   * Calculate total duration for agent's tasks
   */
  calculateAgentDuration(tasks) {
    if (tasks.length === 0) return 'No tasks';

    const totalHours = tasks.reduce((total, task) => {
      const time = task.estimatedTime;
      const match = time.match(/(\d+)/);
      const hours = match ? parseInt(match[1]) : 2;
      return total + hours;
    }, 0);

    if (totalHours < 8) return `${totalHours} hours`;
    if (totalHours < 40) return `${Math.round(totalHours / 8)} days`;
    return `${Math.round(totalHours / 40)} weeks`;
  }

  /**
   * Generate coordination notes for agent
   */
  generateCoordinationNotes(agent) {
    const notes = [];

    // Check for cross-agent dependencies
    agent.tasks.forEach(task => {
      const deps = this.dependencies.get(task.id);
      if (deps && deps.length > 0) {
        notes.push(`- Task "${task.feature || task.description}" depends on: ${deps.join(', ')}`);
      }
    });

    if (notes.length === 0) {
      notes.push('- No cross-agent dependencies detected. You can work independently.');
    }

    return notes.join('\n');
  }

  /**
   * Save prompts to files
   */
  async savePrompts() {
    const prompts = await this.analyzeCodebase();

    // Create directory for prompts
    const promptsDir = join(this.projectRoot, '.ai-agents');
    if (!existsSync(promptsDir)) {
      await import('fs').then(fs => fs.mkdirSync(promptsDir, { recursive: true }));
    }

    // Save each agent prompt
    prompts.forEach(agent => {
      const filename = agent.name.toLowerCase().replace(/\s+/g, '-') + '-prompt.md';
      const filepath = join(promptsDir, filename);
      writeFileSync(filepath, agent.prompt);
      console.log(`✅ Saved prompt for ${agent.name}: ${filename}`);
    });

    // Save summary
    const summary = this.generateSummary(prompts);
    writeFileSync(join(promptsDir, 'README.md'), summary);
    console.log(`✅ Saved summary: .ai-agents/README.md`);

    return prompts;
  }

  /**
   * Generate summary of all tasks
   */
  generateSummary(prompts) {
    let summary = `# LabelMint AI Orchestrator - Task Summary\n\n`;
    summary += `Generated: ${new Date().toISOString()}\n\n`;

    summary += `## Overview\n`;
    summary += `- Total tasks identified: ${this.tasks.length}\n`;
    summary += `- Critical tasks: ${this.tasks.filter(t => t.priority === 'critical').length}\n`;
    summary += `- High priority tasks: ${this.tasks.filter(t => t.priority === 'high').length}\n`;
    summary += `- Medium priority tasks: ${this.tasks.filter(t => t.priority === 'medium').length}\n`;
    summary += `- Low priority tasks: ${this.tasks.filter(t => t.priority === 'low').length}\n\n`;

    summary += `## Agents & Workload\n\n`;
    prompts.forEach(agent => {
      summary += `### ${agent.name}\n`;
      summary += `- Tasks: ${agent.tasks.length}\n`;
      summary += `- Estimated duration: ${agent.estimatedDuration}\n`;
      summary += `- Can start: ${agent.canStart ? '✅' : '⏳'}\n`;
      summary += `- Prompt: [${agent.name.toLowerCase().replace(/\s+/g, '-')}-prompt.md](${agent.name.toLowerCase().replace(/\s+/g, '-')}-prompt.md)\n\n`;
    });

    summary += `## Priority Actions\n\n`;
    summary += `1. **Start with critical tasks** - These block other progress\n`;
    summary += `2. **Blockchain Developer** should begin immediately if they have critical tasks\n`;
    summary += `3. **Backend Developer** has security and performance tasks that affect everyone\n`;
    summary += `4. **Testing Engineer** should fix test infrastructure to enable CI/CD\n\n`;

    summary += `## Execution Strategy\n\n`;
    summary += `Agents can work in parallel on tasks without dependencies. Coordinate on:\n`;
    summary += `- Shared interfaces and types\n`;
    summary += `- Database schema changes\n`;
    summary += `- API contract updates\n`;
    summary += `- Environment configuration\n\n`;

    summary += `---\n`;
    summary += `*This orchestration enables parallel development while managing dependencies effectively.*\n`;

    return summary;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new AIOrchestrator();
  orchestrator.savePrompts()
    .then(() => {
      console.log('\n🎉 AI Orchestration complete!');
      console.log('\nNext steps:');
      console.log('1. Each agent should read their prompt file');
      console.log('2. Start with critical/high priority tasks');
      console.log('3. Mark completed tasks in the shared tracking');
      console.log('4. Communicate blockers and dependencies');
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default AIOrchestrator;