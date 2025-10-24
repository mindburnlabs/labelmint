/**
 * Seed Backup Payment Methods
 * This script configures backup payment methods in the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const backupPaymentMethods = [
  {
    name: 'stripe',
    isActive: true,
    priority: 1,
    config: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      supportedCountries: ['US', 'CA', 'GB', 'EU', 'AU'],
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      feeStructure: {
        percentage: 2.9,
        fixed: 0.30
      }
    },
    feeRate: 2.9,
    minAmount: '100', // $1 USD
    maxAmount: '10000000' // $100,000 USD
  },
  {
    name: 'paypal',
    isActive: true,
    priority: 2,
    config: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      sandbox: false,
      supportedCountries: ['US', 'CA', 'GB', 'EU', 'AU'],
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      feeStructure: {
        percentage: 2.9,
        fixed: 0.30,
        international: 0.5
      }
    },
    feeRate: 2.9,
    minAmount: '100', // $1 USD
    maxAmount: '10000000' // $100,000 USD
  },
  {
    name: 'bank_transfer',
    isActive: true,
    priority: 3,
    config: {
      bankDetails: {
        accountName: process.env.BANK_ACCOUNT_NAME,
        accountNumber: process.env.BANK_ACCOUNT_NUMBER,
        routingNumber: process.env.BANK_ROUTING_NUMBER,
        bankName: process.env.BANK_NAME,
        swiftCode: process.env.BANK_SWIFT_CODE,
        iban: process.env.BANK_IBAN
      },
      processingTime: '1-3 business days',
      supportedCountries: ['US', 'CA', 'GB', 'EU'],
      instructions: {
        us: 'Please include your user ID in the memo field',
        eu: 'Please include your user ID in the reference field'
      }
    },
    feeRate: 0.0,
    minAmount: '10000', // $100 USD
    maxAmount: '100000000' // $1,000,000 USD
  },
  {
    name: 'crypto_wallet',
    isActive: false, // Disabled by default
    priority: 4,
    config: {
      supportedNetworks: ['ethereum', 'bitcoin', 'binance'],
      walletAddresses: {
        ethereum: process.env.ETH_WALLET_ADDRESS,
        bitcoin: process.env.BTC_WALLET_ADDRESS,
        busd: process.env.BUSD_WALLET_ADDRESS,
        usdc: process.env.USDC_WALLET_ADDRESS
      },
      confirmationsRequired: {
        ethereum: 12,
        bitcoin: 6,
        binance: 12
      }
    },
    feeRate: 1.0,
    minAmount: '50000', // $500 USD
    maxAmount: '50000000' // $500,000 USD
  }
];

async function seedBackupPayments() {
  try {
    console.log('🌱 Seeding backup payment methods...');

    // Clear existing methods
    await prisma.backupPaymentMethod.deleteMany();

    // Insert new methods
    for (const method of backupPaymentMethods) {
      await prisma.backupPaymentMethod.create({
        data: method
      });
      console.log(`✅ Created backup payment method: ${method.name}`);
    }

    console.log('\n🎉 Backup payment methods seeded successfully!');
    console.log('\nActive methods:');
    console.log(backupPaymentMethods.filter(m => m.isActive).map(m => `- ${m.name} (Priority: ${m.priority})`).join('\n'));

  } catch (error) {
    console.error('❌ Error seeding backup payment methods:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  seedBackupPayments();
}

module.exports = { seedBackupPayments };