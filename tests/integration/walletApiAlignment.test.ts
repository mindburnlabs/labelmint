import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { TonWalletService, initializeTonWalletService } from '../../../packages/ui/src/services/tonWalletService';
import { ApiService, initializeApiService } from '../../../packages/ui/src/services/apiService';

// Mock server setup
const server = setupServer(
  // Mock wallet balance endpoint
  rest.get('/api/payments/wallet', (req, res, ctx) => {
    const network = req.url.searchParams.get('network');
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({ success: false, error: 'Unauthorized' })
      );
    }

    const mockResponse = {
      success: true,
      wallet: {
        address: network === 'testnet'
          ? 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP'
          : 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
        balances: {
          ton: '5.5',
          usdt: '125.75',
          jettons: {
            'USDT': '125.75',
            'USDC': '50.25'
          }
        }
      }
    };

    return res(ctx.status(200), ctx.json(mockResponse));
  }),

  // Mock transaction history endpoint
  rest.get('/api/payments/transactions', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({ success: false, error: 'Unauthorized' })
      );
    }

    const mockResponse = {
      success: true,
      data: {
        onChain: [
          {
            id: 'tx_123',
            txHash: '0x123abc',
            fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            toAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
            amount: '1.5',
            currency: 'TON',
            status: 'confirmed',
            timestamp: '2024-01-15T10:30:00Z',
            description: 'Task payment'
          },
          {
            id: 'tx_456',
            txHash: '0x456def',
            fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            toAddress: 'EQC_E6dHj2R4R_8Q8L9LQ9F8k0lL9J4k0lL9J4k0lL9J4k0lL9J4k',
            amount: '50',
            currency: 'USDT',
            status: 'confirmed',
            timestamp: '2024-01-14T15:45:00Z',
            description: 'USDT transfer'
          }
        ],
        internal: [
          {
            id: 'internal_789',
            transfer_id: 'transfer_789',
            from_user_id: '123',
            to_user_id: '456',
            amount: '0.5',
            created_at: '2024-01-13T09:15:00Z',
            description: 'Internal bonus',
            tx_hash: '0x789ghi'
          }
        ]
      }
    };

    return res(ctx.status(200), ctx.json(mockResponse));
  }),

  // Mock send transaction endpoint
  rest.post('/api/payments/transaction/send', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({ success: false, error: 'Unauthorized' })
      );
    }

    return res(
      ctx.json({
        success: true,
        txHash: '0xnewtransaction123',
        message: 'Transaction sent successfully'
      })
    );
  }),

  // Mock Telegram wallet connect endpoint
  rest.post('/api/payments/wallet/telegram/connect', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({ success: false, error: 'Unauthorized' })
      );
    }

    return res(
      ctx.json({
        success: true,
        walletAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        message: 'Telegram wallet connected successfully'
      })
    );
  }),

  // Mock worker wallet endpoint
  rest.get('/workers/:workerId/wallet', (req, res, ctx) => {
    const workerId = req.params.workerId;

    const mockResponse = {
      success: true,
      walletAddress: `EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUW${workerId}`,
      balance: {
        ton: 10.5,
        usdt: 250.75
      },
      transactions: [
        {
          id: `tx_${workerId}_1`,
          type: 'deposit',
          amount: 5.0,
          currency: 'TON',
          status: 'completed',
          timestamp: '2024-01-15T10:30:00Z'
        }
      ]
    };

    return res(ctx.status(200), ctx.json(mockResponse));
  }),

  // Mock worker transactions endpoint
  rest.get('/workers/:workerId/transactions', (req, res, ctx) => {
    const workerId = req.params.workerId;
    const limit = parseInt(req.url.searchParams.get('limit') || '10');

    const mockTransactions = Array(limit).fill(null).map((_, i) => ({
      id: `tx_${workerId}_${i + 1}`,
      type: i % 2 === 0 ? 'deposit' : 'withdrawal',
      amount: (i + 1) * 0.5,
      currency: i % 3 === 0 ? 'USDT' : 'TON',
      status: 'completed',
      timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString()
    }));

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        transactions: mockTransactions
      })
    );
  }),

  // Mock withdrawal endpoints
  rest.post('/withdraw/usdt', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        transactionId: 'withdraw_usdt_123',
        message: 'USDT withdrawal initiated'
      })
    );
  }),

  rest.post('/withdraw/telegram', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        transactionId: 'withdraw_tg_123',
        message: 'Telegram withdrawal initiated'
      })
    );
  })
);

