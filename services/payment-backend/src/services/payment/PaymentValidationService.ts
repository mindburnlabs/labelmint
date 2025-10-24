import { PaymentType, Transaction } from './interfaces/PaymentStrategy';
import { postgresDb } from '../../database';
import { Logger } from '../../utils/logger';

const logger = new Logger('PaymentValidationService');

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TransferValidationParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenType: PaymentType;
  userId?: number;
  memo?: string;
}

export interface Limits {
  minTransferAmount: Record<PaymentType, number>;
  maxTransferAmount: Record<PaymentType, number>;
  dailyTransferLimit: Record<PaymentType, number>;
  hourlyTransferLimit: Record<PaymentType, number>;
  maxTransfersPerHour: number;
  maxTransfersPerDay: number;
}

export class PaymentValidationService {
  private readonly VALIDATION_LIMITS: Limits = {
    minTransferAmount: {
      TON: 0.001, // 0.001 TON minimum
      USDT: 0.01, // 0.01 USDT minimum
      PAYMENT_CHANNEL: 0.001
    },
    maxTransferAmount: {
      TON: 10000, // 10,000 TON maximum per transaction
      USDT: 100000, // 100,000 USDT maximum per transaction
      PAYMENT_CHANNEL: 10000
    },
    dailyTransferLimit: {
      TON: 50000, // 50,000 TON per day
      USDT: 500000, // 500,000 USDT per day
      PAYMENT_CHANNEL: 50000
    },
    hourlyTransferLimit: {
      TON: 10000, // 10,000 TON per hour
      USDT: 100000, // 100,000 USDT per hour
      PAYMENT_CHANNEL: 10000
    },
    maxTransfersPerHour: 50,
    maxTransfersPerDay: 500
  };

  private readonly BLACKLISTED_ADDRESSES = new Set<string>();
  private readonly SANCTIONED_ADDRESSES = new Set<string>();

  constructor() {
    this.loadBlacklist();
    this.loadSanctionsList();
  }

  /**
   * Validate transfer request
   */
  async validateTransfer(params: TransferValidationParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validations
    const addressValidation = this.validateAddresses(params.fromAddress, params.toAddress);
    errors.push(...addressValidation.errors);
    warnings.push(...addressValidation.warnings);

    const amountValidation = this.validateAmount(params.amount, params.tokenType);
    errors.push(...amountValidation.errors);
    warnings.push(...amountValidation.warnings);

    // User-specific validations
    if (params.userId) {
      const limitValidation = await this.validateUserLimits(params.userId, params);
      errors.push(...limitValidation.errors);
      warnings.push(...limitValidation.warnings);
    }

    // Security validations
    const securityValidation = await this.validateSecurity(params);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);

