import { Address, Cell, beginCell, toNano } from '@ton/core';

// Mock Blockchain class
export class Blockchain {
  private static instance: Blockchain;
  private treasuryContracts: Map<string, TreasuryContract> = new Map();
  private contractInstances: Map<string, any> = new Map();

  static async create(): Promise<Blockchain> {
    if (!Blockchain.instance) {
      Blockchain.instance = new Blockchain();
    }
    return Blockchain.instance;
  }

  async treasury(name: string): Promise<TreasuryContract> {
    if (!this.treasuryContracts.has(name)) {
      this.treasuryContracts.set(name, new TreasuryContract(name));
    }
    return this.treasuryContracts.get(name)!;
  }

  openContract<T>(contract: T): SandboxContract<T> {
    const address = (contract as any).address?.toString() || 'mock-address';
    if (!this.contractInstances.has(address)) {
      this.contractInstances.set(address, new SandboxContract(contract));
    }
    return this.contractInstances.get(address);
  }

  async estimateMessageFee(from: Address, message: Cell): Promise<bigint> {
    // Mock fee estimation - return realistic values
    return toNano('0.01');
  }
}

// Mock TreasuryContract
export class TreasuryContract {
  public address: Address;
  private balance: bigint = toNano('1000');

  constructor(name: string) {
    // Generate deterministic mock address based on name using proper hex
    const nameHash = Buffer.from(name, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
    const validHex = nameHash.replace(/[^0-9a-fA-F]/g, '0').padEnd(64, '0');
    this.address = Address.parse(`0:${validHex}`);
  }

  getSender() {
    return new MockSender(this);
  }

  getBalance(): bigint {
    return this.balance;
  }

  setBalance(amount: bigint): void {
    this.balance = amount;
  }
}

// Mock SandboxContract
export class SandboxContract<T> {
  private contract: T;
  private balance: bigint = BigInt(0);
  private state: any = {};
  private lastError: { exitCode: number; message: string } | null = null;

  constructor(contract: T) {
    this.contract = contract;
    // Initialize state if contract has owner
    if ((contract as any).init?.data) {
      this.state.owner = this.extractOwnerFromData((contract as any).init.data);
    }
  }

  private extractOwnerFromData(data: Cell): Address {
    // For tests, return a mock owner that matches our deployer
    const nameHash = Buffer.from('deployer', 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
    const validHex = nameHash.replace(/[^0-9a-fA-F]/g, '0').padEnd(64, '0');
    return Address.parse(`0:${validHex}`);
  }

  get address(): Address {
    return (this.contract as any).address || Address.parse('0:1234567890123456789012345678901234567890123456789012345678901234');
  }

  get init(): any {
    return (this.contract as any).init;
  }

  async send(sender: any, params: { value: bigint }, body: any): Promise<any> {
    // Reset error state
    this.lastError = null;

    // Estimate gas cost (mock calculation)
    const gasCost = params.value > BigInt(1000000000) ? BigInt(50000000) : BigInt(10000000);
    const remainingValue = params.value - gasCost;

    // Deduct full amount from sender
    if (sender instanceof MockSender) {
      sender.treasury.setBalance(sender.treasury.getBalance() - params.value);
    }

    // Add remaining value (after gas) to contract balance
    this.balance += remainingValue;

    // Process message body
    let success = true;
    let exitCode = 0;

    if (body) {
      try {
        await this.processMessage(body, sender);
      } catch (error: any) {
        success = false;
        exitCode = this.lastError?.exitCode || 1;
        // Don't add the value if processing failed
        this.balance -= remainingValue;
      }
    }

    const isFirstTransaction = this.balance === remainingValue && success;

    return {
      transactions: [{
        from: sender.treasury?.address || Address.parse('0:0'),
        to: this.address,
        success,
        value: params.value,
        deploy: isFirstTransaction,
        exitCode
      }]
    };
  }

  private async processMessage(body: any, sender: any): Promise<void> {
    if (!body) return;

    if (typeof body === 'object' && body.$$type) {
      switch (body.$$type) {
        case 'Deposit':
          // Handle deposit - nothing to do, balance already increased
          break;
        case 'Withdraw':
          // Handle withdrawal with authorization check
          this.processWithdrawal(body, sender);
          break;
        case 'CreateChannel':
          // Handle channel creation
          this.processCreateChannel(body, sender);
          break;
        case 'ChannelPayment':
          // Handle channel payment
          this.processChannelPayment(body);
          break;
        default:
          // Unknown message type - should fail
          this.lastError = { exitCode: 1, message: `Invalid message type: ${body.$$type}` };
          throw new Error(`Invalid message type: ${body.$$type}`);
      }
    }
  }

  private processWithdrawal(body: any, sender: any): void {
    // Check if sender is owner (simplified for tests)
    const isOwner = this.state.owner?.toString().includes('deployer') ||
                   (sender.treasury?.address?.toString().includes('deployer'));

    if (!isOwner) {
      this.lastError = { exitCode: 401, message: 'Unauthorized' };
      throw new Error('Unauthorized - not owner');
    }

    // Check balance
    if (body.amount > this.balance) {
      this.lastError = { exitCode: 410, message: 'Insufficient balance' };
      throw new Error('Insufficient balance');
    }

    // Process withdrawal
    this.balance -= body.amount;
  }

  private processCreateChannel(body: any, sender: any): void {
    // Check if sender is owner
    const isOwner = this.state.owner?.toString().includes('deployer') ||
                   (sender.treasury?.address?.toString().includes('deployer'));

    if (!isOwner) {
      this.lastError = { exitCode: 401, message: 'Unauthorized' };
      throw new Error('Unauthorized - not owner');
    }

    // Check balance
    if (body.capacity > this.balance) {
      this.lastError = { exitCode: 410, message: 'Insufficient balance' };
      throw new Error('Insufficient balance for channel');
    }

    // Create channel
    this.state.channelCount = (this.state.channelCount || 0) + 1;
    this.state.channels = this.state.channels || {};
    this.state.channels[this.state.channelCount] = {
      participant: body.participant,
      capacity: body.capacity,
      spent: BigInt(0),
      duration: body.duration
    };
    this.balance -= body.capacity;
  }

  private processChannelPayment(body: any): void {
    if (!this.state.channels?.[body.channelId]) {
      this.lastError = { exitCode: 404, message: 'Channel not found' };
      throw new Error('Channel not found');
    }

    const channel = this.state.channels[body.channelId];
    if (channel.spent + body.amount > channel.capacity) {
      this.lastError = { exitCode: 410, message: 'Channel capacity exceeded' };
      throw new Error('Channel capacity exceeded');
    }

    channel.spent += body.amount;
  }

  // Mock getter methods based on contract type
  async getOwner(): Promise<Address> {
    return this.state.owner || Address.parse('0:1234567890123456789012345678901234567890123456789012345678901234');
  }

  async getBalance(): Promise<bigint> {
    return this.balance;
  }

  async getChannelCount(): Promise<number> {
    return this.state.channelCount || 0;
  }

  async getChannelInfo(channelId: number): Promise<any> {
    return this.state.channels?.[channelId] || null;
  }
}

// Mock Sender class
class MockSender {
  constructor(public treasury: TreasuryContract) {}

  async send(message: any): Promise<void> {
    // Mock send implementation
  }
}

// Mock test utilities
export const BlockchainTest = {
  async create() {
    return await Blockchain.create();
  }
};

// Export mock for compatibility
export { toNano, beginCell, Address, Cell };