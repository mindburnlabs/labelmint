import { TonClient, HttpApi } from '@ton/ton';
import { Address } from '@ton/core';
import { postgresDb } from '../database';

export interface NetworkConfig {
  name: string;
  rpcEndpoint: string;
  apiKey?: string;
  usdtContractAddress: string;
}

export class TonApiManager {
  private clients: Map<string, TonClient> = new Map();

  constructor() {
    this.initializeClients();
  }

  /**
   * Initialize TON clients for different networks
   */
  private async initializeClients() {
    const networks = await this.getNetworkConfigs();

    for (const network of networks) {
      const api = new HttpApi(network.rpcEndpoint, {
        apiKey: network.apiKey
      });

      const client = new TonClient({
        api,
        endpoint: network.rpcEndpoint
      });

      this.clients.set(network.name, client);
    }
  }

  /**
   * Get network configurations from database
   */
  private async getNetworkConfigs(): Promise<NetworkConfig[]> {
    const query = `
      SELECT name, rpc_endpoint, api_key, usdt_contract_address
      FROM ton_network_configs
    `;

    const result = await postgresDb.query(query);
    return result.rows;
  }

  /**
   * Get TON client for specific network
   */
  async getClient(network: 'mainnet' | 'testnet'): Promise<TonClient> {
    const client = this.clients.get(network);

    if (!client) {
      throw new Error(`Client for network ${network} not initialized`);
    }

    return client;
  }

  /**
   * Get USDT contract address for network
   */
  async getUsdtContractAddress(network: 'mainnet' | 'testnet'): Promise<string> {
    const query = `
      SELECT usdt_contract_address
      FROM ton_network_configs
      WHERE name = $1
    `;

    const result = await postgresDb.query(query, [network]);

    if (!result.rows.length) {
      throw new Error(`USDT contract address not found for network ${network}`);
    }

    return result.rows[0].usdt_contract_address;
  }

  /**
   * Switch between networks
   */
  async switchNetwork(network: 'mainnet' | 'testnet') {
    // Update active network in database
    await postgresDb.query(`
      UPDATE ton_network_configs
      SET is_active = CASE
        WHEN name = $1 THEN true
        ELSE false
      END
    `, [network]);

    // Reinitialize clients
    this.clients.clear();
    await this.initializeClients();
  }

  /**
   * Get transaction information
   */
  async getTransactionInfo(
    txHash: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ) {
    const client = await this.getClient(network);

    try {
      // Parse transaction hash and get info
      const result = await client.runMethod(
        Address.parse(txHash.split(':')[0]),
        'get_transaction_info'
      );

      return result;

    } catch (error) {
      console.error('Error getting transaction info:', error);
      throw error;
    }
  }

  /**
   * Check if address is valid
   */
  async isValidAddress(address: string): Promise<boolean> {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(address: string, network: 'mainnet' | 'testnet' = 'testnet') {
    const client = await this.getClient(network);
    const parsedAddress = Address.parse(address);

    return await client.getAccount(parsedAddress);
  }
}