    // Memo validation
    if (params.memo) {
      const memoValidation = this.validateMemo(params.memo);
      errors.push(...memoValidation.errors);
      warnings.push(...memoValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate TON address format
   */
  validateTonAddress(address: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic format validation
      if (!address.startsWith('EQ') && !address.startsWith('0Q')) {
        errors.push('Invalid TON address format: must start with EQ or 0Q');
      }

      if (address.length !== 66) {
        errors.push('Invalid TON address length: must be 66 characters');
      }

      // Check for valid hex characters
      const hexPart = address.startsWith('0Q') ? address.slice(2) : address.slice(2);
      if (!/^[a-fA-F0-9]+$/.test(hexPart)) {
        errors.push('Invalid TON address: contains non-hexadecimal characters');
      }

      // Check for common test patterns
      if (address === 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' ||
          address === '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c') {
        warnings.push('Using zero address - this might not be intentional');
      }

      // Check if address is blacklisted
      if (this.BLACKLISTED_ADDRESSES.has(address)) {
        errors.push('Address is blacklisted');
      }

      // Check if address is sanctioned
      if (this.SANCTIONED_ADDRESSES.has(address)) {
        errors.push('Address is on sanctions list');
      }
    } catch (error) {
      errors.push(`Address validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate amount for transfer
   */
  validateAmount(amount: number, tokenType: PaymentType): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if amount is positive
    if (amount <= 0) {
      errors.push('Transfer amount must be positive');
    }

    // Check minimum amount
    const minAmount = this.VALIDATION_LIMITS.minTransferAmount[tokenType];
    if (amount < minAmount) {
      errors.push(`Minimum transfer amount for ${tokenType} is ${minAmount}`);
    }

    // Check maximum amount
    const maxAmount = this.VALIDATION_LIMITS.maxTransferAmount[tokenType];
    if (amount > maxAmount) {
      errors.push(`Maximum transfer amount for ${tokenType} is ${maxAmount}`);
    }

    // Check for suspicious amounts
    if (amount === 0.00000001) {
      warnings.push('Very small transfer amount - might be dust');
    }

    if (Number.isInteger(amount) && tokenType === 'USDT') {
      warnings.push('Integer USDT amount - please check if you intended to send whole USDT');
    }

    // Check precision
    const decimals = tokenType === 'TON' ? 9 : 6;
    const amountStr = amount.toString();
    const decimalPart = amountStr.split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      errors.push(`Amount precision exceeds ${tokenType} decimals (${decimals})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate user transfer limits
   */
  async validateUserLimits(
    userId: number,
    params: TransferValidationParams
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get user's recent transfers
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Hourly limits
      const hourlyQuery = `
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = $1
        AND token_type = $2
        AND status = 'confirmed'
        AND created_at >= $3
      `;

      const hourlyResult = await postgresDb.query(hourlyQuery, [
        userId,
        params.tokenType,
        hourAgo
      ]);

      const hourlyCount = parseInt(hourlyResult.rows[0].count);
      const hourlyTotal = parseFloat(hourlyResult.rows[0].total);

      if (hourlyCount >= this.VALIDATION_LIMITS.maxTransfersPerHour) {
        errors.push(`Hourly transfer limit exceeded (${hourlyCount}/${this.VALIDATION_LIMITS.maxTransfersPerHour})`);
      }

      const hourlyLimit = this.VALIDATION_LIMITS.hourlyTransferLimit[params.tokenType];
      if (hourlyTotal + params.amount > hourlyLimit) {
        errors.push(`Hourly amount limit would be exceeded (${hourlyTotal + params.amount}/${hourlyLimit})`);
      }

      // Daily limits
      const dailyQuery = `
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = $1
        AND token_type = $2
        AND status = 'confirmed'
        AND created_at >= $3
      `;

      const dailyResult = await postgresDb.query(dailyQuery, [
        userId,
        params.tokenType,
        dayAgo
      ]);

      const dailyCount = parseInt(dailyResult.rows[0].count);
      const dailyTotal = parseFloat(dailyResult.rows[0].total);

      if (dailyCount >= this.VALIDATION_LIMITS.maxTransfersPerDay) {
        errors.push(`Daily transfer limit exceeded (${dailyCount}/${this.VALIDATION_LIMITS.maxTransfersPerDay})`);
      }

      const dailyLimit = this.VALIDATION_LIMITS.dailyTransferLimit[params.tokenType];
      if (dailyTotal + params.amount > dailyLimit) {
        errors.push(`Daily amount limit would be exceeded (${dailyTotal + params.amount}/${dailyLimit})`);
      }

      // Warnings for approaching limits
      if (hourlyCount >= this.VALIDATION_LIMITS.maxTransfersPerHour * 0.8) {
        warnings.push('Approaching hourly transfer count limit');
      }

      if (hourlyTotal >= hourlyLimit * 0.8) {
        warnings.push('Approaching hourly transfer amount limit');
      }

      if (dailyCount >= this.VALIDATION_LIMITS.maxTransfersPerDay * 0.8) {
        warnings.push('Approaching daily transfer count limit');
      }

      if (dailyTotal >= dailyLimit * 0.8) {
        warnings.push('Approaching daily transfer amount limit');
      }
    } catch (error) {
      logger.error('Failed to validate user limits:', error);
      errors.push('Unable to validate transfer limits at this time');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate security aspects
   */
  async validateSecurity(params: TransferValidationParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for self-transfer
    if (params.fromAddress === params.toAddress) {
      warnings.push('Self-transfer detected');
    }

    // Check for suspicious patterns
    if (params.amount === 1337 || params.amount === 42 || params.amount === 69) {
      warnings.push('Suspicious transfer amount detected');
    }

    // Check for rapid transfers to same address
    const recentTransferQuery = `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE from_address = $1
      AND to_address = $2
      AND status = 'confirmed'
      AND created_at >= NOW() - INTERVAL '5 minutes'
    `;

    try {
      const result = await postgresDb.query(recentTransferQuery, [
        params.fromAddress,
        params.toAddress
      ]);

      const recentCount = parseInt(result.rows[0].count);
      if (recentCount > 3) {
        errors.push('Too many recent transfers to the same address');
      }
    } catch (error) {
      logger.error('Failed to check recent transfers:', error);
    }

    // Check for first-time transfer
    const firstTransferQuery = `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE from_address = $1
      AND status = 'confirmed'
    `;

    try {
      const result = await postgresDb.query(firstTransferQuery, [params.fromAddress]);
      const transferCount = parseInt(result.rows[0].count);

      if (transferCount === 0 && params.amount > 100) {
        warnings.push('First transfer from this address is large');
      }
    } catch (error) {
      logger.error('Failed to check transfer history:', error);
    }

    // Check if recipient is known
    const recipientHistoryQuery = `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE to_address = $1
      AND status = 'confirmed'
    `;

    try {
      const result = await postgresDb.query(recipientHistoryQuery, [params.toAddress]);
      const recipientCount = parseInt(result.rows[0].count);

      if (recipientCount === 0 && params.amount > 1000) {
        warnings.push('Large transfer to new recipient address');
      }
    } catch (error) {
      logger.error('Failed to check recipient history:', error);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate transaction memo/message
   */
  validateMemo(memo: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check length
    if (memo.length > 200) {
      errors.push('Memo too long: maximum 200 characters allowed');
    }

    // Check for prohibited content
    const prohibitedWords = ['password', 'secret', 'private key', 'mnemonic'];
    const lowerMemo = memo.toLowerCase();

    for (const word of prohibitedWords) {
      if (lowerMemo.includes(word)) {
        errors.push(`Memo contains prohibited content: ${word}`);
      }
    }

    // Check for suspicious patterns
    if (/^[a-fA-F0-9]{64}$/.test(memo)) {
      warnings.push('Memo appears to be a hash - ensure this is intentional');
    }

    if (memo.includes('http://') || memo.includes('https://')) {
      warnings.push('Memo contains URL - ensure this is legitimate');
    }

    // Check for empty or whitespace-only memo
    if (memo.trim().length === 0) {
      warnings.push('Memo is empty or contains only whitespace');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate addresses for transfer
   */
  private validateAddresses(fromAddress: string, toAddress: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate from address
    const fromValidation = this.validateTonAddress(fromAddress);
    errors.push(...fromValidation.errors);
    warnings.push(...fromValidation.warnings);

    // Validate to address
    const toValidation = this.validateTonAddress(toAddress);
    errors.push(...toValidation.errors);
    warnings.push(...toValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load blacklist from database
   */
  private async loadBlacklist(): Promise<void> {
    try {
      const query = `
        SELECT address FROM blacklisted_addresses
        WHERE is_active = true
      `;

      const result = await postgresDb.query(query);
      result.rows.forEach(row => {
        this.BLACKLISTED_ADDRESSES.add(row.address);
      });

      logger.info(`Loaded ${this.BLACKLISTED_ADDRESSES.size} blacklisted addresses`);
    } catch (error) {
      logger.error('Failed to load blacklist:', error);
    }
  }

  /**
   * Load sanctions list
   */
  private async loadSanctionsList(): Promise<void> {
    try {
      const query = `
        SELECT address FROM sanctioned_addresses
        WHERE is_active = true
      `;

      const result = await postgresDb.query(query);
      result.rows.forEach(row => {
        this.SANCTIONED_ADDRESSES.add(row.address);
      });

      logger.info(`Loaded ${this.SANCTIONED_ADDRESSES.size} sanctioned addresses`);
    } catch (error) {
      logger.error('Failed to load sanctions list:', error);
    }
  }

  /**
   * Refresh blacklists
   */
  async refreshBlacklists(): Promise<void> {
    this.BLACKLISTED_ADDRESSES.clear();
    this.SANCTIONED_ADDRESSES.clear();
    await this.loadBlacklist();
    await this.loadSanctionsList();
  }

  /**
   * Add address to blacklist
   */
  async addToBlacklist(address: string, reason: string): Promise<void> {
    try {
      const query = `
        INSERT INTO blacklisted_addresses (address, reason, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (address) DO UPDATE SET
          is_active = true,
          reason = EXCLUDED.reason,
          updated_at = NOW()
      `;

      await postgresDb.query(query, [address, reason]);
      this.BLACKLISTED_ADDRESSES.add(address);
      logger.info(`Added address to blacklist: ${address}, reason: ${reason}`);
    } catch (error) {
      logger.error('Failed to add address to blacklist:', error);
    }
  }

  /**
   * Remove address from blacklist
   */
  async removeFromBlacklist(address: string): Promise<void> {
    try {
      const query = `
        UPDATE blacklisted_addresses
        SET is_active = false, updated_at = NOW()
        WHERE address = $1
      `;

      await postgresDb.query(query, [address]);
      this.BLACKLISTED_ADDRESSES.delete(address);
      logger.info(`Removed address from blacklist: ${address}`);
    } catch (error) {
      logger.error('Failed to remove address from blacklist:', error);
    }
  }

  /**
   * Get current validation limits
   */
  getValidationLimits(): Limits {
    return { ...this.VALIDATION_LIMITS };
  }

  /**
   * Update validation limits
   */
  updateValidationLimits(updates: Partial<Limits>): void {
    Object.assign(this.VALIDATION_LIMITS, updates);
    logger.info('Updated validation limits:', updates);
  }
}