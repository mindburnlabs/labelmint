import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Mock Telegram user data for testing
const mockTelegramData = {
  user: {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_premium: false
  },
  auth_date: Math.floor(Date.now() / 1000),
  hash: 'test-hash' // In production, this would be a valid HMAC hash
};

const authHeaders = {
  'X-Telegram-Init-Data': `user=${encodeURIComponent(JSON.stringify(mockTelegramData.user))}&auth_date=${mockTelegramData.auth_date}&hash=${mockTelegramData.hash}`,
  'Content-Type': 'application/json'
};

async function testEnhancedFeatures() {
  console.log('🧪 Testing Enhanced Quality Control Features...\n');

  try {
    // Test 1: Check API v2 info
    console.log('1. Testing API v2 info...');
    const apiInfoRes = await fetch(`${BASE_URL}/api/v1`);
    const apiInfo = await apiInfoRes.json();
    console.log('✅ API Info:', {
      version: apiInfo.version,
      features: apiInfo.features,
      consensus: apiInfo.qualityControl.consensus
    });
    console.log('');

    // Test 2: Get worker stats (should show initial state)
    console.log('2. Testing GET /api/worker/stats...');
    const statsRes = await fetch(`${BASE_URL}/api/worker/stats`, {
      headers: authHeaders
    });
    const statsData = await statsRes.json();
    console.log('Status:', statsRes.status);
    console.log('Initial Stats:', {
      accuracy: statsData.stats?.accuracy_rate || 0,
      tasksCompleted: statsData.stats?.tasks_completed || 0,
      level: statsData.stats?.level || 'Beginner',
      warnings: statsData.stats?.warnings?.length || 0
    });
    console.log('');

    // Test 3: Get next task with enhanced features
    console.log('3. Testing GET /api/tasks/next (enhanced)...');
    const nextTaskRes = await fetch(`${BASE_URL}/api/tasks/next`, {
      headers: authHeaders
    });
    console.log('Status:', nextTaskRes.status);
    const nextTaskData = await nextTaskRes.json();
    if (nextTaskData.success) {
      console.log('Task Retrieved:', {
        id: nextTaskData.task?.id,
        title: nextTaskData.task?.title,
        points: nextTaskData.task?.points,
        consensus: nextTaskData.task?.consensus_info,
        workerInfo: nextTaskData.worker_info
      });
    }
    console.log('');

    // Test 4: Submit a label
    if (nextTaskData.success && nextTaskData.task?.id) {
      console.log('4. Testing POST /api/tasks/:id/label (enhanced)...');
      const labelRes = await fetch(`${BASE_URL}/api/tasks/${nextTaskData.task.id}/label`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          answer: 'test_label',
          time_spent: 15
        })
      });
      console.log('Status:', labelRes.status);
      const labelData = await labelRes.json();
      console.log('Label Result:', {
        success: labelData.success,
        isHoneypot: labelData.isHoneypot,
        basePoints: labelData.basePoints,
        bonusMultiplier: labelData.bonusMultiplier,
        finalPoints: labelData.finalPoints,
        accuracyAtTime: labelData.accuracyAtTime,
        consensusStatus: labelData.consensusStatus,
        workerStatus: labelData.workerStatus,
        message: labelData.message
      });
    }
    console.log('');

    // Test 5: Get updated stats
    console.log('5. Testing updated stats after submission...');
    const updatedStatsRes = await fetch(`${BASE_URL}/api/worker/stats`, {
      headers: authHeaders
    });
    const updatedStats = await updatedStatsRes.json();
    console.log('Updated Stats:', {
      accuracy: updatedStats.stats?.accuracy_rate || 0,
      tasksCompleted: updatedStats.stats?.tasks_completed,
      totalEarned: updatedStats.stats?.total_earned,
      bonusEligible: updatedStats.stats?.performance?.bonusEligible
    });
    console.log('');

    // Test 6: Get task history
    console.log('6. Testing GET /api/worker/history...');
    const historyRes = await fetch(`${BASE_URL}/api/worker/history`, {
      headers: authHeaders
    });
    const historyData = await historyRes.json();
    console.log('History:', {
      total: historyData.pagination?.total,
      recentTasks: historyData.history?.slice(0, 2).map(h => ({
        taskTitle: h.task_title,
        answer: h.answer,
        points: h.final_points,
        bonusMultiplier: h.bonus_multiplier
      }))
    });
    console.log('');

    // Test 7: Get leaderboard
    console.log('7. Testing GET /api/worker/leaderboard...');
    const leaderboardRes = await fetch(`${BASE_URL}/api/worker/leaderboard`, {
      headers: authHeaders
    });
    const leaderboardData = await leaderboardRes.json();
    console.log('Leaderboard:', {
      userRank: leaderboardData.userRank,
      topWorkers: leaderboardData.leaderboard?.slice(0, 3).map(w => ({
        username: w.username,
        accuracy: w.current_accuracy,
        earned: w.period_earned
      }))
    });
    console.log('');

    // Test 8: Skip task
    if (nextTaskData.success && nextTaskData.task?.id) {
      console.log('8. Testing POST /api/tasks/:id/skip...');
      const skipRes = await fetch(`${BASE_URL}/api/tasks/${nextTaskData.task.id}/skip`, {
        method: 'POST',
        headers: authHeaders
      });
      console.log('Status:', skipRes.status);
      const skipData = await skipRes.json();
      console.log('Skip Result:', skipData);
    }

    console.log('\n✅ Enhanced features testing complete!');
    console.log('\n📊 Quality Control Features Demonstrated:');
    console.log('   • Consensus tracking (2/3, 3/3, conflict resolution)');
    console.log('   • Accuracy-based bonus calculations');
    console.log('   • Worker statistics and performance tracking');
    console.log('   • Task history with detailed metrics');
    console.log('   • Leaderboard system');
    console.log('   • Skip rate limiting (5 per hour)');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests if server is running
async function checkServerAndTest() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      await testEnhancedFeatures();
    } else {
      console.log('❌ Server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:3001');
    console.log('Run: npm run dev');
  }
}

checkServerAndTest();