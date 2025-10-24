import "@stdlib/deploy";
import "@stdlib/stoppable";

message Deposit {
    amount: Int;
    recipient: Address;
}

message Withdraw {
    amount: Int;
    recipient: Address;
}

message CreateChannel {
    participant: Address;
    capacity: Int;
    duration: UInt32;
}

message ChannelPayment {
    channelId: UInt32;
    amount: Int;
    recipient: Address;
}

@name(PaymentProcessor)
contract PaymentProcessor with Deployable, Stoppable {
    owner: Address;
    balance: Int = 0;
    channelCount: UInt32 = 0;

    // Channel storage (simplified - in production use proper map)
    struct ChannelInfo {
        participant: Address;
        capacity: Int;
        expiry: UInt64;
        spent: Int;
    }

    channels: map<UInt32, ChannelInfo>;

    init(owner: Address) {
        self.owner = owner;
    }

    // Receive TON and treat as USDT deposit
    receive(msg: Deposit) {
        self.requireOwner();

        // Update contract balance
        self.balance += msg.amount;

        // Send notification to recipient
        send(SendParameters{
            to: msg.recipient,
            value: 0,
            mode: SendIgnoreErrors,
            body: "DepositReceived" + msg.amount.toString(),
            bounce: false
        });
    }

    // Withdraw funds (with fees for external transfers)
    receive(msg: Withdraw) {
        self.requireOwner();
        require(msg.amount <= self.balance, 410, "Insufficient balance");

        self.balance -= msg.amount;

        send(SendParameters{
            to: msg.recipient,
            value: msg.amount,
            mode: SendPayGasSeparately + SendIgnoreErrors,
            body: "Withdrawal",
            bounce: false
        });
    }

    // Create payment channel for zero-fee transfers
    receive(msg: CreateChannel) {
        self.requireOwner();
        require(msg.capacity <= self.balance, 410, "Insufficient balance for channel");

        // Lock funds for channel
        self.balance -= msg.capacity;
        self.channelCount += 1;

        // Store channel info
        self.channels.set(self.channelCount, ChannelInfo{
            participant: msg.participant,
            capacity: msg.capacity,
            expiry: now() + msg.duration,
            spent: 0
        });

        // Notify participant
        send(SendParameters{
            to: msg.participant,
            value: 0,
            mode: SendIgnoreErrors,
            body: "ChannelCreated" + self.channelCount.toString(),
            bounce: false
        });
    }

    // Zero-fee channel payment
    receive(msg: ChannelPayment) {
        self.requireOwner();

        let channel = self.channels.get(msg.channelId);
        require(channel != null, 404, "Channel not found");

        let channelInfo = channel!!;
        require(now() < channelInfo.expiry, 410, "Channel expired");
        require(channelInfo.spent + msg.amount <= channelInfo.capacity, 410, "Channel capacity exceeded");

        // Update spent amount
        channelInfo.spent += msg.amount;
        self.channels.set(msg.channelId, channelInfo);

        // Send notification (no fee)
        send(SendParameters{
            to: msg.recipient,
            value: 0,
            mode: SendIgnoreErrors,
            body: "ChannelPayment" + msg.amount.toString(),
            bounce: false
        });
    }

    // Close channel and return remaining funds
    receive(channelId: UInt32) {
        self.requireOwner();

        let channel = self.channels.get(channelId);
        require(channel != null, 404, "Channel not found");

        let channelInfo = channel!!;

        // Return remaining capacity to balance
        let remaining = channelInfo.capacity - channelInfo.spent;
        self.balance += remaining;

        // Remove channel
        self.channels.delete(channelId);

        // Send remaining funds to participant
        if (remaining > 0) {
            send(SendParameters{
                to: channelInfo.participant,
                value: remaining,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                body: "ChannelClosed",
                bounce: false
            });
        }
    }

    // Get contract info
    get fun getOwner(): Address {
        return self.owner;
    }

    get fun getBalance(): Int {
        return self.balance;
    }

    get fun getChannelCount(): UInt32 {
        return self.channelCount;
    }

    get fun getChannelInfo(channelId: UInt32): ChannelInfo? {
        return self.channels.get(channelId);
    }

    // Owner check
    inline fun requireOwner() {
        require(sender() == self.owner, 401, "Unauthorized");
    }

    // Receive plain TON
    receive() {
        // Accept deposits
        self.balance += ctx.value();
    }
}