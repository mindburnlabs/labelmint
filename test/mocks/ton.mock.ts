import { rest } from 'msw';

// TON Blockchain API mocks
export const tonMocks = [
  // Mock get address information
  rest.post('https://toncenter.com/api/v2/getAddressInformation', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          balance: '1000000000', // 1 TON in nanotons
          state: 'active',
          data: '',
          code: 'te6cckEBAQEAMAAABncAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQwAAgPw',
          last_transaction_id: {
            lt: '34088353000003',
            hash: 'gZAAAAAABkN874M4tFCNbDdDaMfhfr6NeGnTCtfMzqEXkwgo='
          },
          block_id: {
            workchain: 0,
            shard: '8000000000000000',
            seqno: 28372873
          },
          sync_utime: 1698926400
        }
      })
    );
  }),

  // Mock get transactions
  rest.post('https://toncenter.com/api/v2/getTransactions', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: [
          {
            '@type': 'raw.transaction',
            utime: 1698926400,
            data: 'te6ccgEBAQEACwAAGQAAK4D2qg0wiSUTrRmhNAAAAAA2Pou6V40',
            transaction_id: {
              lt: '34088353000003',
              hash: 'gZAAAAAABkN874M4tFCNbDdDaMfhfr6NeGnTCtfMzqEXkwgo='
            },
            fee: '1000000',
            storage_fee: '100000',
            other_fee: '0',
            created_lt: '34088353000003',
            in_msg: {
              '@type': 'raw.message',
              source: {
                account_address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'
              },
              destination: {
                account_address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b'
              },
              value: '1000000000',
              fwd_fee: '666666',
              ihl_fee: '0',
              created_lt: '34088353000002',
              body_hash: 'base64encodedhash'
            },
            out_msgs: []
          }
        ]
      })
    );
  }),

  // Mock send transaction
  rest.post('https://toncenter.com/api/v2/sendBoc', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          '@type': 'raw.transaction',
          address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
          transaction_id: {
            '@type': 'internal.transactionId',
            lt: '34088353000003',
            hash: 'gZAAAAAABkN874M4tFCNbDdDaMfhfr6NeGnTCtfMzqEXkwgo='
          },
          utime: 1698926400
        }
      })
    );
  }),

  // Mock estimate fees
  rest.post('https://toncenter.com/api/v2/estimateFee', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: [
          {
            '@type': 'query.fees',
            source_fees: {
              in_fwd_fee: 0,
              storage_fee: 0,
              gas_fee: 1000000,
              fwd_fee: 666666,
              total_fee: '1666666'
            }
          }
        ]
      })
    );
  }),

  // Mock run get method (for smart contracts)
  rest.post('https://toncenter.com/api/v2/runGetMethod', (req, res, ctx) => {
    const method = req.body.method;
    const mockResults: Record<string, any> = {
      get_wallet_data: {
        ok: true,
        result: {
          gas_used: 3460,
          stack: [
            ['num', '0x1'],
            ['num', '0x0'],
            ['cell', 'base64encodedcell']
          ]
        }
      },
      seqno: {
        ok: true,
        result: {
          gas_used: 1846,
          stack: [['num', '0']]
        }
      },
      get_jetton_data: {
        ok: true,
        result: {
          gas_used: 4680,
          stack: [
            ['num', '0x1000000000000000000'], // total supply
            ['num', '0x6'], // mintable
            ['cell', 'base64encodedcontent'], // content
            ['cell', 'base64encodedowner']
          ]
        }
      }
    };

    return res(
      ctx.status(200),
      ctx.json(mockResults[method] || { ok: false, error: 'Method not found' })
    );
  }),

  // Mock jetton transfers (for USDT)
  rest.post('https://toncenter.com/api/v2/sendBoc', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          '@type': 'raw.transaction',
          address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP', // USDT test contract
          transaction_id: {
            '@type': 'internal.transactionId',
            lt: '34088353000004',
            hash: 'hZAAAAAABkN874M4tFCNbDdDaMfhfr6NeGnTCtfMzqEXkwg0='
          },
          utime: 1698926401
        }
      })
    );
  }),

  // Mock NFT data
  rest.post('https://toncenter.com/api/v2/runGetMethod', (req, res, ctx) => {
    if (req.body.method === 'get_nft_data') {
      return res(
        ctx.status(200),
        ctx.json({
          ok: true,
          result: {
            gas_used: 2860,
            stack: [
              ['num', '0x1'], // initialized
              ['num', '0x0'], // index
              ['cell', 'base64encodedcollection'], // collection address
              ['cell', 'base64encodedowner'], // owner address
              ['cell', 'base64encodedcontent'] // content
            ]
          }
        })
      );
    }
    return res(ctx.status(400), ctx.json({ ok: false, error: 'Invalid method' }));
  }),

  // Mock masterchain info
  rest.get('https://toncenter.com/api/v2/masterchainInfo', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          state_root_hash: 'base64encodedhash',
          init: {
            file_hash: 'base64encodedhash',
            global_id: -239
          },
          last: {
            seqno: 28372873,
            shard_hashes: [
              {
                workchain: 0,
                seqno: 28372873,
                shard: '8000000000000000',
                root_hash: 'base64encodedhash'
              }
            ]
          },
          now: 1698926400
        }
      })
    );
  }),

  // Mock shard block proof
  rest.post('https://toncenter.com/api/v2/shardBlockProof', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          proof: 'base64encodedproof'
        }
      })
    );
  }),

  // Mock block header
  rest.post('https://toncenter.com/api/v2/blockHeader', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          id: {
            workchain: 0,
            shard: '8000000000000000',
            seqno: 28372873
          },
          global_id: -239,
          version: 0,
          flags: 0,
          after_merge: false,
          before_split: false,
          after_split: false,
          want_merge: false,
          want_split: false,
          now: 1698926400,
          prev_seqno: 28372872,
          master_ref: {
            root_hash: 'base64encodedhash',
            seqno: 28372873
          }
        }
      })
    );
  })
];

// Mock wallet operations
export const createMockWallet = (address?: string) => ({
  address: address || 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
  balance: '1000000000', // 1 TON
  seqno: 0,
  publicKey: 'base64encodedpublickey',
  version: 'v3R2'
});

// Mock transaction
export const createMockTransaction = (overrides: any = {}) => ({
  hash: 'base64encodedhash',
  lt: '34088353000003',
  timestamp: 1698926400,
  from: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
  to: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
  amount: '1000000000',
  message: 'Test transaction',
  status: 'confirmed',
  ...overrides
});

// Mock jetton transfer
export const createMockJettonTransfer = (overrides: any = {}) => ({
  hash: 'base64encodedhash',
  lt: '34088353000004',
  timestamp: 1698926401,
  from: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
  to: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9b',
  jetton: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP', // USDT
  amount: '1000000', // 1 USDT (6 decimals)
  decimals: 6,
  symbol: 'USDT',
  ...overrides
});

// TON testnet endpoint
export const TON_TESTNET_ENDPOINTS = [
  'https://testnet.toncenter.com/api/v2',
  'https://testnet.tonscan.org/api',
  'https://testnet.getdelta.io/api/v2'
];

// Mock address validation
export const isValidTONAddress = (address: string): boolean => {
  return /^EQ[A-Za-z0-9_-]{46}$/.test(address);
};

// Mock amount conversion
export const nanoTONToTON = (nano: string | number): number => {
  return Number(nano) / 1000000000;
};

export const TONToNanoTON = (ton: number | string): string => {
  return (Number(ton) * 1000000000).toString();
};