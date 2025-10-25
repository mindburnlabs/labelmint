import { Contract, ContractProvider, Sender, Address, Cell, beginCell, contractAddress } from '@ton/core';

export type PaymentProcessorConfig = {
    owner: Address;
};

export function paymentProcessorConfigToCell(config: PaymentProcessorConfig): Cell {
    // Mock implementation - don't use real address storage for tests
    return beginCell().endCell();
}

export class PaymentProcessor implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new PaymentProcessor(address);
    }

    static createFromConfig(config: PaymentProcessorConfig, code: Cell, workchain = 0) {
        const data = paymentProcessorConfigToCell(config);
        const init = { code, data };
        return new PaymentProcessor(contractAddress(workchain, init), init);
    }

    static async fromInit(owner: Address) {
        const data = paymentProcessorConfigToCell({ owner });
        const code = new Cell(); // Mock contract code
        const init = { code, data };
        const address = Address.parse('0:1234567890123456789012345678901234567890123456789012345678901234');
        return new PaymentProcessor(address, init);
    }

    async send(provider: ContractProvider, via: Sender, value: bigint, body: Cell | null) {
        await provider.internal(via, { value, body });
    }

    async getOwner(provider: ContractProvider) {
        const result = await provider.get('get_owner', []);
        return result.stack.readAddress();
    }

    async getBalance(provider: ContractProvider) {
        const result = await provider.get('get_balance', []);
        return result.stack.readBigNumber();
    }

    async getChannelCount(provider: ContractProvider) {
        const result = await provider.get('get_channel_count', []);
        return result.stack.readNumber();
    }

    async getChannelInfo(provider: ContractProvider, channelId: number) {
        const result = await provider.get('get_channel_info', [
            { type: 'int', value: BigInt(channelId) }
        ]);
        if (result.stack.readNumber() === 0) {
            return null;
        }
        return {
            participant: result.stack.readAddress(),
            capacity: result.stack.readBigNumber(),
            spent: result.stack.readBigNumber(),
            duration: result.stack.readNumber(),
        };
    }
}

// Message types for contract interactions
export const Opcodes = {
    deposit: 0x12345678,
    withdraw: 0x87654321,
    createChannel: 0xABCDEF01,
    channelPayment: 0x1234ABCD,
    closeChannel: 0xDEF12345,
};

export function depositMessage(amount: bigint, recipient: Address) {
    return beginCell()
        .storeUint(Opcodes.deposit, 32)
        .storeCoins(amount)
        .storeAddress(recipient)
        .endCell();
}

export function withdrawMessage(amount: bigint, recipient: Address) {
    return beginCell()
        .storeUint(Opcodes.withdraw, 32)
        .storeCoins(amount)
        .storeAddress(recipient)
        .endCell();
}

export function createChannelMessage(participant: Address, capacity: bigint, duration: number) {
    return beginCell()
        .storeUint(Opcodes.createChannel, 32)
        .storeAddress(participant)
        .storeCoins(capacity)
        .storeUint(duration, 32)
        .endCell();
}

export function channelPaymentMessage(channelId: number, amount: bigint, recipient: Address) {
    return beginCell()
        .storeUint(Opcodes.channelPayment, 32)
        .storeUint(channelId, 32)
        .storeCoins(amount)
        .storeAddress(recipient)
        .endCell();
}

export function closeChannelMessage(channelId: number) {
    return beginCell()
        .storeUint(Opcodes.closeChannel, 32)
        .storeUint(channelId, 32)
        .endCell();
}