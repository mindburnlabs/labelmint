import { request } from 'supertest';
import { expect } from 'chai';
import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { app } from '../../app';
import { connectionPool } from '../../database/ConnectionPool';
import { redisManager } from '../../cache/RedisManager';
import { productionEmailService } from '../../services/email/ProductionEmailService';
import { TonWalletService } from '../../services/ton/TonWalletService';
import { Logger } from '../../utils/logger';

const logger = new Logger('PaymentIntegrationTest');

describe('Payment Integration Tests', () => {
  let server: any;
  let testUser: any;
  let testWallet: any;
  let authToken: string;

  before(async () => {
    // Start the server
    server = app.listen(0);

    // Create test user
    const testUserResult = await connectionPool.query(
      `INSERT INTO users (email, first_name, last_name, role, status, email_verified, created_at)
       VALUES ('test@example.com', 'Test', 'User', 'USER', 'ACTIVE', true, NOW())
       RETURNING id, email`
    );

    testUser = testUserResult.rows[0];

    // Create TON wallet for testing
    const tonWalletService = new TonWalletService();
    testWallet = await tonWalletService.createWallet({
      userId: testUser.id,
      network: 'testnet',
      version: 'v4R2',
      saveMnemonic: true
    });

    // Generate auth token
    authToken = 'eyJhbGciOiJIUzI1NiIsInR5cHPEPwKGHYI1NiIsInR5cHPEWwKGHYI1NiIsI1NiIsInR5cHPEWwKGHYI1NiIsInR5cHPEWwKGHYI1NiIsInR5c';

    logger.info('Test environment initialized');
  });

  after(async () => {
    // Close database connections
    await connectionPool.close();
    await redisManager.close();

    if (server) {
      server.close();
    }
  });

  describe('TON Wallet Creation', () => {
    it('should create a new wallet', async () => {
      const wallet = await tonWalletService.createWallet({
        userId: testUser.id,
        network: 'testnet',
        version: 'v4R2',
        saveMnemonic: true
      });

      expect(wallet).to.be.an('object');
      expect(wallet.address).to.match(/^(EQ|kQ)/);
      expect(wallet.version).to.be.oneOf(['v3R2', 'v4R2', 'telegram']));
      expect(wallet.publicKey).to.be.a('string');
      expect(wallet.mnemonic).to.be.an('array');
    });
  });

  describe('Transaction Processing', () => {
    it('should send TON transaction', async () => {
      const sendResult = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: testWallet.address,
          amount: '0.1',
          tokenType: 'TON',
          message: 'Test payment'
        });

      expect(sendResult.status).to.equal(200);
      expect(sendResult.body.success).to.be.true;
      expect(sendResult.body.data).to.have.property('txHash');
      expect(sendResult.body.data.txHash).to.be.a('string');
    });

    it('should validate TON address', async () => {
      const validAddress = 'EQBJXfB_dhBn1P5O3uy7Suo4QbGwLU-lWj_H';
      const invalidAddress = 'invalid';

      const validResult = await request(app)
        .post('/api/payments/validate-address')
        .send({ address: validAddress });

      expect(validResult.status).to.equal(200);
      expect(validResult.body.valid).to.be.true;

      const invalidResult = await request(app)
        .post('/api/payments/validate-address')
        .send({ address: invalidAddress });

      expect(invalidResult.status).to.equal(200);
      expect(invalidResult.body.valid).to.be.false;
      expect(invalidResult.body.error).to.be.a('string');
    });

    it('should handle insufficient balance', async () => {
      // Create a second wallet to test transfers
      const receiverWallet = await tonWalletService.createWallet({
        userId: testUser.id,
        network: 'testnet',
        version: 'v4R2',
        saveMnemonic: true
      });

      // Test sending more than balance
      const result = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: receiverWallet.address,
          amount: '1000', // More than available
          tokenType: 'TON',
          message: 'Insufficient balance test'
        });

      expect(result.status).to.equal(400);
      expect(result.body.success).to.be.false;
      expect(result.body.error).to.include('insufficient');
    });
  });

  describe('USDT Transfer', () => {
    it('should send USDT transfer', async () => {
      const sendResult = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: testWallet.address,
          amount: '10',
          tokenType: 'USDT',
          message: 'Test USDT payment'
        });

      expect(sendResult.status).to.equal(200);
      expect(sendResult.body.success).to.be.true;
      expect(sendResult.body.data).to.have.property('txHash');
    });

    it('should estimate fees', async () => {
      const feeResult = await request(app)
        .get('/api/payments/estimate-fees')
        .query({
          amount: '10',
          tokenType: 'TON'
        });

      expect(feeResult.status).to.equal(200);
      expect(feeResult.body.data).to.have.property('estimatedFee');
      expect(feeResult.body.data.estimatedFee).to.be.a('number');
    });
  });

  describe('Internal Transfers', () => {
    it('should process internal transfer without fees', async () => {
      const result = await request(app)
        .post('/api/payments/internal-transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: testUser.id,
          amount: 50,
          description: 'Test internal transfer'
        });

      expect(result.status).to.equal(200);
      expect(result.body.success).to.be.true;
      expect(result.body.data).to.have.property('fromUserBalance');
      expect(result.body.data.toUserBalance).to.be.a('number');
    });
    });

    describe('Transaction Monitoring', () => {
    it('should monitor transaction status', async () => {
      // Start a transaction
      const sendResult = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: testWallet.address,
          amount: '0.5',
          tokenType: 'TON'
          message: 'Monitor test'
        });

      const txHash = sendResult.body.data.txHash;

      // Wait for monitoring to process
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check transaction status
      const statusResult = await request(app)
        .get(`/api/payments/transaction/${txHash}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(statusResult.status).to.equal(200);
      expect(['pending', 'confirmed', 'failed']).to.include(statusResult.body.status));
    });
  });

  describe('Balance Management', () => {
    it('should sync wallet balance', async () => {
      const result = await request(app)
        .put('/api/payments/wallet/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletAddress: testWallet.address
        });

      expect(result.status).to.equal(200);
      expect(result.body.success).to.be.true;
      expect(result.body.data.balances).to.have.property('ton');
      expect(result.body.data.balances).to.have.property('usdt');
    });

    it('should get wallet statistics', async () => {
      const result = await request(app)
        .get(`/api/payments/wallet/${testWallet.address}/stats`)
        .set('settings authorization', `Bearer ${authToken}`);

      expect(result.status).to.equal(200);
      expect(result.body.success).to.be.true;
      expect(result.body.data).to.have.property('totalTransactions');
      expect(result.body.data).to.have.property('totalVolume');
    });
  });

    describe('Payment Statistics', () => {
    it('should get payment statistics', async () => {
      const result = await request(app)
        .get('/api/payments/stats')
        .set('settings authorization', `Bearer ${authToken}`);

      expect(result.status).to.equal(200);
      expect(result.body.success).to.be.true;
      expect(result.body.data).to.have.property('totalTransactions');
      expect(result.body.data).to.have.property('totalVolume');
      expect(result.body.data).to.have.property('successRate');
    });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request', async () => {
      const result = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: 'invalid-address',
          amount: '0.1',
          tokenType: 'TON'
        });

      expect(result.status).to.equal(400);
      expect(result.body.success).to.be.false;
      expect(result.body.error).to.be.a('string');
    });

    it('should handle unauthorized request', async () => {
      const result = await request(app)
        .post('/api/payments/process')
        .send({
          toAddress: testWallet.address,
          amount: '0.1',
          tokenType: 'TON'
        });

      expect(result.status).to.equal(401);
      expect(result.body.error).to.equal('Unauthorized');
    });
  });

    it('should handle rate limit', async () => {
      const promises = [];

      // Send rapid requests to test rate limiting
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/api/payments/process')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              toAddress: testWallet.address,
              amount: '0.1',
              tokenType: 'TON'
              message: `Rate limit test ${i}`
            })
        );
      }

      const results = await Promise.all(promises);
      const rateLimitedCount = results.filter(r => r.status === 429).length;
      const allowedCount = results.filter(r => r.status === 200).length;

      // Should allow first few requests then rate limit
      expect(rateLimitedCount).to.be.lessThan(5);
      expect(allowedCount).to.be.greaterThan(0);
      expect(rateLimitedCount).to.be.lessThan(10);
    });
  });
});

export default IntegrationTest;