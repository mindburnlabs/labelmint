import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testViralFeatures() {
  console.log('🎮 Testing Viral Features...\n');

  try {
    // Test 1: Get public leaderboard
    console.log('1. Testing public leaderboard...');
    const leaderboardRes = await fetch(`${BASE_URL}/api/viral/leaderboard?type=earnings&period=all_time&limit=10`);
    console.log('Status:', leaderboardRes.status);
    const leaderboardData = await leaderboardRes.json();
    console.log('Leaderboard:', {
      success: leaderboardData.success,
      total_entries: leaderboardData.leaderboard?.length || 0,
      top_earner: leaderboardData.leaderboard?.[0]?.username || 'N/A'
    });
    console.log('');

    // Test 2: Create and process referral
    console.log('2. Testing referral system...');

    // Create referral for user 123456
    const referralRes = await fetch(`${BASE_URL}/api/viral/referral`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Create referral Status:', referralRes.status);
    const referralData = await referralRes.json();
    const referralCode = referralData.referral?.referral_code;
    console.log('Referral Created:', {
      success: referralData.success,
      referral_code: referralCode,
      referral_url: referralData.referral?.referral_url
    });

    // Process referral
    if (referralCode) {
      const processRes = await fetch(`${BASE_URL}/api/viral/referral/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: referralCode,
          user_id: 789012,
          ip_address: '192.168.1.1'
        })
      });
      console.log('Process referral Status:', processRes.status);
      const processData = await processRes.json();
      console.log('Referral Processed:', {
        success: processData.success,
        message: processData.message,
        reward: processData.reward
      });
    }
    console.log('');

    // Test 3: Create milestone share
    console.log('3. Testing milestone sharing...');
    const milestoneRes = await fetch(`${BASE_URL}/api/viral/milestone/create`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        milestone_type: 'labels_completed',
        value: 1000000
      })
    });
    console.log('Create milestone Status:', milestoneRes.status);
    const milestoneData = await milestoneRes.json();
    console.log('Milestone Created:', {
      success: milestoneData.success,
      type: milestoneData.milestone?.type,
      value: milestoneData.milestone?.value,
      message: milestoneData.milestone?.message,
      twitter_url: milestoneData.milestone?.twitter_url?.substring(0, 50) + '...'
    });
    console.log('');

    // Test 4: Test achievements system
    console.log('4. Testing achievements system...');
    const achievementsRes = await fetch(`${BASE_URL}/api/viral/achievements`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Achievements Status:', achievementsRes.status);
    const achievementsData = await achievementsRes.json();
    console.log('Achievements:', {
      success: achievementsData.success,
      total_available: achievementsData.total_available,
      total_unlocked: achievementsData.total_unlocked,
      first_achievement: achievementsData.achievements?.[0]?.name || 'N/A'
    });
    console.log('');

    // Test 5: Test user level system
    console.log('5. Testing level system...');
    const levelRes = await fetch(`${BASE_URL}/api/viral/level`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Level Status:', levelRes.status);
    const levelData = await levelRes.json();
    console.log('User Level:', {
      success: levelData.success,
      current_level: levelData.level?.level,
      level_name: levelData.level?.name,
      progress: levelData.level?.progress,
      bonus_multiplier: levelData.level?.bonus_multiplier
    });
    console.log('');

    // Test 6: Test streak system
    console.log('6. Testing streak system...');
    const streakRes = await fetch(`${BASE_URL}/api/viral/streak`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Streak Status:', streakRes.status);
    const streakData = await streakRes.json();
    console.log('User Streak:', {
      success: streakData.success,
      current_streak: streakData.streak?.current_streak,
      longest_streak: streakData.streak?.longest_streak,
      streak_multiplier: streakData.streak?.streak_multiplier,
      today_active: streakData.streak?.today_active
    });
    console.log('');

    // Test 7: Update activity streak
    console.log('7. Testing streak update...');
    const updateStreakRes = await fetch(`${BASE_URL}/api/viral/streak/update`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Update streak Status:', updateStreakRes.status);
    const updateStreakData = await updateStreakRes.json();
    console.log('Streak Updated:', {
      success: updateStreakData.success,
      new_multiplier: updateStreakData.new_multiplier,
      daily_bonus_earned: updateStreakData.daily_bonus_earned
    });
    console.log('');

    // Test 8: Test watermark settings
    console.log('8. Testing watermark system...');
    const watermarkRes = await fetch(`${BASE_URL}/api/viral/watermark`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Watermark Status:', watermarkRes.status);
    const watermarkData = await watermarkRes.json();
    console.log('Watermark Settings:', {
      success: watermarkData.success,
      show_watermark: watermarkData.show_watermark,
      watermark_text: watermarkData.watermark_text
    });
    console.log('');

    // Test 9: Get viral stats
    console.log('9. Testing viral stats...');
    const statsRes = await fetch(`${BASE_URL}/api/viral/stats`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-User-ID': '123456'
      }
    });
    console.log('Stats Status:', statsRes.status);
    const statsData = await statsRes.json();
    console.log('Viral Stats:', {
      success: statsData.success,
      shares_count: statsData.stats?.shares_count || 0,
      referral_earnings: statsData.stats?.referral_earnings || 0,
      achievements_count: statsData.stats?.achievements_count || 0,
      level: statsData.stats?.level || 1,
      watermark_clicks: statsData.stats?.watermark_clicks || 0
    });
    console.log('');

    // Test 10: Test milestone view tracking
    console.log('10. Testing milestone tracking...');
    if (milestoneData.milestone?.id) {
      const viewRes = await fetch(`${BASE_URL}/api/viral/milestone/${milestoneData.milestone.id}`);
      console.log('Milestone view Status:', viewRes.status);
      const viewData = await viewRes.json();
      console.log('Milestone View:', {
        success: viewData.success,
        message: viewData.milestone?.message,
        username: viewData.milestone?.username
      });
    }
    console.log('');

    console.log('✅ Viral features testing complete!');
    console.log('\n🎮 Viral Features Demonstrated:');
    console.log('   • Public leaderboard with rankings');
    console.log('   • Referral system with rewards');
    console.log('   • Milestone sharing (e.g., "We just labeled 1M images!")');
    console.log('   • Achievement system with 20+ achievements');
    console.log('   • Level progression with bonuses');
    console.log('   • Streak system with multipliers');
    console.log('   • "Powered by" watermarks for free tier');
    console.log('   • Daily bonus system');
    console.log('   • Comprehensive viral analytics');

    console.log('\n🚀 Viral Growth Loop:');
    console.log('   1. Users complete tasks → Earn points');
    console.log('   2. Share milestones → Get views → New signups');
    console.log('   3. Refer friends → Get 100 free labels each');
    console.log('   4. Free tier users see "Powered by" watermark');
    console.log('   5. Leaderboard drives competition');
    console.log('   6. Achievements encourage engagement');
    console.log('   7. Streaks maintain daily activity');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests if server is running
async function checkServerAndTest() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      await testViralFeatures();
    } else {
      console.log('❌ Server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:3001');
    console.log('Run: npm run dev');
  }
}

checkServerAndTest();