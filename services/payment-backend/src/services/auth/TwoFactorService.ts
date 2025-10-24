import { authenticator } from 'otplib';
import crypto from 'crypto';
import qrcode from 'qrcode';
import { postgresDb } from '../database';

export interface BackupCode {
  code: string;
  hashedCode: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class TwoFactorService {
  /**
   * Generate a new TOTP secret
   */
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * Generate TOTP QR code for user
   */
  async generateSetupQR(userId: number, email: string): Promise<TwoFactorSetup> {
    const secret = this.generateSecret();
    const appName = process.env.APP_NAME || 'Deligate.it';
    const issuer = process.env.APP_NAME || 'Deligate.it';

    // Generate OTP auth URL
    const otpauthUrl = authenticator.keyuri(email, appName, secret);

    // Generate QR code
    const qrCode = await qrcode.toDataURL(otpauthUrl);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Store hashed backup codes in database
    for (const code of backupCodes) {
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      await postgresDb.query(`
        INSERT INTO two_factor_backup_codes (user_id, code_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '1 year')
      `, [userId, hashedCode]);
    }

    // Store 2FA secret temporarily (not enabled yet)
    await postgresDb.query(`
      UPDATE users
      SET two_factor_secret = $2, two_factor_enabled = false
      WHERE id = $1
    `, [userId, secret]);

    return {
      secret,
      qrCode,
      backupCodes
    };
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verify TOTP token
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch (error) {
      console.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const result = await postgresDb.query(`
      UPDATE two_factor_backup_codes
      SET is_used = true, used_at = NOW()
      WHERE user_id = $1
      AND code_hash = $2
      AND is_used = false
      AND expires_at > NOW()
      RETURNING id
    `, [userId, hashedCode]);

    return result.rows.length > 0;
  }

  /**
   * Enable 2FA for user after verification
   */
  async enableTwoFactor(userId: number, token: string): Promise<boolean> {
    // Get user's 2FA secret
    const userResult = await postgresDb.query(
      'SELECT two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0] || !userResult.rows[0].two_factor_secret) {
      throw new Error('2FA setup not initiated');
    }

    const secret = userResult.rows[0].two_factor_secret;

    // Verify the token
    if (!this.verifyToken(secret, token)) {
      throw new Error('Invalid verification code');
    }

    // Enable 2FA
    await postgresDb.query(`
      UPDATE users
      SET two_factor_enabled = true
      WHERE id = $1
    `, [userId]);

    return true;
  }

  /**
   * Disable 2FA for user
   */
  async disableTwoFactor(userId: number, password: string): Promise<boolean> {
    // Verify password first
    const userResult = await postgresDb.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }

    // In a real implementation, verify password hash
    // const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    // if (!isValidPassword) {
    //   throw new Error('Invalid password');
    // }

    // Disable 2FA and clear secret
    await postgresDb.query(`
      UPDATE users
      SET two_factor_enabled = false, two_factor_secret = NULL
      WHERE id = $1
    `, [userId]);

    // Revoke all backup codes
    await postgresDb.query(`
      UPDATE two_factor_backup_codes
      SET is_used = true, used_at = NOW()
      WHERE user_id = $1 AND is_used = false
    `, [userId]);

    return true;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: number): Promise<string[]> {
    // Mark all existing backup codes as used
    await postgresDb.query(`
      UPDATE two_factor_backup_codes
      SET is_used = true, used_at = NOW()
      WHERE user_id = $1 AND is_used = false
    `, [userId]);

    // Generate new backup codes
    const newCodes = this.generateBackupCodes(10);

    // Store new backup codes
    for (const code of newCodes) {
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      await postgresDb.query(`
        INSERT INTO two_factor_backup_codes (user_id, code_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '1 year')
      `, [userId, hashedCode]);
    }

    return newCodes;
  }

  /**
   * Get remaining backup codes count
   */
  async getRemainingBackupCodesCount(userId: number): Promise<number> {
    const result = await postgresDb.query(`
      SELECT COUNT(*) as count
      FROM two_factor_backup_codes
      WHERE user_id = $1
      AND is_used = false
      AND expires_at > NOW()
    `, [userId]);

    return parseInt(result.rows[0].count);
  }

  /**
   * Send 2FA code via SMS
   */
  async sendSMSCode(userId: number, phoneNumber: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry

    // Hash the code for storage
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    await postgresDb.query(`
      INSERT INTO sms_verification_codes (user_id, code_hash, expires_at, phone_number)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        code_hash = EXCLUDED.code_hash,
        expires_at = EXCLUDED.expires_at,
        phone_number = EXCLUDED.phone_number,
        created_at = NOW()
    `, [userId, hashedCode, expiresAt, phoneNumber]);

    // Send SMS (implementation depends on SMS provider)
    // await this.smsService.send(phoneNumber, `Your verification code is: ${code}`);

    console.log(`SMS code sent to ${phoneNumber}: ${code}`);

    return code; // Return for testing (remove in production)
  }

  /**
   * Verify SMS code
   */
  async verifySMSCode(userId: number, code: string): Promise<boolean> {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const result = await postgresDb.query(`
      DELETE FROM sms_verification_codes
      WHERE user_id = $1
      AND code_hash = $2
      AND expires_at > NOW()
      RETURNING id
    `, [userId, hashedCode]);

    return result.rows.length > 0;
  }

  /**
   * Check if user has 2FA enabled
   */
  async isTwoFactorEnabled(userId: number): Promise<boolean> {
    const result = await postgresDb.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0]?.two_factor_enabled || false;
  }

  /**
   * Generate emergency recovery codes
   */
  async generateEmergencyCodes(userId: number): Promise<string[]> {
    const codes = [];
    for (let i = 0; i < 5; i++) {
      // Generate 12-character recovery code
      const code = crypto.randomBytes(6).toString('hex').toUpperCase();
      codes.push(code.match(/.{4}/g)!.join('-')); // Format as XXXX-XXXX-XXXX
    }

    // Store emergency codes
    for (const code of codes) {
      const hashedCode = crypto.createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
      await postgresDb.query(`
        INSERT INTO emergency_recovery_codes (user_id, code_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '2 years')
      `, [userId, hashedCode]);
    }

    return codes;
  }

  /**
   * Verify emergency recovery code
   */
  async verifyEmergencyCode(userId: number, code: string): Promise<boolean> {
    const cleanCode = code.replace(/-/g, '');
    const hashedCode = crypto.createHash('sha256').update(cleanCode).digest('hex');

    const result = await postgresDb.query(`
      UPDATE emergency_recovery_codes
      SET is_used = true, used_at = NOW()
      WHERE user_id = $1
      AND code_hash = $2
      AND is_used = false
      AND expires_at > NOW()
      RETURNING id
    `, [userId, hashedCode]);

    if (result.rows.length > 0) {
      // Disable 2FA as emergency recovery was used
      await postgresDb.query(`
        UPDATE users
        SET two_factor_enabled = false, two_factor_secret = NULL
        WHERE id = $1
      `, [userId]);

      return true;
    }

    return false;
  }
}