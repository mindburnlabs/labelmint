#!/usr/bin/env npx ts-node

/**
 * LabelMint Smart Contract Deployment Script
 *
 * This script deploys the PaymentProcessor contract to TON testnet/mainnet
 * and registers it in the database for monitoring.
 */

import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey, keyPairFromSeed } from '@ton/crypto';
import { fromNano, toNano, Address, beginCell } from '@ton/core';
import { PaymentProcessor } from '../contracts/output/PaymentProcessor_PaymentProcessor';
import { postgresDb } from '../services/payment-backend/src/services/database';

// Configuration
const config = {
  // Network configuration
  network: process.env.NETWORK || 'testnet', // 'testnet' or 'mainnet'

  // RPC endpoints
  testnetRpc: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  mainnetRpc: 'https://toncenter.com/api/v2/jsonRPC',

  // API keys (if required)
  testnetApiKey: process.env.TESTNET_API_KEY,
  mainnetApiKey: process.env.MAINNET_API_KEY,

  // Deployer wallet mnemonic
  deployerMnemonic: process.env.DEPLOYER_MNEMONIC,

  // Contract deployment settings
  initialBalance: toNano('0.1'), // Initial contract balance
  gasLimit: toNano('0.05'), // Gas limit for deployment
};

interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
  network: string;
  deployedAt: Date;
}

/**
 * Create TON client for specified network
 */
function createClient(network: string): TonClient {
  const rpcEndpoint = network === 'mainnet' ? config.mainnetRpc : config.testnetRpc;
  const apiKey = network === 'mainnet' ? config.mainnetApiKey : config.testnetApiKey;

  return new TonClient({
    endpoint: rpcEndpoint,
    apiKey: apiKey
  });
}

/**
 * Get deployer wallet from mnemonic
 */
async function getDeployerWallet(): Promise<{ wallet: WalletContractV4; keyPair: any }> {
  if (!config.deployerMnemonic) {
    throw new Error('DEPLOYER_MNEMONIC environment variable is required');
  }

  const mnemonic = config.deployerMnemonic.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  return { wallet, keyPair };
}

/**
 * Deploy PaymentProcessor contract
 */
