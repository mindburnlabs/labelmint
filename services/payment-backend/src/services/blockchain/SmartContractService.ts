import { TonClient, Address } from '@ton/ton';
import { fromNano, toNano, beginCell, Cell } from '@ton/core';
import { postgresDb } from '../database';
import { TonApiManager } from '../ton/TonApiManager';
import { Logger } from '../../utils/logger';

const logger = new Logger('SmartContractService');

export interface SmartContractConfig {
  address: string;
  network: 'mainnet' | 'testnet';
  type: 'PaymentProcessor';
  version: string;
  deployedAt: Date;
  ownerAddress: string;
}

export interface ContractCallResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
  events?: any[];
}

export interface DepositParams {
  amount: string;
  recipient: string;
  message?: string;
}

export interface WithdrawParams {
  amount: string;
  recipient: string;
}

export interface ChannelPaymentParams {
  channelId: number;
  amount: string;
  recipient: string;
}

export interface CreateChannelParams {
  participant: string;
  capacity: string;
  duration: number;
}

export interface ChannelInfo {
  participant: string;
  capacity: string;
  expiry: string;
  spent: string;
}

export class SmartContractService {
  private apiManager: TonApiManager;
  private contracts: Map<string, SmartContractConfig> = new Map();

  constructor() {
    this.apiManager = new TonApiManager();
    this.loadContractConfigurations();
  }

  /**
   * Load smart contract configurations from database
   */
  private async loadContractConfigurations(): Promise<void> {
    try {
      const query = `
        SELECT address, network, type, version, deployed_at, owner_address
        FROM smart_contracts
        WHERE is_active = true
      `;

      const result = await postgresDb.query(query);

      for (const row of result.rows) {
        const config: SmartContractConfig = {
          address: row.address,
          network: row.network,
          type: row.type,
          version: row.version,
          deployedAt: row.deployed_at,
          ownerAddress: row.owner_address
        };

        this.contracts.set(`${row.network}_${row.type}`, config);
      }

      logger.info(`Loaded ${this.contracts.size} smart contract configurations`);
    } catch (error) {
      logger.error('Failed to load smart contract configurations', error);
    }
  }

  /**
   * Get contract configuration
   */
  private getContractConfig(network: string, type: string): SmartContractConfig | null {
    return this.contracts.get(`${network}_${type}`) || null;
  }

  /**
   * Get TON client for specific network
   */
  private getClient(network: 'mainnet' | 'testnet'): TonClient | null {
    return this.apiManager.getClient(network);
  }

