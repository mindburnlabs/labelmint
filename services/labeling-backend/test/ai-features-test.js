import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Mock admin user for testing AI features
const mockAdminData = {
  user: {
    id: 999999999,
    first_name: 'Admin',
    last_name: 'User',
    username: 'admin',
    role: 'admin',
    language_code: 'en'
  },
  auth_date: Math.floor(Date.now() / 1000),
  hash: 'admin-test-hash'
};

const adminHeaders = {
  'X-Telegram-Init-Data': `user=${encodeURIComponent(JSON.stringify(mockAdminData.user))}&auth_date=${mockAdminData.auth_date}&hash=${mockAdminData.hash}`,
  'Content-Type': 'application/json'
};

async function testAIFeatures() {
  console.log('🤖 Testing AI-Assisted Labeling Features...\n');

  try {
    // Test 1: Check API v3 info with AI features
    console.log('1. Testing API v3 info with AI features...');
    const apiInfoRes = await fetch(`${BASE_URL}/api/v1`);
    const apiInfo = await apiInfoRes.json();
    console.log('✅ API Version:', apiInfo.version);
    console.log('AI Features:', apiInfo.features.filter(f => f.includes('AI')));
    console.log('');

    // Test 2: Create a test task for AI prelabeling
    console.log('2. Creating test task for AI prelabeling...');
    const createTaskRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'AI Test: Sentiment Analysis',
        type: 'sentiment_analysis',
        description: 'Classify the sentiment of the given text',
        data: {
          text: 'I absolutely love this new phone! The camera is amazing and the battery lasts forever.'
        },
        options: ['positive', 'negative', 'neutral'],
        points: 1
      })
    });
    console.log('Status:', createTaskRes.status);
    const createdTask = await createTaskRes.json();
    console.log('Task created:', createdTask.success ? 'Success' : 'Failed');
    console.log('');

    // Test 3: Prelabel task with AI (if task was created)
    if (createdTask.success && createdTask.task?.id) {
      const taskId = createdTask.task.id;
      console.log('3. Testing AI prelabeling...');
      const prelabelRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/prelabel`, {
        method: 'POST',
        headers: adminHeaders
      });
      console.log('Status:', prelabelRes.status);
      const prelabelData = await prelabelRes.json();
      console.log('AI Prelabel Result:', {
        success: prelabelData.success,
        prelabel: prelabelData.prelabel,
        confidence: prelabelData.confidence,
        reasoning: prelabelData.reasoning?.substring(0, 100) + '...'
      });
      console.log('');

      // Test 4: Get AI-assisted consensus info
      console.log('4. Testing AI consensus tracking...');
      const consensusRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/consensus`, {
        headers: adminHeaders
      });
      console.log('Status:', consensusRes.status);
      const consensusData = await consensusRes.json();
      console.log('Consensus Info:', consensusData.consensus);
      console.log('');

      // Test 5: Generate examples for task type
      console.log('5. Testing AI example generation...');
      const examplesRes = await fetch(`${BASE_URL}/api/tasks/generate-examples`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          task_type: 'sentiment_analysis',
          categories: ['positive', 'negative', 'neutral'],
          instructions: 'Determine the emotional tone of the text',
          count: 2
        })
      });
      console.log('Status:', examplesRes.status);
      const examplesData = await examplesRes.json();
      console.log('Examples Generated:', examplesData.success ? 'Success' : 'Failed');
      if (examplesData.success) {
        console.log('Number of example categories:', examplesData.examples?.length || 0);
      }
      console.log('');

      // Test 6: Validate a hypothetical label
      console.log('6. Testing AI label validation...');
      const validateRes = await fetch(`${BASE_URL}/api/tasks/validate`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          response_id: 1, // Mock ID
          task_id: taskId,
          worker_label: 'positive'
        })
      });
      console.log('Status:', validateRes.status);
      const validateData = await validateRes.json();
      console.log('Validation Result:', {
        isValid: validateData.validation?.isValid,
        confidence: validateData.validation?.confidence,
        suspicious: validateData.validation?.suspicious
      });
      console.log('');
    }

    // Test 7: Get AI statistics
    console.log('7. Testing AI statistics...');
    const statsRes = await fetch(`${BASE_URL}/api/ai/stats`, {
      headers: adminHeaders
    });
    console.log('Status:', statsRes.status);
    const statsData = await statsRes.json();
    console.log('AI Statistics:', {
      totalTasks: statsData.statistics?.tasks?.total_tasks || 0,
      aiPrelabeled: statsData.statistics?.tasks?.ai_prelabeled || 0,
      avgConfidence: statsData.statistics?.tasks?.avg_ai_confidence?.toFixed(3) || 'N/A',
      reducedConsensus: statsData.statistics?.tasks?.reduced_consensus || 0
    });
    console.log('');

    // Test 8: Test pattern analysis
    console.log('8. Testing suspicious pattern analysis...');
    const patternRes = await fetch(`${BASE_URL}/api/ai/analyze-patterns`, {
      method: 'POST',
      headers: adminHeaders
    });
    console.log('Status:', patternRes.status);
    const patternData = await patternRes.json();
    console.log('Pattern Analysis:', {
      suspiciousWorkers: patternData.suspicious_workers?.length || 0,
      analyzedAt: patternData.analyzed_at
    });
    console.log('');

    // Test 9: Test batch prelabeling
    console.log('9. Testing batch AI prelabeling...');
    const batchRes = await fetch(`${BASE_URL}/api/tasks/batch-prelabel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        task_ids: [1, 2, 3] // Mock task IDs
      })
    });
    console.log('Status:', batchRes.status);
    const batchData = await batchRes.json();
    console.log('Batch Prelabeling:', {
      processed: batchData.processed || 0,
      successful: batchData.successful || 0,
      failed: batchData.failed || 0
    });
    console.log('');

    console.log('✅ AI features testing complete!');
    console.log('\n🚀 AI Features Demonstrated:');
    console.log('   • AI prelabeling of text tasks');
    console.log('   • Confidence-based consensus reduction (3→2 workers)');
    console.log('   • AI validation of worker labels');
    console.log('   • Suspicious pattern detection');
    console.log('   • Automated example generation');
    console.log('   • Batch AI processing');
    console.log('   • Comprehensive AI statistics');
    console.log('\n💡 Cost Savings:');
    console.log('   • 33% reduction in human labels needed (2 vs 3)');
    console.log('   • Faster task completion');
    console.log('   • Automated quality assurance');
    console.log('   • Reduced need for manual review');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests if server is running
async function checkServerAndTest() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      await testAIFeatures();
    } else {
      console.log('❌ Server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:3001');
    console.log('Run: npm run dev');
    console.log('\n⚠️ Note: AI features require ANTHROPIC_API_KEY in your .env file');
  }
}

checkServerAndTest();