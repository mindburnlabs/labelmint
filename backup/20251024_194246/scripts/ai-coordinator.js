#!/usr/bin/env node

/**
 * AI Coordinator Agent - Generates Focused Prompts for Parallel Development
 *
 * This is a specialized version that creates concise, actionable prompts
 * for different AI agents to work simultaneously on LabelMint.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

class AICoordinator {
  constructor() {
    this.projectRoot = process.cwd();
    this.tasks = new Map();
    this.agentPrompts = new Map();
  }

  async coordinate() {
    console.log('🎯 AI Coordinator: Generating Focused Development Tasks\n');

    // Analyze specific high-impact areas
    await this.analyzeCriticalAreas();

    // Generate focused prompts for each agent
    await this.generateFocusedPrompts();

    // Save coordination plan
    await this.saveCoordinationPlan();

    console.log('\n✅ Coordination complete! Check .ai-coordination/ directory\n');
  }

  async analyzeCriticalAreas() {
    const criticalAreas = [
      {
        name: 'TON Payment Integration',
        files: [
          'services/labeling-backend/src/services/tonPaymentService.ts',
          'services/payment-backend/src/services/tonWalletService.ts',
          'contracts/PaymentProcessor.tact'
        ],
        agent: 'Blockchain Developer',
        priority: 'CRITICAL',
        context: 'Core payment functionality is incomplete'
      },
      {
        name: 'Test Suite Recovery',
        files: [
          'services/*/test/**/*.test.ts',
          'apps/*/test/**/*.test.ts',
          'vitest.config.ts'
        ],
        agent: 'Testing Engineer',
        priority: 'CRITICAL',
        context: '104/227 tests failing, blocking deployment'
      },
      {
        name: 'Admin Security',
        files: [
          'services/payment-backend/src/api/admin/index.ts',
          'services/payment-backend/src/middleware/auth.ts'
        ],
        agent: 'Backend Developer',
        priority: 'CRITICAL',
        context: 'Admin authentication is commented out'
      },
      {
        name: 'Error Monitoring',
        files: [
          'packages/ui/src/components/ErrorBoundary.tsx',
          'apps/web/src/app/error.tsx',
          'apps/telegram-mini-app/src/components/ErrorBoundary.tsx'
        ],
        agent: 'Frontend Developer',
        priority: 'HIGH',
        context: 'No error tracking service integrated'
      },
      {
        name: 'SSO Implementation',
        files: [
          'services/enterprise-api/src/services/SSOService.ts',
          'services/enterprise-api/src/config/sso.ts'
        ],
        agent: 'Enterprise Specialist',
        priority: 'HIGH',
        context: 'SAML/OIDC providers not configured'
      },
      {
        name: 'Production Monitoring',
        files: [
          'infrastructure/monitoring/prometheus.yml',
          'infrastructure/monitoring/grafana/dashboards/',
          'docker-compose.prod.yml'
        ],
        agent: 'DevOps Engineer',
        priority: 'HIGH',
        context: 'Monitoring infrastructure incomplete'
      }
    ];

    for (const area of criticalAreas) {
      const issues = await this.analyzeArea(area);
      this.tasks.set(area.name, {
        ...area,
        issues
      });
    }
  }

  async analyzeArea(area) {
    const issues = [];

    for (const file of area.files) {
      if (existsSync(file)) {
        const stats = await import('fs').then(fs => fs.statSync(file));
        if (stats.isDirectory()) {
          // Skip directories, find files instead
          continue;
        }
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');

        // Look for specific patterns
        lines.forEach((line, index) => {
          if (line.includes('TODO') || line.includes('FIXME')) {
            issues.push({
              file,
              line: index + 1,
              type: 'TODO',
              content: line.trim()
            });
          }

          if (line.includes('throw new Error') || line.includes('Not implemented')) {
            issues.push({
              file,
              line: index + 1,
              type: 'UNIMPLEMENTED',
              content: line.trim()
            });
          }

          if (line.includes('console.log') || line.includes('debugger')) {
            issues.push({
              file,
              line: index + 1,
              type: 'DEBUG',
              content: line.trim()
            });
          }

          if (line.includes('//') && (line.includes('disabled') || line.includes('skip'))) {
            issues.push({
              file,
              line: index + 1,
              type: 'DISABLED',
              content: line.trim()
            });
          }
        });
      } else {
        issues.push({
          file,
          line: 0,
          type: 'MISSING',
          content: 'File does not exist'
        });
      }
    }

    return issues;
  }

  async generateFocusedPrompts() {
    const agents = [
      {
        name: 'Blockchain Developer',
        icon: '⛓️',
        focus: 'TON payments and smart contracts',
        color: 'blue'
      },
      {
        name: 'Backend Developer',
        icon: '🔧',
        focus: 'APIs, auth, and security',
        color: 'green'
      },
      {
        name: 'Frontend Developer',
        icon: '🎨',
        focus: 'UI/UX and error handling',
        color: 'purple'
      },
      {
        name: 'Testing Engineer',
        icon: '🧪',
        focus: 'Test suite recovery and coverage',
        color: 'red'
      },
      {
        name: 'Enterprise Specialist',
        icon: '🏢',
        focus: 'SSO and enterprise features',
        color: 'orange'
      },
      {
        name: 'DevOps Engineer',
        icon: '☁️',
        focus: 'Infrastructure and monitoring',
        color: 'cyan'
      }
    ];

    for (const agent of agents) {
      const prompt = this.generatePrompt(agent);
      this.agentPrompts.set(agent.name, prompt);
    }
  }

  generatePrompt(agent) {
    // Get tasks for this agent
    const agentTasks = Array.from(this.tasks.values())
      .filter(task => task.agent === agent.name);

    const criticalTasks = agentTasks.filter(t => t.priority === 'CRITICAL');
    const highTasks = agentTasks.filter(t => t.priority === 'HIGH');

    let prompt = `# ${agent.icon} ${agent.name} - LabelMint Sprint Tasks\n\n`;
    prompt += `**Focus Area:** ${agent.focus}\n`;
    prompt += `**Generated:** ${new Date().toISOString()}\n\n`;

    if (criticalTasks.length > 0) {
      prompt += `## 🚨 CRITICAL TASKS (Blockers)\n\n`;
      criticalTasks.forEach(task => {
        prompt += this.formatTask(task);
      });
    }

    if (highTasks.length > 0) {
      prompt += `## ⚡ HIGH PRIORITY\n\n`;
      highTasks.forEach(task => {
        prompt += this.formatTask(task);
      });
    }

    prompt += `## 🎯 Your Mission\n\n`;
    prompt += `1. **CRITICAL tasks first** - These block other agents\n`;
    prompt += `2. **Test your changes** - Ensure tests pass\n`;
    prompt += `3. **Document** - Update relevant docs\n`;
    prompt += `4. **Communicate** - Note any blockers\n\n`;

    prompt += `## 📋 Success Criteria\n\n`;
    prompt += `- [ ] All critical issues resolved\n`;
    prompt += `- [ ] Tests passing locally\n`;
    prompt += `- [ ] Code reviewed and committed\n`;
    prompt += `- [ ] Documentation updated\n\n`;

    prompt += `## 🔗 Dependencies\n\n`;
    prompt += `Check with other agents if you need:\n`;
    prompt += `- Database schema changes (talk to Backend)\n`;
    prompt += `- API contract changes (talk to Backend/Frontend)\n`;
    prompt += `- Environment variables (talk to DevOps)\n\n`;

    prompt += `---\n`;
    prompt += `*Work efficiently. Ask for help when stuck. You got this!*\n`;

    return prompt;
  }

  formatTask(task) {
    let formatted = `### ${task.name}\n\n`;
    formatted += `**Priority:** ${task.priority}  \n`;
    formatted += `**Context:** ${task.context}  \n\n`;

    if (task.issues && task.issues.length > 0) {
      formatted += `**Issues to fix:**\n\n`;
      task.issues.forEach(issue => {
        const icon = this.getIssueIcon(issue.type);
        formatted += `${icon} \`${issue.file}:${issue.line}\` - ${issue.content}\n`;
      });
      formatted += '\n';
    }

    if (task.files && task.files.length > 0) {
      formatted += `**Files to work on:**\n`;
      task.files.forEach(file => {
        formatted += `- \`${file}\`\n`;
      });
      formatted += '\n';
    }

    return formatted;
  }

  getIssueIcon(type) {
    const icons = {
      'TODO': '📝',
      'UNIMPLEMENTED': '⚠️',
      'DEBUG': '🐛',
      'DISABLED': '🔌',
      'MISSING': '❌'
    };
    return icons[type] || '•';
  }

  async saveCoordinationPlan() {
    const dir = join(this.projectRoot, '.ai-coordination');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Save each agent's prompt
    for (const [agentName, prompt] of this.agentPrompts) {
      const filename = agentName.toLowerCase().replace(/\s+/g, '-') + '.md';
      const filepath = join(dir, filename);
      writeFileSync(filepath, prompt);
      console.log(`✅ Saved: ${filename}`);
    }

    // Save coordination overview
    const overview = this.generateOverview();
    writeFileSync(join(dir, 'COORDINATION.md'), overview);
    console.log(`✅ Saved: COORDINATION.md`);

    // Save execution plan
    const execution = this.generateExecutionPlan();
    writeFileSync(join(dir, 'EXECUTION.md'), execution);
    console.log(`✅ Saved: EXECUTION.md`);
  }

  generateOverview() {
    let overview = `# LabelMint AI Coordination Overview\n\n`;
    overview += `**Sprint Goal:** Complete critical blockers for MVP deployment\n`;
    overview += `**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;

    overview += `## 🚨 Critical Issues Summary\n\n`;
    const criticalCount = Array.from(this.tasks.values())
      .filter(t => t.priority === 'CRITICAL').length;
    overview += `- ${criticalCount} critical blockers need immediate attention\n`;
    overview += `- ${this.tasks.size} total areas identified\n\n`;

    overview += `## 👥 Agent Allocation\n\n`;
    for (const [taskName, task] of this.tasks) {
      const icon = task.priority === 'CRITICAL' ? '🚨' : '⚡';
      overview += `${icon} **${task.agent}**: ${taskName}\n`;
    }

    overview += `\n## 📊 Progress Tracking\n\n`;
    overview += `Use the following to track progress:\n`;
    overview |= `- Mark tasks as complete in EXECUTION.md\n`;
    overview += `- Update PR status in coordination channel\n`;
    overview += `- Report blockers immediately\n\n`;

    overview += `## 🎯 Success Metrics\n\n`;
    overview += `- All critical tasks complete\n`;
    overview += `- Test suite passing (>90%)\n`;
    overview += `- Zero security vulnerabilities\n`;
    overview += `- Ready for staging deployment\n\n`;

    return overview;
  }

  generateExecutionPlan() {
    let plan = `# LabelMint Execution Plan\n\n`;
    plan += `**Parallel Execution Strategy**\n\n`;

    plan += `## Phase 1: Immediate (Day 1)\n\n`;
    plan += `These can start immediately:\n\n`;

    const immediateTasks = Array.from(this.tasks.values())
      .filter(t => t.priority === 'CRITICAL');

    immediateTasks.forEach((task, index) => {
      plan += `${index + 1}. **${task.agent}** - ${task.name}\n`;
      plan += `   - Estimated: 4-6 hours\n`;
      plan += `   - Dependencies: None\n\n`;
    });

    plan += `## Phase 2: Day 2-3\n\n`;
    plan += `Start after Phase 1 complete:\n\n`;

    const phase2Tasks = Array.from(this.tasks.values())
      .filter(t => t.priority === 'HIGH');

    phase2Tasks.forEach((task, index) => {
      plan += `${index + 1}. **${task.agent}** - ${task.name}\n`;
      plan += `   - Estimated: 6-8 hours\n`;
      plan += `   - Dependencies: Phase 1 tasks\n\n`;
    });

    plan += `## Coordination Checklist\n\n`;
    plan += `- [ ] Daily standup check-ins\n`;
    plan += `- [ ] Code review assignments\n`;
    plan += `- [ ] Integration testing\n`;
    plan += `- [ ] Staging deployment\n`;
    plan += `- [ ] Production readiness review\n\n`;

    plan += `## Communication Protocol\n\n`;
    plan += `1. **Start**: Announce which task you're starting\n`;
    plan += `2. **Blockers**: Immediately report if blocked\n`;
    plan += `3. **Complete**: Mark complete in this file\n`;
    plan += `4. **PR**: Create PR and request review\n\n`;

    plan += `---\n`;
    plan += `*Let's build something amazing! 🚀*\n`;

    return plan;
  }
}

// Run coordinator
if (import.meta.url === `file://${process.argv[1]}`) {
  const coordinator = new AICoordinator();
  coordinator.coordinate()
    .catch(error => {
      console.error('❌ Coordination failed:', error);
      process.exit(1);
    });
}

export default AICoordinator;