async function deployContract(network: string): Promise<DeploymentResult> {
  console.log(`🚀 Starting deployment to ${network}...`);

  try {
    const client = createClient(network);
    const { wallet, keyPair } = await getDeployerWallet();

    console.log(`📝 Deployer wallet: ${wallet.address.toString()}`);

    // Create contract instance
    const paymentProcessor = client.open(
      PaymentProcessor.fromInit(wallet.address)
    );

    console.log(`📋 Contract address: ${paymentProcessor.address.toString()}`);

    // Check if contract already exists
    try {
      const contractState = await client.getContractState(paymentProcessor.address);
      if (contractState.state === 'active') {
        console.log(`⚠️  Contract already deployed at ${paymentProcessor.address}`);
        return {
          success: true,
          contractAddress: paymentProcessor.address.toString(),
          network,
          deployedAt: new Date()
        };
      }
    } catch (error) {
      console.log(`🔍 Contract doesn't exist yet, proceeding with deployment...`);
    }

    // Get deployer wallet balance
    const balance = await client.getBalance(wallet.address);
    console.log(`💰 Deployer balance: ${fromNano(balance)} TON`);

    if (balance < config.initialBalance + config.gasLimit) {
      throw new Error(`Insufficient balance. Need at least ${fromNano(config.initialBalance + config.gasLimit)} TON`);
    }

    // Deploy contract
    console.log(`🔨 Deploying contract...`);
    const deployResult = await paymentProcessor.send(
      wallet.sender(keyPair.secretKey),
      {
        value: config.initialBalance
      }
    );

    console.log(`📄 Deployment transaction: ${deployResult}`);

    // Wait for deployment confirmation
    console.log(`⏳ Waiting for deployment confirmation...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    // Verify deployment
    try {
      const contractState = await client.getContractState(paymentProcessor.address);
      if (contractState.state === 'active') {
        console.log(`✅ Contract successfully deployed!`);

        // Verify contract methods
        const owner = await paymentProcessor.getOwner();
        const contractBalance = await paymentProcessor.getBalance();

        console.log(`👤 Contract owner: ${owner.toString()}`);
        console.log(`💎 Contract balance: ${fromNano(contractBalance)} TON`);

        return {
          success: true,
          contractAddress: paymentProcessor.address.toString(),
          transactionHash: deployResult.toString(),
          network,
          deployedAt: new Date()
        };
      } else {
        throw new Error(`Contract deployment failed. State: ${contractState.state}`);
      }
    } catch (error) {
      throw new Error(`Failed to verify deployment: ${error.message}`);
    }

  } catch (error) {
    console.error(`❌ Deployment failed:`, error.message);
    return {
      success: false,
      error: error.message,
      network,
      deployedAt: new Date()
    };
  }
}

/**
 * Register contract in database
 */
async function registerContractInDatabase(deploymentResult: DeploymentResult): Promise<void> {
  if (!deploymentResult.success || !deploymentResult.contractAddress) {
    return;
  }

  try {
    const query = `
      INSERT INTO smart_contracts (
        address, network, type, version, deployed_at, owner_address, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (address) DO UPDATE SET
        is_active = true,
        deployed_at = EXCLUDED.deployed_at
    `;

    await postgresDb.query(query, [
      deploymentResult.contractAddress,
      deploymentResult.network,
      'PaymentProcessor',
      '1.0.0',
      deploymentResult.deployedAt,
      deploymentResult.contractAddress, // Contract is its own owner for simplicity
      true
    ]);

    console.log(`💾 Contract registered in database`);

    // Set up monitoring for the contract
    await setupMonitoring(deploymentResult.contractAddress, deploymentResult.network);

  } catch (error) {
    console.error(`⚠️  Failed to register contract in database:`, error.message);
  }
}

/**
 * Set up monitoring for deployed contract
 */
async function setupMonitoring(contractAddress: string, network: string): Promise<void> {
  try {
    const query = `
      INSERT INTO contract_monitoring (
        network, contract_address, polling_interval, enabled
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (network, contract_address) DO UPDATE SET
        enabled = EXCLUDED.enabled
    `;

    await postgresDb.query(query, [
      network,
      contractAddress,
      30, // Poll every 30 seconds
      true
    ]);

    console.log(`🔍 Monitoring set up for contract`);
  } catch (error) {
    console.error(`⚠️  Failed to set up monitoring:`, error.message);
  }
}

/**
 * Test deployed contract functionality
 */
async function testContract(contractAddress: string, network: string): Promise<void> {
  console.log(`🧪 Testing contract functionality...`);

  try {
    const client = createClient(network);
    const paymentProcessor = client.open(
      PaymentProcessor.fromAddress(Address.parse(contractAddress))
    );

    // Test basic getter methods
    const owner = await paymentProcessor.getOwner();
    const balance = await paymentProcessor.getBalance();
    const channelCount = await paymentProcessor.getChannelCount();

    console.log(`✅ Contract tests passed:`);
    console.log(`   Owner: ${owner.toString()}`);
    console.log(`   Balance: ${fromNano(balance)} TON`);
    console.log(`   Channel count: ${channelCount}`);

  } catch (error) {
    console.error(`❌ Contract tests failed:`, error.message);
  }
}

/**
 * Generate deployment report
 */
function generateDeploymentReport(result: DeploymentResult): void {
  console.log(`\n📊 Deployment Report`);
  console.log(`====================`);
  console.log(`Network: ${result.network}`);
  console.log(`Success: ${result.success ? '✅' : '❌'}`);

  if (result.success) {
    console.log(`Contract Address: ${result.contractAddress}`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Deployed At: ${result.deployedAt.toISOString()}`);

    console.log(`\n🔗 Useful Links:`);
    if (result.network === 'testnet') {
      console.log(`Explorer: https://testnet.tonscan.org/address/${result.contractAddress}`);
    } else {
      console.log(`Explorer: https://tonscan.org/address/${result.contractAddress}`);
    }
  } else {
    console.log(`Error: ${result.error}`);
  }

  console.log(`====================\n`);
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
  console.log(`🎯 LabelMint Smart Contract Deployment`);
  console.log(`======================================`);
  console.log(`Network: ${config.network}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    // Validate environment
    if (!config.deployerMnemonic) {
      throw new Error('DEPLOYER_MNEMONIC environment variable is required');
    }

    // Connect to database
    console.log(`🔌 Connecting to database...`);
    await postgresDb.query('SELECT 1'); // Test connection
    console.log(`✅ Database connected`);

    // Deploy contract
    const result = await deployContract(config.network);

    // Generate report
    generateDeploymentReport(result);

    if (result.success) {
      // Register in database
      await registerContractInDatabase(result);

      // Test contract
      if (result.contractAddress) {
        await testContract(result.contractAddress, result.network);
      }

      console.log(`🎉 Deployment completed successfully!`);
    } else {
      console.log(`💥 Deployment failed!`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`💥 Deployment script failed:`, error);
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await postgresDb.end();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
LabelMint Smart Contract Deployment Script

Usage: npm run deploy:contracts [options]

Environment Variables:
  NETWORK                    - Target network (testnet|mainnet) [default: testnet]
  DEPLOYER_MNEMONIC         - Mnemonic for deployer wallet [required]
  TESTNET_API_KEY           - API key for testnet RPC [optional]
  MAINNET_API_KEY           - API key for mainnet RPC [optional]

Examples:
  # Deploy to testnet
  NETWORK=testnet DEPLOYER_MNEMONIC="word1 word2 ..." npm run deploy:contracts

  # Deploy to mainnet
  NETWORK=mainnet DEPLOYER_MNEMONIC="word1 word2 ..." npm run deploy:contracts
`);
  process.exit(0);
}

// Run deployment
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { deployContract, registerContractInDatabase, testContract };