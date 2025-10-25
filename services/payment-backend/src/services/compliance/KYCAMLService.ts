import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { GDPRService } from './GDPRService';
import { AuditService } from './AuditService';
import { Logger } from '../utils/logger';

interface KYCRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'requires_additional_info';
  requestType: 'individual' | 'business';
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    residentialAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  identificationDocuments: {
    type: 'passport' | 'national_id' | 'driver_license';
    frontDocument: string; // base64 or secure URL
    backDocument?: string;
    documentNumber: string;
    issuingCountry: string;
    expirationDate: string;
  }[];
  businessInfo?: {
    companyName: string;
    registrationNumber: string;
    incorporationDate: string;
    businessAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    directors: Array<{
      name: string;
      identificationDocument: string;
    }>;
    beneficialOwners: Array<{
      name: string;
      dateOfBirth: string;
      nationality: string;
      address: string;
      ownershipPercentage: number;
    }>;
  };
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  additionalInfoRequested?: string[];
  sanctionsCheckResult?: {
    screened: boolean;
    matches: Array<{
      list: string;
      name: string;
      confidence: number;
    }>;
    checkedAt: Date;
  };
  metadata: Record<string, any>;
}

interface AMLTransaction {
  id: string;
  userId: string;
  transactionId: string;
  amount: number;
  currency: string;
  sourceAddress?: string;
  destinationAddress?: string;
  transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  riskScore: number;
  riskFactors: string[];
  status: 'pending' | 'flagged' | 'cleared' | 'blocked' | 'reported';
  sanctionsCheck: boolean;
  suspiciousActivityIndicators: string[];
  reportedToAuthorities: boolean;
  reportReference?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}

interface SanctionsListItem {
  id: string;
  name: string;
  aliases: string[];
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  nationalId?: string;
  address?: string;
  listType: 'sanctions' | 'watchlist' | 'peps' | 'adverse_media';
  source: string;
  lastUpdated: Date;
  confidence: number;
}

