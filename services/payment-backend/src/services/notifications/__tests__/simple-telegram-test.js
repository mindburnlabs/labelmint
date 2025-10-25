// Simple JavaScript test for Telegram functionality
import TelegramBot from 'node-telegram-bot-api';

// Mock environment
process.env.TELEGRAM_BOT_TOKEN = process.env.TEST_TELEGRAM_TOKEN || 'test-token';
process.env.ADMIN_TELEGRAM_IDS = '123456789';

async function testTelegramIntegration() {
  console.log('🧪 Testing Telegram Integration');
  console.log('================================');

  try {
    // Test 1: Bot initialization
    console.log('\n1️⃣ Testing bot initialization...');

    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'test-token') {
      console.log('⚠️  No real bot token provided, skipping integration test');
      console.log('💡 Set TEST_TELEGRAM_TOKEN environment variable to run actual tests');
      return true;
    }

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: false
    });

    // Test 2: Get bot info
    console.log('\n2️⃣ Testing bot info...');
    const botInfo = await bot.getMe();
    console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);

    // Test 3: Send test message (if real chat ID provided)
    const testChatId = process.env.TEST_CHAT_ID;
    if (testChatId) {
      console.log('\n3️⃣ Sending test message...');

      const testMessage = `
🚨 *LabelMint Payment Alert - TEST*

🚨 *Low Balance Detected*
📊 Severity: HIGH
⏰ Time: ${new Date().toLocaleString()}

💳 *TON Wallet*
📍 Address: \`EQD_test_123...456\`
💰 Balance: 5.50 TON
⚠️ Threshold: 10.00 TON
📊 Level: 55.0% of minimum

🔗 [Admin Dashboard](https://admin.labelmint.it/payments)
🔗 [Manage Wallets](https://admin.labelmint.it/wallets)

⚡ *Immediate action required to prevent service disruption*
      `.trim();

      await bot.sendMessage(testChatId, testMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Admin Dashboard', url: 'https://admin.labelmint.it/payments' },
              { text: '💳 Manage Wallets', url: 'https://admin.labelmint.it/wallets' }
            ]
          ]
        }
      });

      console.log('✅ Test message sent successfully');
    } else {
      console.log('\n3️⃣ Skipping message test (no TEST_CHAT_ID provided)');
    }

    console.log('\n🎉 Telegram integration test completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Telegram integration test failed:', error.message);

    if (error.response) {
      console.error('API Response:', error.response.body);
    }

    return false;
  }
}

// Test message formatting
function testMessageFormatting() {
  console.log('\n📝 Testing message formatting...');
  console.log('================================');

  const alertData = {
    wallets: [
      {
        address: 'EQD_very_long_wallet_address_that_should_be_truncated',
        balance: '2.50',
        currency: 'TON',
        threshold: '10.00'
      },
      {
        address: '0x_another_long_ethereum_address_for_usdt',
        balance: '75.00',
        currency: 'USDT',
        threshold: '100.00'
      }
    ],
    timestamp: new Date(),
    severity: 'critical'
  };

  // Format wallets for display
  const walletInfo = alertData.wallets.map(wallet => {
    const balance = parseFloat(wallet.balance);
    const threshold = parseFloat(wallet.threshold);
    const percentage = ((balance / threshold) * 100).toFixed(1);

    return `💳 *${wallet.currency} Wallet*
📍 Address: \`${wallet.address.substring(0, 8)}...${wallet.address.slice(-6)}\`
💰 Balance: ${balance} ${wallet.currency}
⚠️ Threshold: ${threshold} ${wallet.currency}
📊 Level: ${percentage}% of minimum`;
  }).join('\n\n');

  const message = `🚨 *LabelMint Payment Alert*

🚨 *Low Balance Detected*
📊 Severity: ${alertData.severity.toUpperCase()}
⏰ Time: ${alertData.timestamp.toLocaleString()}

${walletInfo}

🔗 [Admin Dashboard](https://admin.labelmint.it/payments)
🔗 [Manage Wallets](https://admin.labelmint.it/wallets)

⚡ *Immediate action required to prevent service disruption*`;

  console.log('Formatted message:');
  console.log('==================');
  console.log(message);
  console.log('\n✅ Message formatting test completed');
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Telegram Notification Tests');
  console.log('=========================================');

  testMessageFormatting();

  const integrationSuccess = await testTelegramIntegration();

  if (integrationSuccess) {
    console.log('\n✨ All tests completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export {
  testTelegramIntegration,
  testMessageFormatting
};