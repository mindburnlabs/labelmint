#!/usr/bin/env node

import AIOrchestrator from './orchestrator-agent.js';

console.log('🤖 LabelMint AI Orchestrator Starting...\n');

const orchestrator = new AIOrchestrator();

// Run the analysis and generate prompts
orchestrator.savePrompts()
  .then((prompts) => {
    console.log('\n✨ AI Orchestrator Analysis Complete!\n');

    console.log('📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    prompts.forEach(agent => {
      const status = agent.canStart ? '🟢 Ready' : '🟡 Waiting';
      console.log(`${status} ${agent.name}: ${agent.tasks.length} tasks (${agent.estimatedDuration})`);
    });

    console.log('\n🚀 Next Actions:');
    console.log('1. Check .ai-agents/ directory for detailed prompts');
    console.log('2. Each agent reads their specific prompt file');
    console.log('3. Agents can work simultaneously on independent tasks');
    console.log('4. Track progress and manage dependencies');

    console.log('\n💡 Tip: Agents with critical tasks should start first!');

  })
  .catch(error => {
    console.error('❌ Orchestrator failed:', error.message);
    process.exit(1);
  });