export class KYCAMLService {
  private db: DatabaseService;
  private gdprService: GDPRService;
  private auditService: AuditService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.gdprService = new GDPRService(db);
    this.auditService = new AuditService(db);
    this.logger = new Logger('KYCAMLService');
  }

  /**
   * Submit KYC application
   */
  async submitKYCApplication(userId: string, applicationData: Omit<KYCRequest, 'id' | 'userId' | 'status' | 'submittedAt'>): Promise<KYCRequest> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Validate application data
      this.validateKYCData(applicationData);

      // Create KYC request
      const kycRequest: KYCRequest = {
        ...applicationData,
        id: this.generateId(),
        userId,
        status: 'pending',
        submittedAt: new Date(),
        metadata: applicationData.metadata || {}
      };

      // Store in database
      await this.storeKYCRequest(kycRequest, client);

      // Perform initial sanctions screening
      const sanctionsResult = await this.performSanctionsCheck(kycRequest);
      if (sanctionsResult.matches.length > 0) {
        kycRequest.status = 'rejected';
        kycRequest.rejectionReason = 'Sanctions list match found';
        kycRequest.sanctionsCheckResult = sanctionsResult;
        kycRequest.riskLevel = 'high';
        kycRequest.riskScore = 100;
      } else {
        kycRequest.sanctionsCheckResult = sanctionsResult;
        kycRequest.riskScore = this.calculateRiskScore(kycRequest);
        kycRequest.riskLevel = this.getRiskLevel(kycRequest.riskScore);
      }

      // Update with screening results
      await this.updateKYCRequest(kycRequest, client);

      await client.query('COMMIT');

      // Log the submission
      await this.auditService.logUserAction({
        userId,
        action: 'kyc_application_submitted',
        resourceType: 'kyc_request',
        resourceId: kycRequest.id,
        metadata: {
          requestType: kycRequest.requestType,
          riskScore: kycRequest.riskScore,
          riskLevel: kycRequest.riskLevel
        }
      });

      this.logger.info('KYC application submitted', {
        userId,
        requestId: kycRequest.id,
        requestType: kycRequest.requestType,
        riskScore: kycRequest.riskScore
      });

      return kycRequest;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to submit KYC application', { userId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Review KYC application (admin only)
   */
  async reviewKYCApplication(requestId: string, reviewerId: string, decision: 'approve' | 'reject' | 'request_info', notes?: string, additionalInfo?: string[]): Promise<KYCRequest> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Get existing request
      const kycRequest = await this.getKYCRequest(requestId, client);
      if (!kycRequest) {
        throw new Error('KYC request not found');
      }

      if (kycRequest.status !== 'pending' && kycRequest.status !== 'requires_additional_info') {
        throw new Error('KYC request cannot be reviewed in current status');
      }

      // Update status
      kycRequest.status = decision === 'approve' ? 'approved' :
                        decision === 'reject' ? 'rejected' : 'requires_additional_info';
      kycRequest.reviewedAt = new Date();
      kycRequest.reviewedBy = reviewerId;

      if (decision === 'reject') {
        kycRequest.rejectionReason = notes;
      } else if (decision === 'request_info') {
        kycRequest.additionalInfoRequested = additionalInfo || [];
      }

      kycRequest.metadata.notes = notes;
      kycRequest.metadata.reviewedBy = reviewerId;

      // Update in database
      await this.updateKYCRequest(kycRequest, client);

      await client.query('COMMIT');

      // Log the review
      await this.auditService.logAdminAction({
        userId: reviewerId,
        action: 'kyc_application_reviewed',
        resourceType: 'kyc_request',
        resourceId: requestId,
        targetUserId: kycRequest.userId,
        metadata: {
          decision,
          notes,
          riskScore: kycRequest.riskScore,
          riskLevel: kycRequest.riskLevel
        }
      });

      this.logger.info('KYC application reviewed', {
        requestId,
        reviewerId,
        decision,
        userId: kycRequest.userId
      });

      return kycRequest;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to review KYC application', { requestId, reviewerId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Monitor transaction for AML compliance
   */
  async monitorTransaction(transactionData: {
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    sourceAddress?: string;
    destinationAddress?: string;
    transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  }): Promise<AMLTransaction> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Create AML transaction record
      const amlTransaction: AMLTransaction = {
        id: this.generateId(),
        ...transactionData,
        riskScore: 0,
        riskFactors: [],
        status: 'pending',
        sanctionsCheck: false,
        suspiciousActivityIndicators: [],
        reportedToAuthorities: false,
        createdAt: new Date()
      };

      // Perform AML checks
      await this.performAMLChecks(amlTransaction);

      // Store in database
      await this.storeAMLTransaction(amlTransaction, client);

      await client.query('COMMIT');

      // Log transaction monitoring
      await this.auditService.logUserAction({
        userId: transactionData.userId,
        action: 'aml_transaction_monitored',
        resourceType: 'aml_transaction',
        resourceId: amlTransaction.id,
        metadata: {
          transactionId: transactionData.transactionId,
          amount: transactionData.amount,
          currency: transactionData.currency,
          riskScore: amlTransaction.riskScore,
          status: amlTransaction.status
        }
      });

      // If high risk, create alert
      if (amlTransaction.riskScore >= 80) {
        await this.createHighRiskAlert(amlTransaction);
      }

      this.logger.info('Transaction monitored for AML compliance', {
        transactionId: amlTransaction.id,
        userId: transactionData.userId,
        riskScore: amlTransaction.riskScore,
        status: amlTransaction.status
      });

      return amlTransaction;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to monitor transaction for AML', {
        userId: transactionData.userId,
        transactionId: transactionData.transactionId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Perform sanctions screening
   */
  private async performSanctionsCheck(kycRequest: KYCRequest): Promise<{
    screened: boolean;
    matches: Array<{
      list: string;
      name: string;
      confidence: number;
    }>;
    checkedAt: Date;
  }> {
    const screeningResults = {
      screened: true,
      matches: [] as Array<{ list: string; name: string; confidence: number }>,
      checkedAt: new Date()
    };

    try {
      // Check personal name against sanctions lists
      const personalName = `${kycRequest.personalInfo.firstName} ${kycRequest.personalInfo.lastName}`;
      const personalMatches = await this.checkAgainstSanctionsLists({
        name: personalName,
        dateOfBirth: kycRequest.personalInfo.dateOfBirth,
        nationality: kycRequest.personalInfo.nationality
      });

      screeningResults.matches.push(...personalMatches);

      // Check identification documents
      for (const doc of kycRequest.identificationDocuments) {
        const docMatches = await this.checkDocumentAgainstSanctionsLists(doc);
        screeningResults.matches.push(...docMatches);
      }

      // Check business information if applicable
      if (kycRequest.businessInfo) {
        const businessMatches = await this.checkBusinessAgainstSanctionsLists(kycRequest.businessInfo);
        screeningResults.matches.push(...businessMatches);

        // Check directors and beneficial owners
        for (const director of kycRequest.businessInfo.directors) {
          const directorMatches = await this.checkAgainstSanctionsLists({
            name: director.name
          });
          screeningResults.matches.push(...directorMatches);
        }

        for (const owner of kycRequest.businessInfo.beneficialOwners) {
          const ownerMatches = await this.checkAgainstSanctionsLists({
            name: owner.name,
            dateOfBirth: owner.dateOfBirth,
            nationality: owner.nationality
          });
          screeningResults.matches.push(...ownerMatches);
        }
      }

      this.logger.info('Sanctions screening completed', {
        requestId: kycRequest.id,
        matchesFound: screeningResults.matches.length
      });

    } catch (error) {
      this.logger.error('Sanctions screening failed', {
        requestId: kycRequest.id,
        error: error.message
      });
    }

    return screeningResults;
  }

  /**
   * Check individual against sanctions lists
   */
  private async checkAgainstSanctionsLists(personData: {
    name: string;
    dateOfBirth?: string;
    nationality?: string;
    passportNumber?: string;
    nationalId?: string;
  }): Promise<Array<{ list: string; name: string; confidence: number }>> {
    const matches: Array<{ list: string; name: string; confidence: number }> = [];

    try {
      // Mock sanctions list checking - in production, integrate with real sanctions list APIs
      const mockSanctionsLists = [
        {
          name: 'OFAC Specially Designated Nationals',
          entries: [
            { name: 'John Doe', confidence: 0.95 },
            { name: 'Jane Smith', confidence: 0.87 }
          ]
        },
        {
          name: 'UN Sanctions List',
          entries: [
            { name: 'Bad Actor', confidence: 0.92 }
          ]
        }
      ];

      for (const list of mockSanctionsLists) {
        for (const entry of list.entries) {
          const similarity = this.calculateNameSimilarity(personData.name, entry.name);
          if (similarity > 0.8) {
            matches.push({
              list: list.name,
              name: entry.name,
              confidence: similarity * entry.confidence
            });
          }
        }
      }

    } catch (error) {
      this.logger.error('Failed to check sanctions lists', { error: error.message });
    }

    return matches;
  }

  /**
   * Check document against sanctions lists
   */
  private async checkDocumentAgainstSanctionsLists(document: KYCRequest['identificationDocuments'][0]): Promise<Array<{ list: string; name: string; confidence: number }>> {
    const matches: Array<{ list: string; name: string; confidence: number }> = [];

    try {
      // Check document number against lists
      if (document.documentNumber) {
        const documentMatches = await this.checkDocumentNumber(document.documentNumber, document.issuingCountry);
        matches.push(...documentMatches);
      }
    } catch (error) {
      this.logger.error('Failed to check document against sanctions', { error: error.message });
    }

    return matches;
  }

  /**
   * Check business against sanctions lists
   */
  private async checkBusinessAgainstSanctionsLists(businessInfo: KYCRequest['businessInfo']): Promise<Array<{ list: string; name: string; confidence: number }>> {
    const matches: Array<{ list: string; name: string; confidence: number }> = [];

    try {
      // Check company name
      const companyMatches = await this.checkAgainstSanctionsLists({
        name: businessInfo.companyName
      });
      matches.push(...companyMatches);

      // Check registration number
      if (businessInfo.registrationNumber) {
        const registrationMatches = await this.checkBusinessRegistration(businessInfo.registrationNumber);
        matches.push(...registrationMatches);
      }
    } catch (error) {
      this.logger.error('Failed to check business against sanctions', { error: error.message });
    }

    return matches;
  }

  /**
   * Perform AML checks on transaction
   */
  private async performAMLChecks(amlTransaction: AMLTransaction): Promise<void> {
    try {
      let riskScore = 0;
      const riskFactors: string[] = [];

      // Amount-based risk assessment
      if (amlTransaction.amount > 10000) {
        riskScore += 30;
        riskFactors.push('high_value_transaction');
      } else if (amlTransaction.amount > 1000) {
        riskScore += 10;
        riskFactors.push('medium_value_transaction');
      }

      // Frequency checks (mock implementation)
      const recentTransactions = await this.getRecentTransactions(amlTransaction.userId, 24); // last 24 hours
      if (recentTransactions.length > 10) {
        riskScore += 25;
        riskFactors.push('high_frequency_transactions');
      }

      // Pattern detection
      const suspiciousPatterns = await this.detectSuspiciousPatterns(amlTransaction.userId, amlTransaction);
      riskScore += suspiciousPatterns.score;
      riskFactors.push(...suspiciousPatterns.factors);

      // Geographic risk assessment
      if (amlTransaction.sourceAddress || amlTransaction.destinationAddress) {
        const geoRisk = await this.assessGeographicRisk(amlTransaction.sourceAddress, amlTransaction.destinationAddress);
        riskScore += geoRisk.score;
        riskFactors.push(...geoRisk.factors);
      }

      // Sanctions screening for addresses
      if (amlTransaction.sourceAddress || amlTransaction.destinationAddress) {
        const sanctionsRisk = await this.screenAddresses(amlTransaction.sourceAddress, amlTransaction.destinationAddress);
        if (sanctionsRisk.risk > 0) {
          riskScore += sanctionsRisk.risk * 50;
          riskFactors.push('sanctions_list_match');
        }
      }

      amlTransaction.riskScore = Math.min(riskScore, 100);
      amlTransaction.riskFactors = riskFactors;

      // Determine status based on risk score
      if (amlTransaction.riskScore >= 80) {
        amlTransaction.status = 'flagged';
      } else if (amlTransaction.riskScore >= 50) {
        amlTransaction.status = 'pending';
      } else {
        amlTransaction.status = 'cleared';
      }

      this.logger.info('AML checks completed', {
        transactionId: amlTransaction.id,
        riskScore: amlTransaction.riskScore,
        status: amlTransaction.status,
        riskFactors: riskFactors.length
      });

    } catch (error) {
      this.logger.error('AML checks failed', {
        transactionId: amlTransaction.id,
        error: error.message
      });
      amlTransaction.riskScore = 50; // Default to medium risk on error
      amlTransaction.status = 'pending';
      amlTransaction.riskFactors = ['aml_check_error'];
    }
  }

  /**
   * Calculate KYC risk score
   */
  private calculateRiskScore(kycRequest: KYCRequest): number {
    let score = 0;

    // Risk factors based on application data
    if (kycRequest.requestType === 'business') {
      score += 10; // Business applications are slightly higher risk
    }

    // Age-based risk (younger applicants may be higher risk)
    const age = this.calculateAge(kycRequest.personalInfo.dateOfBirth);
    if (age < 18) score += 100; // Underage - automatic rejection
    else if (age < 25) score += 15;
    else if (age > 70) score += 10;

    // Document risk assessment
    if (kycRequest.identificationDocuments.length === 0) {
      score += 50; // No documents provided
    } else if (kycRequest.identificationDocuments.length === 1) {
      score += 20; // Only one document
    }

    // Geographic risk
    const highRiskCountries = ['XX', 'YY', 'ZZ']; // Mock high-risk countries
    if (highRiskCountries.includes(kycRequest.personalInfo.residentialAddress.country)) {
      score += 30;
    }

    return Math.min(score, 100);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score < 30) return 'low';
    if (score < 70) return 'medium';
    return 'high';
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Calculate name similarity (simple implementation)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple similarity calculation - in production use more sophisticated algorithms
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 1.0;

    // Simple Levenshtein distance approximation
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Validate KYC data
   */
  private validateKYCData(data: Omit<KYCRequest, 'id' | 'userId' | 'status' | 'submittedAt'>): void {
    // Validate personal information
    if (!data.personalInfo.firstName || !data.personalInfo.lastName) {
      throw new Error('First name and last name are required');
    }

    if (!data.personalInfo.dateOfBirth) {
      throw new Error('Date of birth is required');
    }

    const age = this.calculateAge(data.personalInfo.dateOfBirth);
    if (age < 18) {
      throw new Error('Applicant must be at least 18 years old');
    }

    // Validate identification documents
    if (!data.identificationDocuments || data.identificationDocuments.length === 0) {
      throw new Error('At least one identification document is required');
    }

    for (const doc of data.identificationDocuments) {
      if (!doc.type || !doc.documentNumber || !doc.issuingCountry) {
        throw new Error('Document type, number, and issuing country are required');
      }
    }

    // Validate business information if provided
    if (data.requestType === 'business' && !data.businessInfo) {
      throw new Error('Business information is required for business applications');
    }
  }

  /**
   * Get recent transactions for frequency analysis
   */
  private async getRecentTransactions(userId: string, hours: number): Promise<AMLTransaction[]> {
    const result = await this.db.query(`
      SELECT * FROM aml_transactions
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows;
  }

  /**
   * Detect suspicious transaction patterns
   */
  private async detectSuspiciousPatterns(userId: string, transaction: AMLTransaction): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Check for rapid succession of transactions
      const recentTransactions = await this.getRecentTransactions(userId, 1); // last hour
      if (recentTransactions.length > 5) {
        score += 20;
        factors.push('rapid_succession_transactions');
      }

      // Check for round numbers (potential structuring)
      if (transaction.amount % 1000 === 0 && transaction.amount >= 9000 && transaction.amount <= 10000) {
        score += 15;
        factors.push('suspicious_round_amount');
      }

      // Check for transaction just under reporting thresholds
      if (transaction.amount >= 9500 && transaction.amount <= 9999) {
        score += 25;
        factors.push('just_under_threshold');
      }

    } catch (error) {
      this.logger.error('Failed to detect suspicious patterns', { userId, error: error.message });
    }

    return { score, factors };
  }

  /**
   * Assess geographic risk
   */
  private async assessGeographicRisk(sourceAddress?: string, destinationAddress?: string): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Mock geographic risk assessment
      const highRiskJurisdictions = ['XX', 'YY', 'ZZ']; // Country codes

      // In a real implementation, you would use IP geolocation or blockchain analysis
      // to determine the geographic locations involved

    } catch (error) {
      this.logger.error('Failed to assess geographic risk', { error: error.message });
    }

    return { score, factors };
  }

  /**
   * Screen addresses against sanctions lists
   */
  private async screenAddresses(sourceAddress?: string, destinationAddress?: string): Promise<{ risk: number }> {
    let risk = 0;

    try {
      // Mock address screening - in production, integrate with blockchain analytics
      if (sourceAddress || destinationAddress) {
        // Check if addresses are associated with known illicit activities
        const suspiciousAddresses = ['0xabc...', '0xdef...']; // Mock suspicious addresses

        if (suspiciousAddresses.includes(sourceAddress || '') || suspiciousAddresses.includes(destinationAddress || '')) {
          risk = 0.8;
        }
      }
    } catch (error) {
      this.logger.error('Failed to screen addresses', { error: error.message });
    }

    return { risk };
  }

  /**
   * Create high-risk alert
   */
  private async createHighRiskAlert(transaction: AMLTransaction): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO compliance_alerts
        (id, user_id, transaction_id, alert_type, severity, description, created_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [
        this.generateId(),
        transaction.userId,
        transaction.id,
        'high_risk_transaction',
        'high',
        `High-risk transaction detected: ${transaction.currency} ${transaction.amount}`,
        JSON.stringify({
          riskScore: transaction.riskScore,
          riskFactors: transaction.riskFactors,
          suspiciousIndicators: transaction.suspiciousActivityIndicators
        })
      ]);

      this.logger.warn('High-risk alert created', {
        transactionId: transaction.id,
        userId: transaction.userId,
        riskScore: transaction.riskScore
      });

    } catch (error) {
      this.logger.error('Failed to create high-risk alert', {
        transactionId: transaction.id,
        error: error.message
      });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return 'kyc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Store KYC request in database
   */
  private async storeKYCRequest(request: KYCRequest, client: any): Promise<void> {
    await client.query(`
      INSERT INTO kyc_requests
      (id, user_id, status, request_type, personal_info, identification_documents, business_info, risk_level, risk_score, submitted_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      request.id,
      request.userId,
      request.status,
      request.requestType,
      JSON.stringify(request.personalInfo),
      JSON.stringify(request.identificationDocuments),
      request.businessInfo ? JSON.stringify(request.businessInfo) : null,
      request.riskLevel,
      request.riskScore,
      request.submittedAt,
      JSON.stringify(request.metadata)
    ]);
  }

  /**
   * Update KYC request in database
   */
  private async updateKYCRequest(request: KYCRequest, client: any): Promise<void> {
    await client.query(`
      UPDATE kyc_requests
      SET status = $1, risk_level = $2, risk_score = $3, reviewed_at = $4, reviewed_by = $5,
          rejection_reason = $6, additional_info_requested = $7, sanctions_check_result = $8, metadata = $9
      WHERE id = $10
    `, [
      request.status,
      request.riskLevel,
      request.riskScore,
      request.reviewedAt,
      request.reviewedBy,
      request.rejectionReason,
      request.additionalInfoRequested ? JSON.stringify(request.additionalInfoRequested) : null,
      request.sanctionsCheckResult ? JSON.stringify(request.sanctionsCheckResult) : null,
      JSON.stringify(request.metadata),
      request.id
    ]);
  }

  /**
   * Get KYC request from database
   */
  private async getKYCRequest(requestId: string, client: any): Promise<KYCRequest | null> {
    const result = await client.query(`
      SELECT * FROM kyc_requests WHERE id = $1
    `, [requestId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      requestType: row.request_type,
      personalInfo: JSON.parse(row.personal_info),
      identificationDocuments: JSON.parse(row.identification_documents),
      businessInfo: row.business_info ? JSON.parse(row.business_info) : undefined,
      riskLevel: row.risk_level,
      riskScore: row.risk_score,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      rejectionReason: row.rejection_reason,
      additionalInfoRequested: row.additional_info_requested ? JSON.parse(row.additional_info_requested) : undefined,
      sanctionsCheckResult: row.sanctions_check_result ? JSON.parse(row.sanctions_check_result) : undefined,
      metadata: JSON.parse(row.metadata)
    };
  }

  /**
   * Store AML transaction in database
   */
  private async storeAMLTransaction(transaction: AMLTransaction, client: any): Promise<void> {
    await client.query(`
      INSERT INTO aml_transactions
      (id, user_id, transaction_id, amount, currency, source_address, destination_address,
       transaction_type, risk_score, risk_factors, status, sanctions_check, suspicious_activity_indicators,
       reported_to_authorities, created_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      transaction.id,
      transaction.userId,
      transaction.transactionId,
      transaction.amount,
      transaction.currency,
      transaction.sourceAddress,
      transaction.destinationAddress,
      transaction.transactionType,
      transaction.riskScore,
      JSON.stringify(transaction.riskFactors),
      transaction.status,
      transaction.sanctionsCheck,
      JSON.stringify(transaction.suspiciousActivityIndicators),
      transaction.reportedToAuthorities,
      transaction.createdAt,
      transaction.notes
    ]);
  }

  /**
   * Mock methods for document and business checks
   */
  private async checkDocumentNumber(documentNumber: string, issuingCountry: string): Promise<Array<{ list: string; name: string; confidence: number }>> {
    // Mock implementation
    return [];
  }

  private async checkBusinessRegistration(registrationNumber: string): Promise<Array<{ list: string; name: string; confidence: number }>> {
    // Mock implementation
    return [];
  }
}