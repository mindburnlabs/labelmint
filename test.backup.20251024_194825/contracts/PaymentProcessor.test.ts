import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PaymentProcessor, MockUSDT } from '../typechain-types'

describe('PaymentProcessor', () => {
  let paymentProcessor: PaymentProcessor
  let mockUSDT: MockUSDT
  let owner: SignerWithAddress
  let client: SignerWithAddress
  let worker: SignerWithAddress
  let addrs: SignerWithAddress[]

  beforeEach(async () => {
    [owner, client, worker, ...addrs] = await ethers.getSigners()

    // Deploy Mock USDT
    const MockUSDT = await ethers.getContractFactory('MockUSDT')
    mockUSDT = await MockUSDT.deploy('Mock USDT', 'mUSDT', 6) // 6 decimals like real USDT
    await mockUSDT.deployed()

    // Deploy PaymentProcessor
    const PaymentProcessor = await ethers.getContractFactory('PaymentProcessor')
    paymentProcessor = await PaymentProcessor.deploy(
      mockUSDT.address,
      owner.address, // treasury
      500, // 5% fee
      100 // $1 minimum deposit
    )
    await paymentProcessor.deployed()

    // Mint tokens to test accounts
    await mockUSDT.mint(client.address, ethers.utils.parseUnits('10000', 6))
    await mockUSDT.mint(worker.address, ethers.utils.parseUnits('5000', 6))
  })

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      expect(await paymentProcessor.owner()).to.equal(owner.address)
    })

    it('Should set correct USDT address', async () => {
      expect(await paymentProcessor.usdtToken()).to.equal(mockUSDT.address)
    })

    it('Should set initial fee percentage', async () => {
      expect(await paymentProcessor.feePercentage()).to.equal(500)
    })

    it('Should set minimum deposit amount', async () => {
      expect(await paymentProcessor.minimumDeposit()).to.equal(100)
    })
  })

  describe('Deposits', () => {
    it('Should accept USDT deposits', async () => {
      const depositAmount = ethers.utils.parseUnits('1000', 6)

      // Client approves the contract
      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)

      // Client deposits
      await expect(
        paymentProcessor.connect(client).deposit(depositAmount)
      ).to.emit(paymentProcessor, 'Deposit')
        .withArgs(client.address, depositAmount)

      // Check balance
      const balance = await paymentProcessor.balances(client.address)
      expect(balance).to.equal(depositAmount)
    })

    it('Should reject deposits below minimum', async () => {
      const depositAmount = ethers.utils.parseUnits('0.50', 6) // $0.50

      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)

      await expect(
        paymentProcessor.connect(client).deposit(depositAmount)
      ).to.be.revertedWith('Below minimum deposit')
    })

    it('Should reject deposits without approval', async () => {
      const depositAmount = ethers.utils.parseUnits('1000', 6)

      await expect(
        paymentProcessor.connect(client).deposit(depositAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
    })

    it('Should track multiple deposits', async () => {
      const deposit1 = ethers.utils.parseUnits('500', 6)
      const deposit2 = ethers.utils.parseUnits('300', 6)

      await mockUSDT.connect(client).approve(paymentProcessor.address, deposit1.add(deposit2))

      await paymentProcessor.connect(client).deposit(deposit1)
      await paymentProcessor.connect(client).deposit(deposit2)

      const balance = await paymentProcessor.balances(client.address)
      expect(balance).to.equal(deposit1.add(deposit2))
    })
  })

  describe('Withdrawals', () => {
    beforeEach(async () => {
      // Fund client account
      const depositAmount = ethers.utils.parseUnits('1000', 6)
      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)
      await paymentProcessor.connect(client).deposit(depositAmount)
    })

    it('Should allow withdrawals', async () => {
      const withdrawAmount = ethers.utils.parseUnits('400', 6)

      await expect(
        paymentProcessor.connect(client).withdraw(withdrawAmount)
      ).to.emit(paymentProcessor, 'Withdrawal')
        .withArgs(client.address, withdrawAmount)

      // Check balance decreased
      const balance = await paymentProcessor.balances(client.address)
      expect(balance).to.equal(ethers.utils.parseUnits('600', 6))
    })

    it('Should reject withdrawals exceeding balance', async () => {
      const withdrawAmount = ethers.utils.parseUnits('1500', 6)

      await expect(
        paymentProcessor.connect(client).withdraw(withdrawAmount)
      ).to.be.revertedWith('Insufficient balance')
    })

    it('Should allow full balance withdrawal', async () => {
      const balance = await paymentProcessor.balances(client.address)

      await paymentProcessor.connect(client).withdraw(balance)

      expect(await paymentProcessor.balances(client.address)).to.equal(0)
    })
  })

  describe('Task Payments', () => {
    beforeEach(async () => {
      // Fund client account
      const depositAmount = ethers.utils.parseUnits('2000', 6)
      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)
      await paymentProcessor.connect(client).deposit(depositAmount)
    })

    it('Should create task escrow', async () => {
      const taskBudget = ethers.utils.parseUnits('100', 6)
      const workerReward = ethers.utils.parseUnits('80', 6)
      const taskId = 1

      await expect(
        paymentProcessor.connect(client).createTaskEscrow(
          taskId,
          worker.address,
          taskBudget,
          workerReward,
          3600 // 1 hour timeout
        )
      ).to.emit(paymentProcessor, 'TaskCreated')
        .withArgs(taskId, client.address, worker.address, taskBudget)

      // Check escrow
      const escrow = await paymentProcessor.taskEscrows(taskId)
      expect(escrow.client).to.equal(client.address)
      expect(escrow.worker).to.equal(worker.address)
      expect(escrow.budget).to.equal(taskBudget)
      expect(escrow.workerReward).to.equal(workerReward)
      expect(escrow.status).to.equal(0) // Active
    })

    it('Should complete task and pay worker', async () => {
      const taskBudget = ethers.utils.parseUnits('100', 6)
      const workerReward = ethers.utils.parseUnits('80', 6)
      const taskId = 1

      // Create task
      await paymentProcessor.connect(client).createTaskEscrow(
        taskId,
        worker.address,
        taskBudget,
        workerReward,
        3600
      )

      // Complete task
      await expect(
        paymentProcessor.connect(client).completeTask(taskId, true)
      ).to.emit(paymentProcessor, 'TaskCompleted')
        .withArgs(taskId, workerReward)

      // Check worker received payment
      const workerBalance = await paymentProcessor.balances(worker.address)
      expect(workerBalance).to.equal(workerReward)

      // Check fee deducted
      const expectedFee = workerReward.mul(500).div(10000) // 5% fee
      const treasuryBalance = await paymentProcessor.balances(owner.address)
      expect(treasuryBalance).to.equal(expectedFee)
    })

    it('Should refund client on task failure', async () => {
      const taskBudget = ethers.utils.parseUnits('100', 6)
      const workerReward = ethers.utils.parseUnits('80', 6)
      const taskId = 1

      // Create task
      await paymentProcessor.connect(client).createTaskEscrow(
        taskId,
        worker.address,
        taskBudget,
        workerReward,
        3600
      )

      const initialBalance = await paymentProcessor.balances(client.address)

      // Fail task
      await paymentProcessor.connect(client).completeTask(taskId, false)

      // Check refund
      const finalBalance = await paymentProcessor.balances(client.address)
      expect(finalBalance).to.equal(initialBalance.add(taskBudget))
    })

    it('Should handle task timeout', async () => {
      const taskBudget = ethers.utils.parseUnits('100', 6)
      const workerReward = ethers.utils.parseUnits('80', 6)
      const taskId = 1

      // Create task with 1 second timeout
      await paymentProcessor.connect(client).createTaskEscrow(
        taskId,
        worker.address,
        taskBudget,
        workerReward,
        1
      )

      // Wait for timeout
      await ethers.provider.send('evm_increaseTime', [2])
      await ethers.provider.send('evm_mine', [])

      // Anyone can trigger timeout
      await expect(
        paymentProcessor.connect(addrs[0]).handleTaskTimeout(taskId)
      ).to.emit(paymentProcessor, 'TaskTimedOut')

      // Check refund to client
      const escrow = await paymentProcessor.taskEscrows(taskId)
      expect(escrow.status).to.equal(2) // TimedOut
    })
  })

  describe('Batch Operations', () => {
    beforeEach(async () => {
      // Fund client account
      const depositAmount = ethers.utils.parseUnits('5000', 6)
      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)
      await paymentProcessor.connect(client).deposit(depositAmount)
    })

    it('Should process batch payments', async () => {
      const recipients = [worker.address, addrs[0].address, addrs[1].address]
      const amounts = [
        ethers.utils.parseUnits('100', 6),
        ethers.utils.parseUnits('150', 6),
        ethers.utils.parseUnits('200', 6)
      ]
      const totalAmount = amounts.reduce((a, b) => a.add(b), ethers.BigNumber.from(0))

      await expect(
        paymentProcessor.connect(client).batchPayment(recipients, amounts, 'Batch task rewards')
      ).to.emit(paymentProcessor, 'BatchPaymentProcessed')

      // Check all recipients received payments
      for (let i = 0; i < recipients.length; i++) {
        const balance = await paymentProcessor.balances(recipients[i])
        expect(balance).to.equal(amounts[i])
      }
    })

    it('Should reject mismatched arrays', async () => {
      const recipients = [worker.address, addrs[0].address]
      const amounts = [ethers.utils.parseUnits('100', 6)] // Mismatched length

      await expect(
        paymentProcessor.connect(client).batchPayment(recipients, amounts, 'Test')
      ).to.be.revertedWith('Array length mismatch')
    })
  })

  describe('Owner Functions', () => {
    it('Should update fee percentage', async () => {
      await expect(
        paymentProcessor.connect(owner).updateFeePercentage(300) // 3%
      ).to.emit(paymentProcessor, 'FeeUpdated')
        .withArgs(500, 300)

      expect(await paymentProcessor.feePercentage()).to.equal(300)
    })

    it('Should update minimum deposit', async () => {
      await paymentProcessor.connect(owner).updateMinimumDeposit(200) // $2

      expect(await paymentProcessor.minimumDeposit()).to.equal(200)
    })

    it('Should withdraw treasury funds', async () => {
      // Generate some fees
      const taskBudget = ethers.utils.parseUnits('100', 6)
      const workerReward = ethers.utils.parseUnits('80', 6)

      await mockUSDT.connect(client).approve(paymentProcessor.address, taskBudget)
      await paymentProcessor.connect(client).deposit(taskBudget)

      await paymentProcessor.connect(client).createTaskEscrow(1, worker.address, taskBudget, workerReward, 3600)
      await paymentProcessor.connect(client).completeTask(1, true)

      // Withdraw treasury
      const treasuryBalance = await paymentProcessor.balances(owner.address)
      await paymentProcessor.connect(owner).withdrawTreasury(treasuryBalance)

      expect(await paymentProcessor.balances(owner.address)).to.equal(0)
    })

    it('Should reject non-owner owner functions', async () => {
      await expect(
        paymentProcessor.connect(client).updateFeePercentage(300)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('Emergency Functions', () => {
    it('Should allow emergency withdrawal by owner', async () => {
      // Fund client account
      const depositAmount = ethers.utils.parseUnits('1000', 6)
      await mockUSDT.connect(client).approve(paymentProcessor.address, depositAmount)
      await paymentProcessor.connect(client).deposit(depositAmount)

      // Emergency withdrawal
      const contractBalance = await mockUSDT.balanceOf(paymentProcessor.address)

      await expect(
        paymentProcessor.connect(owner).emergencyWithdraw(mockUSDT.address)
      ).to.emit(paymentProcessor, 'EmergencyWithdraw')

      // Contract should be empty
      expect(await mockUSDT.balanceOf(paymentProcessor.address)).to.equal(0)
    })

    it('Should pause and unpause contract', async () => {
      await paymentProcessor.connect(owner).pause()

      await expect(
        paymentProcessor.connect(client).deposit(ethers.utils.parseUnits('100', 6))
      ).to.be.revertedWith('Pausable: paused')

      await paymentProcessor.connect(owner).unpause()

      // Should work again
      await mockUSDT.connect(client).approve(paymentProcessor.address, ethers.utils.parseUnits('100', 6))
      await paymentProcessor.connect(client).deposit(ethers.utils.parseUnits('100', 6))
    })
  })
})