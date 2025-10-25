#!/bin/bash
# LabelMint Smart Contract Build Script

set -e

echo "🔨 Building LabelMint Smart Contracts..."

# Check if required tools are available
if ! command -v func &> /dev/null; then
    echo "❌ TON FunC compiler (func) not found"
    echo "Please install TON SDK: https://github.com/ton-blockchain/ton"
    exit 1
fi

if ! command -v fift &> /dev/null; then
    echo "❌ Fift interpreter (fift) not found"
    echo "Please install TON SDK: https://github.com/ton-blockchain/ton"
    exit 1
fi

# Create output directory
mkdir -p output

echo "📝 Compiling PaymentProcessor.fc..."

# Compile the FunC contract
func -o output/PaymentProcessor.fif -SPA contracts/PaymentProcessor.fc

if [ $? -eq 0 ]; then
    echo "✅ Contract compiled successfully"
else
    echo "❌ Contract compilation failed"
    exit 1
fi

echo "🏗️ Generating contract files..."

# Generate the contract code cell
fift -s output/PaymentProcessor.fif

# Create wrapper TypeScript files
cat > output/PaymentProcessor.ts << 'EOF'
/**
 * LabelMint PaymentProcessor Smart Contract
 * Enhanced TON smart contract with USDT support and security features
 */

import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export interface DepositMessage {
    amount: bigint;
    recipient: Address;
}

export interface WithdrawMessage {
    amount: bigint;
    recipient: Address;
    currency: number; // 0 = TON, 1 = USDT
}

export interface CreateChannelMessage {
    participant: Address;
    capacity: bigint;
    duration: number;
}

export interface ChannelPaymentMessage {
    channelId: number;
    amount: bigint;
    recipient: Address;
}

export interface EmergencyWithdrawMessage {
    amount: bigint;
    recipient: Address;
    isUsdt: boolean;
}

export class PaymentProcessor implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static fromAddress(address: Address) {
        return new PaymentProcessor(address);
    }

    static fromInit(owner: Address) {
        const data = beginCell()
            .storeAddress(owner)
            .storeUint(0, 1) // paused
            .storeCoins(0) // ton_balance
            .storeCoins(0) // usdt_balance
            .storeUint(0, 32) // channel_count
            .storeUint(1, 1) // emergency_enabled
            .endCell();

        // Note: In production, load the compiled code cell
        const code = new Cell(); // Placeholder - would load compiled code

        const workchain = 0;
        const address = contractAddress(workchain, { code, data });

        return new PaymentProcessor(address, { code, data });
    }

    async sendDeposit(provider: ContractProvider, via: Sender, message: DepositMessage) {
        const body = beginCell()
            .storeUint(0x4e4f5445, 32) // deposit op
            .storeCoins(message.amount)
            .storeAddress(message.recipient)
            .endCell();

        await provider.internal(via, {
            value: '0', // Only for owner operations
            body,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender, message: WithdrawMessage) {
        const body = beginCell()
            .storeUint(0x5749544844, 32) // withdraw op
            .storeCoins(message.amount)
            .storeAddress(message.recipient)
            .storeUint(message.currency, 8)
            .endCell();

        await provider.internal(via, {
            value: '0.1', // Small amount for gas
            body,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });
    }

    async sendEmergencyPause(provider: ContractProvider, via: Sender) {
        const body = beginCell()
            .storeUint(0x5041555345, 32) // emergency_pause op
            .endCell();

        await provider.internal(via, {
            value: '0.05',
            body,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });
    }

    async sendEmergencyWithdraw(provider: ContractProvider, via: Sender, message: EmergencyWithdrawMessage) {
        const body = beginCell()
            .storeUint(0x45574d4752, 32) // emergency_withdraw op
            .storeCoins(message.amount)
            .storeAddress(message.recipient)
            .storeUint(message.isUsdt ? 1 : 0, 1)
            .endCell();

        await provider.internal(via, {
            value: message.amount.toString(),
            body,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, newOwner: Address) {
        const body = beginCell()
            .storeUint(0x4f574e4552, 32) // change_owner op
            .storeAddress(newOwner)
            .endCell();

        await provider.internal(via, {
            value: '0.05',
            body,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });
    }

    async getOwner(provider: ContractProvider) {
        const result = await provider.get('get_owner', []);
        return result.stack.readAddress();
    }

    async getTonBalance(provider: ContractProvider) {
        const result = await provider.get('get_ton_balance', []);
        return result.stack.readBigNumber();
    }

    async getUsdtBalance(provider: ContractProvider) {
        const result = await provider.get('get_usdt_balance', []);
        return result.stack.readBigNumber();
    }

    async getChannelCount(provider: ContractProvider) {
        const result = await provider.get('get_channel_count', []);
        return result.stack.readNumber();
    }

    async getContractStatus(provider: ContractProvider) {
        const result = await provider.get('get_contract_status', []);
        const paused = result.stack.readNumber();
        const emergencyEnabled = result.stack.readNumber();
        const channelCount = result.stack.readNumber();

        return {
            paused: paused === 1,
            emergencyEnabled: emergencyEnabled === 1,
            channelCount
        };
    }
}

EOF

echo "📄 Creating deployment configuration..."

# Create deployment configuration
cat > output/deploy-config.json << 'EOF'
{
  "PaymentProcessor": {
    "name": "PaymentProcessor",
    "description": "Enhanced TON payment processor with USDT support and security features",
    "version": "1.1.0",
    "features": [
      "USDT Jetton support",
      "Emergency pause/resume",
      "Owner-only operations",
      "Payment channels",
      "Enhanced security"
    ],
    "networks": {
      "testnet": {
        "explorer": "https://testnet.tonscan.org/address/",
        "rpc": "https://testnet.toncenter.com/api/v2/jsonRPC"
      },
      "mainnet": {
        "explorer": "https://tonscan.org/address/",
        "rpc": "https://toncenter.com/api/v2/jsonRPC"
      }
    },
    "security": {
      "ownerOnlyOperations": ["deposit", "withdraw", "create_channel", "emergency_pause", "change_owner"],
      "emergencyOperations": ["emergency_withdraw", "change_owner"],
      "pauseable": true,
      "upgradable": false
    }
  }
}
EOF

echo "✅ Build completed successfully!"
echo "📂 Output files:"
ls -la output/

echo ""
echo "🚀 Ready for deployment with:"
echo "   - npm run contracts:deploy:testnet"
echo "   - npm run contracts:deploy:mainnet"