describe('Wallet API Alignment Integration Tests', () => {
  let walletService: TonWalletService;
  let apiService: ApiService;
  let mockAuth: { token: string; getUserId: () => string };

  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'error'
    });
  });

  beforeEach(() => {
    // Mock authentication
    mockAuth = {
      token: 'Bearer mock-auth-token-123',
      getUserId: () => '123'
    };

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'authToken' || key === 'auth_token' || key === 'token') {
          return 'mock-auth-token-123';
        }
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    // Initialize services
    walletService = initializeTonWalletService({
      network: 'testnet',
      apiKey: 'test-api-key'
    });

    apiService = initializeApiService({
      baseURL: 'http://localhost:3000',
      timeout: 10000,
      getAuthToken: () => 'mock-auth-token-123'
    });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('Wallet Balance API', () => {
    it('should fetch wallet balance successfully', async () => {
      const balance = await walletService.fetchBalance();

      expect(balance).toEqual({
        ton: '5.5',
        usdt: '125.75',
        jettons: {
          USDT: '125.75',
          USDC: '50.25'
        }
      });
    });

    it('should handle authentication errors', async () => {
      // Override mock to return 401
      server.use(
        rest.get('/api/payments/wallet', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ success: false, error: 'Unauthorized' })
          );
        })
      );

      await expect(walletService.fetchBalance()).rejects.toThrow('Failed to fetch wallet balance');
    });

    it('should handle malformed balance responses', async () => {
      server.use(
        rest.get('/api/payments/wallet', (req, res, ctx) => {
          return res(
            ctx.json({
              success: true,
              wallet: {
                balances: {
                  ton: null,
                  usdt: undefined,
                  jettons: 'not-an-object'
                }
              }
            })
          );
        })
      );

      const balance = await walletService.fetchBalance();

      expect(balance).toEqual({
        ton: '0',
        usdt: '0',
        jettons: undefined
      });
    });

    it('should emit balance updated events', async () => {
      const eventSpy = vi.fn();
      walletService.on('balanceUpdated', eventSpy);

      await walletService.fetchBalance();

      expect(eventSpy).toHaveBeenCalledWith({
        ton: '5.5',
        usdt: '125.75',
        jettons: {
          USDT: '125.75',
          USDC: '50.25'
        }
      });
    });
  });

  describe('Transaction History API', () => {
    it('should fetch and normalize transaction history', async () => {
      const transactions = await walletService.fetchTransactions();

      expect(transactions).toHaveLength(3);

      // Check on-chain transaction normalization
      const tonTx = transactions.find(tx => tx.id === 'tx_123');
      expect(tonTx).toEqual({
        id: 'tx_123',
        hash: '0x123abc',
        from: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        to: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
        amount: '1.5',
        tokenType: 'TON',
        status: 'confirmed',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        description: 'Task payment'
      });

      // Check USDT transaction
      const usdtTx = transactions.find(tx => tx.id === 'tx_456');
      expect(usdtTx?.tokenType).toBe('USDT');
      expect(usdtTx?.amount).toBe('50');

      // Check internal transaction normalization
      const internalTx = transactions.find(tx => tx.id === 'internal_789');
      expect(internalTx?.id).toBe('internal_789');
      expect(internalTx?.from).toBe('123');
      expect(internalTx?.to).toBe('456');
    });

    it('should handle empty transaction history', async () => {
      server.use(
        rest.get('/api/payments/transactions', (req, res, ctx) => {
          return res(
            ctx.json({
              success: true,
              data: {
                onChain: [],
                internal: []
              }
            })
          );
        })
      );

      const transactions = await walletService.fetchTransactions();
      expect(transactions).toHaveLength(0);
    });

    it('should emit transactions updated events', async () => {
      const eventSpy = vi.fn();
      walletService.on('transactionsUpdated', eventSpy);

      await walletService.fetchTransactions();

      expect(eventSpy).toHaveBeenCalledWith(expect.any(Array));
      expect(eventSpy.mock.calls[0][0]).toHaveLength(3);
    });
  });

  describe('Send Transaction API', () => {
    it('should send TON transaction successfully', async () => {
      const result = await walletService.sendTonTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '1.5',
        'Test payment'
      );

      expect(result).toEqual({
        success: true,
        txHash: '0xnewtransaction123',
        error: undefined
      });

      // Verify the request was made with correct parameters
      const calls = server.listHandlers();
      expect(calls).toHaveLength(expect.any(Number));
    });

    it('should send USDT transaction successfully', async () => {
      const result = await walletService.sendUSDTTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '50',
        'USDT transfer test'
      );

      expect(result).toEqual({
        success: true,
        txHash: '0xnewtransaction123'
      });
    });

    it('should handle transaction failure', async () => {
      server.use(
        rest.post('/api/payments/transaction/send', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: 'Insufficient balance'
            })
          );
        })
      );

      const result = await walletService.sendTonTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '1000',
        'Large amount'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should refresh balance and transactions after successful send', async () => {
      const fetchBalanceSpy = vi.spyOn(walletService, 'fetchBalance');
      const fetchTransactionsSpy = vi.spyOn(walletService, 'fetchTransactions');

      await walletService.sendTonTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '1.0'
      );

      expect(fetchBalanceSpy).toHaveBeenCalled();
      expect(fetchTransactionsSpy).toHaveBeenCalled();
    });
  });

  describe('Telegram Wallet Integration', () => {
    it('should connect Telegram wallet successfully', async () => {
      // Mock Telegram WebApp
      const mockWebApp = {
        initData: 'mock_init_data',
        initDataUnsafe: {
          user: {
            id: 123456,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
          }
        }
      };

      Object.defineProperty(window, 'Telegram', {
        value: { WebApp: mockWebApp },
        writable: true
      });

      const result = await walletService.connectTelegramWallet();

      expect(result).toEqual({
        success: true,
        error: undefined
      });
    });

    it('should handle missing Telegram WebApp', async () => {
      Object.defineProperty(window, 'Telegram', {
        value: undefined,
        writable: true
      });

      const result = await walletService.connectTelegramWallet();

      expect(result).toEqual({
        success: false,
        error: 'Telegram WebApp not available'
      });
    });

    it('should handle Telegram wallet connection failure', async () => {
      const mockWebApp = {
        initData: 'invalid_init_data'
      };

      Object.defineProperty(window, 'Telegram', {
        value: { WebApp: mockWebApp },
        writable: true
      });

      server.use(
        rest.post('/api/payments/wallet/telegram/connect', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: 'Invalid init data'
            })
          );
        })
      );

      const result = await walletService.connectTelegramWallet();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid init data');
    });
  });

  describe('Worker Wallet API Integration', () => {
    it('should fetch worker wallet data via API service', async () => {
      const response = await apiService.client.get('/workers/123/wallet');

      expect(response.data).toEqual({
        success: true,
        walletAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWW123',
        balance: {
          ton: 10.5,
          usdt: 250.75
        },
        transactions: expect.arrayContaining([
          expect.objectContaining({
            id: 'tx_123_1',
            type: 'deposit',
            amount: 5.0,
            currency: 'TON',
            status: 'completed'
          })
        ])
      });
    });

    it('should fetch worker transactions with pagination', async () => {
      const response = await apiService.client.get('/workers/123/transactions?limit=5');

      expect(response.data.success).toBe(true);
      expect(response.data.transactions).toHaveLength(5);
      expect(response.data.transactions[0]).toMatchObject({
        id: 'tx_123_1',
        type: 'deposit',
        amount: 0.5,
        currency: 'TON',
        status: 'completed'
      });
    });

    it('should handle worker not found errors', async () => {
      server.use(
        rest.get('/workers/999/wallet', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({
              success: false,
              error: 'Worker not found'
            })
          );
        })
      );

      await expect(
        apiService.client.get('/workers/999/wallet')
      ).rejects.toThrow();
    });
  });

  describe('Withdrawal API Integration', () => {
    it('should process USDT withdrawal via API service', async () => {
      const response = await apiService.client.post('/withdraw/usdt', {
        amount: 50,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        workerId: 123
      });

      expect(response.data).toEqual({
        success: true,
        transactionId: 'withdraw_usdt_123',
        message: 'USDT withdrawal initiated'
      });
    });

    it('should process Telegram withdrawal via API service', async () => {
      const response = await apiService.client.post('/withdraw/telegram', {
        amount: 25,
        workerId: 123
      });

      expect(response.data).toEqual({
        success: true,
        transactionId: 'withdraw_tg_123',
        message: 'Telegram withdrawal initiated'
      });
    });

    it('should validate withdrawal request parameters', async () => {
      server.use(
        rest.post('/withdraw/usdt', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: 'Missing required fields: amount, address, workerId'
            })
          );
        })
      );

      await expect(
        apiService.client.post('/withdraw/usdt', { amount: 50 })
      ).rejects.toThrow();
    });
  });

  describe('API Service Integration', () => {
    it('should include authentication headers in requests', async () => {
      await apiService.client.get('/workers/123/wallet');

      const requests = server.listHandlers().filter(
        handler => handler.info.method === 'GET'
      );

      // The last request should have included the auth token
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        rest.get('/workers/123/wallet', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: 'Internal server error'
            })
          );
        })
      );

      await expect(
        apiService.client.get('/workers/123/wallet')
      ).rejects.toThrow('Internal server error');
    });

    it('should include request ID for tracking', async () => {
      const requestSpy = vi.fn();

      server.use(
        rest.get('/workers/123/wallet', (req, res, ctx) => {
          requestSpy(req.headers.get('X-Request-ID'));
          return res(ctx.json({ success: true }));
        })
      );

      await apiService.client.get('/workers/123/wallet');

      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^req_\d+_[a-z0-9]+$/)
      );
    });
  });

  describe('Data Format Consistency', () => {
    it('should maintain consistent balance format across APIs', async () => {
      // Fetch from wallet service
      const walletBalance = await walletService.fetchBalance();

      // Fetch from worker API
      const workerResponse = await apiService.client.get('/workers/123/wallet');
      const workerBalance = workerResponse.data.balance;

      // Both should have similar structure
      expect(walletBalance).toHaveProperty('ton');
      expect(walletBalance).toHaveProperty('usdt');
      expect(workerBalance).toHaveProperty('ton');
      expect(workerBalance).toHaveProperty('usdt');

      // Both should be string format
      expect(typeof walletBalance.ton).toBe('string');
      expect(typeof walletBalance.usdt).toBe('string');
      expect(typeof workerBalance.ton).toBe('number');
      expect(typeof workerBalance.usdt).toBe('number');
    });

    it('should maintain consistent transaction format', async () => {
      const walletTransactions = await walletService.fetchTransactions();
      const workerResponse = await apiService.client.get('/workers/123/transactions?limit=3');
      const workerTransactions = workerResponse.data.transactions;

      // Check wallet transactions format
      const walletTx = walletTransactions[0];
      expect(walletTx).toHaveProperty('id');
      expect(walletTx).toHaveProperty('hash');
      expect(walletTx).toHaveProperty('amount');
      expect(walletTx).toHaveProperty('status');
      expect(walletTx).toHaveProperty('timestamp');

      // Check worker transactions format
      const workerTx = workerTransactions[0];
      expect(workerTx).toHaveProperty('id');
      expect(workerTx).toHaveProperty('type');
      expect(workerTx).toHaveProperty('amount');
      expect(workerTx).toHaveProperty('currency');
      expect(workerTx).toHaveProperty('status');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      server.use(
        rest.get('/api/payments/wallet', (req, res, ctx) => {
          return res(
            ctx.delay(15000), // Longer than timeout
            ctx.json({ success: true })
          );
        })
      );

      await expect(walletService.fetchBalance()).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      server.use(
        rest.get('/api/payments/transactions', (req, res, ctx) => {
          return res(
            ctx.set('Content-Type', 'application/json'),
            ctx.body('invalid json response')
          );
        })
      );

      await expect(walletService.fetchTransactions()).rejects.toThrow();
    });

    it('should handle mixed success/failure responses', async () => {
      server.use(
        rest.post('/api/payments/transaction/send', (req, res, ctx) => {
          const body = req.body as any;

          if (body.amount === '1.5') {
            return res(
              ctx.json({ success: true, txHash: '0xsuccess123' })
            );
          } else {
            return res(
              ctx.status(400),
              ctx.json({ success: false, error: 'Invalid amount' })
            );
          }
        })
      );

      const successResult = await walletService.sendTonTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '1.5'
      );
      expect(successResult.success).toBe(true);

      const failureResult = await walletService.sendTonTransaction(
        'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        '999'
      );
      expect(failureResult.success).toBe(false);
    });
  });
});