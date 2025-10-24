import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testGrowthAutomation() {
  console.log('🚀 Testing Growth Automation Features...\n');

  try {
    // Test 1: Initialize free tier for a new user
    console.log('1. Testing free tier initialization...');
    const freeTierRes = await fetch(`${BASE_URL}/api/growth/free-tier/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 123456,
        campaign_source: 'twitter'
      })
    });
    console.log('Status:', freeTierRes.status);
    const freeTierData = await freeTierRes.json();
    console.log('Free Tier Created:', {
      free_labels_remaining: freeTierData.free_tier?.free_labels_remaining,
      days_remaining: freeTierData.free_tier?.days_remaining
    });
    console.log('');

    // Test 2: Use some free labels
    console.log('2. Testing free label usage...');
    const useLabelsRes = await fetch(`${BASE_URL}/api/growth/free-tier/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 123456,
        labels_to_use: 10
      })
    });
    console.log('Status:', useLabelsRes.status);
    const useLabelsData = await useLabelsRes.json();
    console.log('Labels Used:', {
      success: useLabelsData.success,
      labels_used: useLabelsData.labels_used,
      remaining: useLabelsData.remaining
    });
    console.log('');

    // Test 3: Create a new lead
    console.log('3. Testing lead creation...');
    const leadRes = await fetch(`${BASE_URL}/api/growth/leads/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@startup.com',
        name: 'John Smith',
        company: 'AI Startup Inc',
        source: 'twitter',
        source_details: {
          twitter_handle: '@johnsmith',
          followers: 5000,
          verified: true
        },
        tags: ['AI', 'startup', 'social']
      })
    });
    console.log('Status:', leadRes.status);
    const leadData = await leadRes.json();
    console.log('Lead Created:', {
      success: leadData.success,
      lead_id: leadData.lead?.id,
      score: leadData.lead?.lead_score
    });
    console.log('');

    // Test 4: Create a campaign
    console.log('4. Testing campaign creation...');
    const campaignRes = await fetch(`${BASE_URL}/api/growth/campaigns/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AI Startups Q1 2024',
        type: 'email',
        settings: {
          target_industry: 'AI/ML',
          company_size: '11-100',
          funding_stage: 'Series A'
        },
        start_date: '2024-01-01',
        daily_limit: 50
      })
    });
    console.log('Status:', campaignRes.status);
    const campaignData = await campaignRes.json();
    console.log('Campaign Created:', {
      success: campaignData.success,
      campaign_id: campaignData.campaign?.id
    });
    console.log('');

    // Test 5: Get analytics overview
    console.log('5. Testing analytics overview...');
    const analyticsRes = await fetch(`${BASE_URL}/api/growth/analytics/overview?period=7`);
    console.log('Status:', analyticsRes.status);
    const analyticsData = await analyticsRes.json();
    console.log('Analytics:', {
      period: analyticsData.period,
      new_leads: analyticsData.funnel?.new_leads || 0,
      conversions: analyticsData.funnel?.converted || 0,
      free_trials: analyticsData.free_tier?.total_free_trials || 0,
      conversion_rate: analyticsData.free_tier?.conversion_rate || 0
    });
    console.log('');

    // Test 6: Get free tier analytics
    console.log('6. Testing free tier analytics...');
    const freeAnalyticsRes = await fetch(`${BASE_URL}/api/growth/analytics/free-tier`);
    console.log('Status:', freeAnalyticsRes.status);
    const freeAnalyticsData = await freeAnalyticsRes.json();
    console.log('Free Tier Analytics:', {
      total_trials: freeAnalyticsData.total_free_trials,
      converted: freeAnalyticsData.converted,
      active_trials: freeAnalyticsData.active_trials,
      avg_labels_used: freeAnalyticsData.avg_labels_used?.toFixed(1) || 0
    });
    console.log('');

    // Test 7: Track custom event
    console.log('7. Testing custom event tracking...');
    const eventRes = await fetch(`${BASE_URL}/api/growth/track/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'demo_requested',
        user_id: 123456,
        lead_id: 1,
        properties: {
          demo_type: 'video',
          duration: 30
        },
        utm_source: 'twitter',
        utm_campaign: 'free_trial'
      })
    });
    console.log('Status:', eventRes.status);
    const eventData = await eventRes.json();
    console.log('Event Tracked:', eventData.success);
    console.log('');

    // Test 8: Test conversion webhook
    console.log('8. Testing conversion webhook...');
    const webhookRes = await fetch(`${BASE_URL}/api/growth/webhook/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 123456,
        plan_id: 'pro_monthly',
        amount: 99
      })
    });
    console.log('Status:', webhookRes.status);
    const webhookData = await webhookRes.json();
    console.log('Conversion Tracked:', webhookData.success);
    console.log('');

    // Test 9: Get social media analytics
    console.log('9. Testing social media analytics...');
    const socialRes = await fetch(`${BASE_URL}/api/growth/analytics/social`);
    console.log('Status:', socialRes.status);
    const socialData = await socialRes.json();
    console.log('Social Analytics:', {
      twitter: {
        tweets_found: socialData.twitter?.weekly?.total_tweets_found || 0,
        replies_sent: socialData.twitter?.weekly?.replies_sent || 0
      },
      reddit: {
        posts_found: socialData.reddit?.weekly?.total_posts_found || 0,
        dms_sent: socialData.reddit?.weekly?.dms_sent || 0
      }
    });
    console.log('');

    // Test 10: Simulate Twitter automation (without actually posting)
    console.log('10. Testing Twitter automation setup...');
    // Note: This won't actually post without proper Twitter credentials
    console.log('ℹ️ Twitter automation would:');
    console.log('   • Search for tweets about data labeling needs');
    console.log('   • Reply with helpful resources');
    console.log('   • Create leads from engaged users');
    console.log('   • Track responses and conversions');
    console.log('');

    console.log('✅ Growth automation testing complete!');
    console.log('\n📊 Growth Features Demonstrated:');
    console.log('   • 100 free labels trial system');
    console.log('   • Automated lead capture and scoring');
    console.log('   • Campaign management');
    console.log('   • Multi-channel engagement (Twitter, Reddit, Email)');
    console.log('   • Conversion tracking and analytics');
    console.log('   • Automated follow-up sequences');
    console.log('   • Real-time funnel metrics');

    console.log('\n💡 Expected Daily Output:');
    console.log('   • Twitter: 20-50 targeted replies');
    console.log('   • Reddit: 10-30 DMs to qualified users');
    console.log('   • Email: 50 personalized outreach emails');
    console.log('   • Free Trials: 5-10 new signups');
    console.log('   • Conversions: 1-2 paid customers');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests if server is running
async function checkServerAndTest() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      await testGrowthAutomation();
    } else {
      console.log('❌ Server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:3001');
    console.log('Run: npm run dev');
    console.log('\n⚠️ Note: Some features require additional API keys:');
    console.log('   • TWITTER_BEARER_TOKEN for Twitter automation');
    console.log('   • REDDIT_CLIENT_ID for Reddit bot');
    console.log('   • SMTP credentials for email automation');
  }
}

checkServerAndTest();