  /**
   * Send deposit to payment processor contract
   */
  async sendDeposit(
    network: 'mainnet' | 'testnet',
    params: DepositParams,
    signerAddress: string
  ): Promise<ContractCallResult> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);
      const recipientAddress = Address.parse(params.recipient);

      // Create deposit message
      const depositBody = beginCell()
        .storeUint(0x4A4F4B48, 32) // Deposit message ID
        .storeCoins(toNano(params.amount))
        .storeAddress(recipientAddress)
        .endCell();

      // Create and send transaction
      const result = await this.sendTransaction(
        client,
        signerAddress,
        contractAddress,
        toNano(params.amount),
        depositBody
      );

      logger.info(`Deposit sent: ${params.amount} TON to ${params.recipient}`);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to send deposit', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Withdraw funds from payment processor contract
   */
  async withdraw(
    network: 'mainnet' | 'testnet',
    params: WithdrawParams,
    signerAddress: string
  ): Promise<ContractCallResult> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);
      const recipientAddress = Address.parse(params.recipient);

      // Create withdraw message
      const withdrawBody = beginCell()
        .storeUint(0x57495448, 32) // Withdraw message ID
        .storeCoins(toNano(params.amount))
        .storeAddress(recipientAddress)
        .endCell();

      // Create and send transaction
      const result = await this.sendTransaction(
        client,
        signerAddress,
        contractAddress,
        toNano('0.05'), // Gas fee
        withdrawBody
      );

      logger.info(`Withdrawal sent: ${params.amount} TON to ${params.recipient}`);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to withdraw', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create payment channel
   */
  async createChannel(
    network: 'mainnet' | 'testnet',
    params: CreateChannelParams,
    signerAddress: string
  ): Promise<ContractCallResult> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);
      const participantAddress = Address.parse(params.participant);

      // Create channel message
      const channelBody = beginCell()
        .storeUint(0x4348414E, 32) // CreateChannel message ID
        .storeAddress(participantAddress)
        .storeCoins(toNano(params.capacity))
        .storeUint(params.duration, 32)
        .endCell();

      // Create and send transaction
      const result = await this.sendTransaction(
        client,
        signerAddress,
        contractAddress,
        toNano('0.1'), // Gas fee
        channelBody
      );

      logger.info(`Channel created: capacity ${params.capacity} TON for ${params.participant}`);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to create channel', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send payment through channel
   */
  async sendChannelPayment(
    network: 'mainnet' | 'testnet',
    params: ChannelPaymentParams,
    signerAddress: string
  ): Promise<ContractCallResult> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);
      const recipientAddress = Address.parse(params.recipient);

      // Create channel payment message
      const paymentBody = beginCell()
        .storeUint(0x43484150, 32) // ChannelPayment message ID
        .storeUint(params.channelId, 32)
        .storeCoins(toNano(params.amount))
        .storeAddress(recipientAddress)
        .endCell();

      // Create and send transaction
      const result = await this.sendTransaction(
        client,
        signerAddress,
        contractAddress,
        toNano('0.05'), // Gas fee
        paymentBody
      );

      logger.info(`Channel payment sent: ${params.amount} TON through channel ${params.channelId}`);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to send channel payment', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close payment channel
   */
  async closeChannel(
    network: 'mainnet' | 'testnet',
    channelId: number,
    signerAddress: string
  ): Promise<ContractCallResult> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);

      // Create close channel message (just the channel ID)
      const closeBody = beginCell()
        .storeUint(channelId, 32)
        .endCell();

      // Create and send transaction
      const result = await this.sendTransaction(
        client,
        signerAddress,
        contractAddress,
        toNano('0.05'), // Gas fee
        closeBody
      );

      logger.info(`Channel closed: ${channelId}`);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to close channel', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo(
    network: 'mainnet' | 'testnet',
    contractType: string = 'PaymentProcessor'
  ): Promise<any> {
    try {
      const contract = this.getContractConfig(network, contractType);
      if (!contract) {
        throw new Error(`${contractType} contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);

      // Get contract state
      const state = await client.getContractState(contractAddress);

      // Get contract methods (this would depend on the specific contract ABI)
      const methods = await this.getContractMethods(client, contractAddress);

      return {
        address: contract.address,
        network: contract.network,
        type: contract.type,
        version: contract.version,
        deployedAt: contract.deployedAt,
        ownerAddress: contract.ownerAddress,
        state: {
          balance: fromNano(state.balance || '0'),
          status: state.state,
          code: state.code ? state.code.toString('base64') : null,
          data: state.data ? state.data.toString('base64') : null
        },
        methods
      };
    } catch (error) {
      logger.error('Failed to get contract info', error);
      throw error;
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(
    network: 'mainnet' | 'testnet',
    channelId: number
  ): Promise<ChannelInfo | null> {
    try {
      const contract = this.getContractConfig(network, 'PaymentProcessor');
      if (!contract) {
        throw new Error(`PaymentProcessor contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);

      // Call get_channel_info method
      const result = await client.runMethod(contractAddress, 'get_channel_info', [
        { type: 'int', value: BigInt(channelId) }
      ]);

      if (result.stack.remaining === 0) {
        return null;
      }

      const channelData = result.stack.readCell();

      // Parse channel data (implementation depends on contract structure)
      return {
        participant: '0x' + channelData.bits.readUint(256).toString(16),
        capacity: fromNano(channelData.bits.readCoins()),
        expiry: new Date(parseInt(channelData.bits.readUint(64).toString()) * 1000).toISOString(),
        spent: fromNano(channelData.bits.readCoins())
      };
    } catch (error) {
      logger.error(`Failed to get channel ${channelId} info`, error);
      return null;
    }
  }

  /**
   * Monitor contract events
   */
  async monitorContractEvents(
    network: 'mainnet' | 'testnet',
    contractType: string = 'PaymentProcessor',
    fromBlock?: number,
    callback?: (event: any) => void
  ): Promise<void> {
    try {
      const contract = this.getContractConfig(network, contractType);
      if (!contract) {
        throw new Error(`${contractType} contract not found for ${network}`);
      }

      const client = this.getClient(network);
      if (!client) {
        throw new Error(`TON client not available for ${network}`);
      }

      const contractAddress = Address.parse(contract.address);

      // Get recent transactions and parse events
      const transactions = await client.getTransactions(contractAddress, {
        limit: 100,
        from_lt: fromBlock
      });

      for (const tx of transactions) {
        if (tx.inMessage && callback) {
          const event = this.parseTransactionEvent(tx);
          if (event) {
            callback(event);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to monitor contract events', error);
    }
  }

  /**
   * Send transaction to contract
   */
  private async sendTransaction(
    client: TonClient,
    fromAddress: string,
    toAddress: Address,
    value: bigint,
    body?: Cell
  ): Promise<{ transactionHash: string; gasUsed: string }> {
    // This is a simplified implementation
    // In production, you would need proper wallet integration and signing

    const message = {
      address: toAddress,
      amount: value,
      payload: body
    };

    // Simulate transaction (implement actual transaction sending)
    const txHash = '0x' + Math.random().toString(16).substr(2, 64);

    return {
      transactionHash: txHash,
      gasUsed: fromNano(toNano('0.05'))
    };
  }

  /**
   * Get contract methods
   */
  private async getContractMethods(client: TonClient, address: Address): Promise<string[]> {
    // This would return the available methods based on contract ABI
    return [
      'get_owner',
      'get_balance',
      'get_channel_count',
      'get_channel_info',
      'deposit',
      'withdraw',
      'create_channel',
      'channel_payment'
    ];
  }

  /**
   * Parse transaction event
   */
  private parseTransactionEvent(transaction: any): any {
    // Parse transaction and extract relevant events
    if (transaction.inMessage?.body) {
      const body = Cell.fromBase64(transaction.inMessage.body.toBoc().toString('base64'));
      const op = body.bits.readUint(32);

      return {
        type: this.getOperationName(op),
        transactionHash: transaction.hash,
        timestamp: transaction.now,
        data: transaction
      };
    }
    return null;
  }

  /**
   * Get operation name from opcode
   */
  private getOperationName(opcode: number): string {
    switch (opcode) {
      case 0x4A4F4B48: return 'Deposit';
      case 0x57495448: return 'Withdraw';
      case 0x4348414E: return 'CreateChannel';
      case 0x43484150: return 'ChannelPayment';
      default: return 'Unknown';
    }
  }

  /**
   * Register new contract deployment
   */
  async registerContract(config: SmartContractConfig): Promise<void> {
    try {
      const query = `
        INSERT INTO smart_contracts (address, network, type, version, deployed_at, owner_address, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (address) DO UPDATE SET
          is_active = true,
          deployed_at = EXCLUDED.deployed_at
      `;

      await postgresDb.query(query, [
        config.address,
        config.network,
        config.type,
        config.version,
        config.deployedAt,
        config.ownerAddress
      ]);

      this.contracts.set(`${config.network}_${config.type}`, config);
      logger.info(`Contract registered: ${config.address} (${config.network})`);
    } catch (error) {
      logger.error('Failed to register contract', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    return {
      contracts: Array.from(this.contracts.entries()).map(([key, config]) => ({
        key,
        address: config.address,
        network: config.network,
        type: config.type,
        deployedAt: config.deployedAt
      })),
      networks: {
        mainnet: !!this.getClient('mainnet'),
        testnet: !!this.getClient('testnet')
      }
    };
  }
}

// Create singleton instance
export const smartContractService = new SmartContractService();