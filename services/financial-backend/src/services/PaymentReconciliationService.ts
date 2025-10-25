// ============================================================================
// PAYMENT RECONCILIATION AND TREASURY MANAGEMENT SERVICE
// ============================================================================

import { Logger } from '../utils/logger';

const logger = new Logger('PaymentReconciliationService');

export interface ReconciliationProcess {
  id: string;
  process_name: string;
  reconciliation_type: 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'requires_review';
  start_time: Date;
  end_time?: Date;
  total_transactions: number;
  matched_transactions: number;
  unmatched_transactions: number;
  total_amount: number;
  matched_amount: number;
  variance_amount: number;
  variance_percentage: number;
  created_by: string;
  reviewed_by?: string;
  notes: string[];
  attachments: string[];
  created_at: Date;
  updated_at: Date;
}

export interface TransactionMatch {
  id: string;
  reconciliation_process_id: string;
  source_transaction_id: string;
  source_system: string;
  target_transaction_id: string;
  target_system: string;
  source_amount: number;
  target_amount: number;
  amount_variance: number;
  currency: string;
  exchange_rate?: number;
  match_confidence: number;
  match_status: 'perfect' | 'variance' | 'partial' | 'manual_review';
  match_rules: string[];
  created_at: Date;
  matched_by?: string;
}

export interface UnmatchedTransaction {
  id: string;
  reconciliation_process_id: string;
  transaction_id: string;
  source_system: string;
  amount: number;
  currency: string;
  transaction_date: Date;
  reference_number?: string;
  description: string;
  unmatched_reason: string;
  potential_matches: PotentialMatch[];
  status: 'unmatched' | 'investigating' | 'resolved' | 'written_off';
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: Date;
}

export interface PotentialMatch {
  transaction_id: string;
  source_system: string;
  amount: number;
  currency: string;
  transaction_date: Date;
  match_score: number;
  differences: string[];
}

export interface ReconciliationRule {
  id: string;
  name: string;
  description: string;
  source_system: string;
  target_system: string;
  matching_criteria: MatchingCriteria[];
  tolerance_settings: ToleranceSettings;
  priority: number;
  is_active: boolean;
  auto_match_threshold: number;
  manual_review_threshold: number;
  created_at: Date;
  updated_at: Date;
}

export interface MatchingCriteria {
  field: string;
  weight: number;
  comparison_type: 'exact' | 'fuzzy' | 'range' | 'date_range';
  tolerance?: number;
  required: boolean;
}

export interface ToleranceSettings {
  amount_tolerance_percentage: number;
  amount_tolerance_absolute: number;
  date_tolerance_days: number;
  exchange_rate_tolerance: number;
  require_currency_match: boolean;
  allow_partial_matches: boolean;
}

export interface TreasuryAccount {
  id: string;
  account_name: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'investment' | 'escrow' | 'crypto';
  currency: string;
  provider: string;
  balance: number;
  available_balance: number;
  pending_credits: number;
  pending_debits: number;
  last_updated: Date;
  status: 'active' | 'inactive' | 'frozen' | 'closed';
  authorized_signatories: string[];
  daily_transaction_limit: number;
  monthly_transaction_limit: number;
  interest_rate?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CashPosition {
  total_cash: number;
  cash_by_currency: Record<string, number>;
  cash_by_account_type: Record<string, number>;
  cash_by_provider: Record<string, number>;
  pending_transactions: PendingTransaction[];
  forecast_cash_flow: CashFlowForecast;
  liquidity_analysis: LiquidityAnalysis;
  currency_exposure: CurrencyExposure;
  last_updated: Date;
}

export interface PendingTransaction {
  id: string;
  account_id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  description: string;
  expected_settlement_date: Date;
  status: 'pending' | 'processing' | 'held';
  hold_reason?: string;
  source_transaction_id?: string;
}

export interface CashFlowForecast {
  forecast_period: string;
  opening_balance: number;
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  net_cash_flow: number;
  closing_balance: number;
  confidence_level: number;
  assumptions: string[];
  scenarios: CashFlowScenario[];
}

export interface CashFlowItem {
  date: Date;
  amount: number;
  currency: string;
  category: string;
  description: string;
  probability: number;
  source: string;
}

export interface CashFlowScenario {
  scenario_name: string;
  probability: number;
  net_cash_flow: number;
  closing_balance: number;
  key_assumptions: string[];
  risk_factors: string[];
}

export interface LiquidityAnalysis {
  current_ratio: number;
  quick_ratio: number;
  cash_ratio: number;
  operating_cash_flow_ratio: number;
  cash_conversion_cycle: number;
  days_cash_on_hand: number;
  liquidity_score: number;
  recommendations: string[];
}

export interface CurrencyExposure {
  base_currency: string;
  exposures: CurrencyExposureDetail[];
  total_exposure: number;
  hedging_positions: HedgingPosition[];
  unhedged_exposure: number;
  value_at_risk: number;
  stress_test_results: StressTestResult[];
}

export interface CurrencyExposureDetail {
  currency: string;
  exposure_amount: number;
  exposure_percentage: number;
  natural_hedge_percentage: number;
  forward_contract_amount: number;
  options_amount: number;
  net_exposure: number;
}

export interface HedgingPosition {
  id: string;
  currency: string;
  hedge_type: 'forward' | 'option' | 'swap' | 'natural';
  notional_amount: number;
  strike_rate?: number;
  maturity_date: Date;
  counterparty: string;
  cost: number;
  effectiveness: number;
  status: 'active' | 'matured' | 'terminated';
}

export interface StressTestResult {
  scenario_name: string;
  market_shock: string;
  potential_loss: number;
  loss_percentage: number;
  probability: number;
  recommendations: string[];
}

export interface PaymentSettlement {
  id: string;
  settlement_batch_id: string;
  source_account_id: string;
  destination_account_id: string;
  total_amount: number;
  currency: string;
  transaction_count: number;
  settlement_method: 'ach' | 'wire' | 'sepa' | 'swift' | 'crypto';
  settlement_status: 'pending' | 'processing' | 'completed' | 'failed' | 'returned';
  initiated_at: Date;
  expected_completion_date: Date;
  completed_at?: Date;
  failure_reason?: string;
  tracking_reference?: string;
  fees: SettlementFees;
  transactions: SettledTransaction[];
}

export interface SettlementFees {
  processing_fee: number;
  currency_conversion_fee: number;
  intermediary_fees: number;
  total_fees: number;
  fee_currency: string;
}

export interface SettledTransaction {
  transaction_id: string;
  amount: number;
  currency: string;
  settlement_amount: number;
  exchange_rate?: number;
  fees: number;
  net_amount: number;
  status: string;
  reference_number?: string;
}

export interface FraudDetection {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_factors: RiskFactor[];
  fraud_indicators: FraudIndicator[];
  status: 'monitoring' | 'investigating' | 'confirmed' | 'false_positive';
  investigation_notes?: string;
  investigator?: string;
  created_at: Date;
  updated_at: Date;
}

export interface RiskFactor {
  factor_name: string;
  score: number;
  weight: number;
  description: string;
  threshold: number;
  actual_value: any;
}

export interface FraudIndicator {
  indicator_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detected_at: Date;
  confidence: number;
}

export interface ComplianceMonitoring {
  id: string;
  monitoring_type: 'aml' | 'kyc' | 'sanctions' | 'transaction_limits' | 'reporting';
  entity_id: string;
  entity_type: 'customer' | 'transaction' | 'account';
  compliance_status: 'compliant' | 'flagged' | 'under_review' | 'violation';
  flags: ComplianceFlag[];
  last_checked: Date;
  next_check_date: Date;
  assigned_to?: string;
  resolution_notes?: string;
}

export interface ComplianceFlag {
  flag_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  regulatory_reference?: string;
  triggered_at: Date;
  status: 'active' | 'resolved' | 'false_positive';
}

export interface ReconciliationDashboard {
  daily_reconciliation_status: ReconciliationStatus;
  weekly_reconciliation_status: ReconciliationStatus;
  monthly_reconciliation_status: ReconciliationStatus;
  total_accounts_reconciled: number;
  total_amount_reconciled: number;
  variance_analysis: VarianceAnalysis;
  upcoming_reconciliations: UpcomingReconciliation[];
  exception_summary: ExceptionSummary;
}

export interface ReconciliationStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress_percentage: number;
  completed_accounts: number;
  total_accounts: number;
  last_completed?: Date;
  issues_count: number;
}

export interface VarianceAnalysis {
  total_variance: number;
  variance_percentage: number;
  significant_variances: SignificantVariance[];
  variance_trends: VarianceTrend[];
  common_variance_reasons: Array<{
    reason: string;
    frequency: number;
    total_variance: number;
  }>;
}

export interface SignificantVariance {
  account_id: string;
  account_name: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  investigation_required: boolean;
  assigned_to?: string;
}

export interface VarianceTrend {
  period: string;
  variance_amount: number;
  variance_percentage: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
}

export interface UpcomingReconciliation {
  account_id: string;
  account_name: string;
  scheduled_date: Date;
  reconciliation_type: string;
  estimated_transactions: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ExceptionSummary {
  total_exceptions: number;
  critical_exceptions: number;
  high_priority_exceptions: number;
  exceptions_by_type: Record<string, number>;
  exceptions_by_age: Record<string, number>;
  average_resolution_time: number;
}

export class PaymentReconciliationService {
  private reconciliationProcesses: Map<string, ReconciliationProcess> = new Map();
  private reconciliationRules: Map<string, ReconciliationRule> = new Map();
  private treasuryAccounts: Map<string, TreasuryAccount> = new Map();
  private pendingTransactions: Map<string, PendingTransaction> = new Map();

  constructor() {
    this.initializeReconciliationRules();
    this.startAutomatedReconciliation();
  }

  /**
   * Initialize reconciliation rules
   */
  private initializeReconciliationRules(): void {
    const rules: ReconciliationRule[] = [
      {
        id: 'bank_reconciliation_rule',
        name: 'Bank Account Reconciliation',
        description: 'Match internal transactions with bank statement entries',
        source_system: 'internal_ledger',
        target_system: 'bank_statement',
        matching_criteria: [
          { field: 'amount', weight: 0.4, comparison_type: 'exact', required: true },
          { field: 'transaction_date', weight: 0.3, comparison_type: 'date_range', tolerance: 3, required: true },
          { field: 'reference_number', weight: 0.2, comparison_type: 'exact', required: false },
          { field: 'description', weight: 0.1, comparison_type: 'fuzzy', required: false }
        ],
        tolerance_settings: {
          amount_tolerance_percentage: 0.01,
          amount_tolerance_absolute: 0.01,
          date_tolerance_days: 3,
          exchange_rate_tolerance: 0.02,
          require_currency_match: true,
          allow_partial_matches: true
        },
        priority: 1,
        is_active: true,
        auto_match_threshold: 0.95,
        manual_review_threshold: 0.70,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'payment_processor_reconciliation',
        name: 'Payment Processor Reconciliation',
        description: 'Match payment processor transactions with internal records',
        source_system: 'payment_processor',
        target_system: 'internal_ledger',
        matching_criteria: [
          { field: 'amount', weight: 0.4, comparison_type: 'exact', required: true },
          { field: 'transaction_id', weight: 0.3, comparison_type: 'exact', required: false },
          { field: 'transaction_date', weight: 0.2, comparison_type: 'date_range', tolerance: 1, required: true },
          { field: 'currency', weight: 0.1, comparison_type: 'exact', required: true }
        ],
        tolerance_settings: {
          amount_tolerance_percentage: 0.001,
          amount_tolerance_absolute: 0.001,
          date_tolerance_days: 1,
          exchange_rate_tolerance: 0.01,
          require_currency_match: true,
          allow_partial_matches: false
        },
        priority: 2,
        is_active: true,
        auto_match_threshold: 0.98,
        manual_review_threshold: 0.85,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    rules.forEach(rule => {
      this.reconciliationRules.set(rule.id, rule);
    });

    logger.info(`Initialized ${rules.length} reconciliation rules`);
  }

  /**
   * Start automated reconciliation processes
   */
  private startAutomatedReconciliation(): void {
    // Daily bank reconciliation
    setInterval(async () => {
      await this.performDailyReconciliation();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Payment processor reconciliation (every 4 hours)
    setInterval(async () => {
      await this.performPaymentProcessorReconciliation();
    }, 4 * 60 * 60 * 1000); // Every 4 hours

    // Intra-day cash position updates
    setInterval(async () => {
      await this.updateCashPosition();
    }, 30 * 60 * 1000); // Every 30 minutes

    logger.info('Started automated reconciliation processes');
  }

  /**
   * Perform daily bank reconciliation
   */
  async performDailyReconciliation(): Promise<ReconciliationProcess> {
    try {
      const process: ReconciliationProcess = {
        id: this.generateId(),
        process_name: 'Daily Bank Reconciliation',
        reconciliation_type: 'daily',
        status: 'in_progress',
        start_time: new Date(),
        total_transactions: 0,
        matched_transactions: 0,
        unmatched_transactions: 0,
        total_amount: 0,
        matched_amount: 0,
        variance_amount: 0,
        variance_percentage: 0,
        created_by: 'system',
        notes: [],
        attachments: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      this.reconciliationProcesses.set(process.id, process);

      // Get bank statement data
      const bankTransactions = await this.fetchBankTransactions(new Date(Date.now() - 24 * 60 * 60 * 1000));

      // Get internal ledger transactions
      const internalTransactions = await this.fetchInternalTransactions(new Date(Date.now() - 24 * 60 * 60 * 1000));

      process.total_transactions = bankTransactions.length + internalTransactions.length;

      // Apply matching rules
      const matches = await this.applyMatchingRules(bankTransactions, internalTransactions, 'bank_reconciliation_rule');

      // Process matches
      for (const match of matches) {
        await this.processTransactionMatch(match, process.id);
      }

      // Find unmatched transactions
      const unmatchedBank = await this.findUnmatchedTransactions(bankTransactions, matches);
      const unmatchedInternal = await this.findUnmatchedTransactions(internalTransactions, matches);

      // Create unmatched transaction records
      for (const transaction of [...unmatchedBank, ...unmatchedInternal]) {
        await this.createUnmatchedTransaction(transaction, process.id);
      }

      // Calculate final metrics
      process.matched_transactions = matches.length;
      process.unmatched_transactions = unmatchedBank.length + unmatchedInternal.length;
      process.total_amount = this.calculateTotalAmount([...bankTransactions, ...internalTransactions]);
      process.matched_amount = matches.reduce((sum, match) => sum + match.target_amount, 0);
      process.variance_amount = process.total_amount - process.matched_amount;
      process.variance_percentage = process.total_amount > 0 ? (process.variance_amount / process.total_amount) * 100 : 0;

      process.status = 'completed';
      process.end_time = new Date();
      process.updated_at = new Date();

      logger.info(`Completed daily bank reconciliation: ${process.matched_transactions} matched, ${process.unmatched_transactions} unmatched`);

      return process;
    } catch (error) {
      logger.error('Failed to perform daily bank reconciliation:', error);
      throw error;
    }
  }

  /**
   * Perform payment processor reconciliation
   */
  async performPaymentProcessorReconciliation(): Promise<ReconciliationProcess> {
    try {
      const process: ReconciliationProcess = {
        id: this.generateId(),
        process_name: 'Payment Processor Reconciliation',
        reconciliation_type: 'daily',
        status: 'in_progress',
        start_time: new Date(),
        total_transactions: 0,
        matched_transactions: 0,
        unmatched_transactions: 0,
        total_amount: 0,
        matched_amount: 0,
        variance_amount: 0,
        variance_percentage: 0,
        created_by: 'system',
        notes: [],
        attachments: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      // Get payment processor transactions
      const processorTransactions = await this.fetchPaymentProcessorTransactions(new Date(Date.now() - 4 * 60 * 60 * 1000));

      // Get corresponding internal transactions
      const internalTransactions = await this.fetchInternalPaymentTransactions(new Date(Date.now() - 4 * 60 * 60 * 1000));

      // Apply matching and process
      const matches = await this.applyMatchingRules(processorTransactions, internalTransactions, 'payment_processor_reconciliation');

      process.matched_transactions = matches.length;
      process.total_transactions = processorTransactions.length + internalTransactions.length;
      process.status = 'completed';
      process.end_time = new Date();
      process.updated_at = new Date();

      this.reconciliationProcesses.set(process.id, process);

      logger.info(`Completed payment processor reconciliation: ${process.matched_transactions} matched`);

      return process;
    } catch (error) {
      logger.error('Failed to perform payment processor reconciliation:', error);
      throw error;
    }
  }

  /**
   * Get real-time cash position
   */
  async getCashPosition(): Promise<CashPosition> {
    try {
      const cashPosition: CashPosition = {
        total_cash: 0,
        cash_by_currency: {},
        cash_by_account_type: {},
        cash_by_provider: {},
        pending_transactions: [],
        forecast_cash_flow: await this.generateCashFlowForecast(),
        liquidity_analysis: await this.performLiquidityAnalysis(),
        currency_exposure: await this.analyzeCurrencyExposure(),
        last_updated: new Date()
      };

      // Aggregate balances from all treasury accounts
      for (const account of this.treasuryAccounts.values()) {
        if (account.status === 'active') {
          cashPosition.total_cash += account.available_balance;

          // By currency
          cashPosition.cash_by_currency[account.currency] =
            (cashPosition.cash_by_currency[account.currency] || 0) + account.available_balance;

          // By account type
          cashPosition.cash_by_account_type[account.account_type] =
            (cashPosition.cash_by_account_type[account.account_type] || 0) + account.available_balance;

          // By provider
          cashPosition.cash_by_provider[account.provider] =
            (cashPosition.cash_by_provider[account.provider] || 0) + account.available_balance;
        }
      }

      // Get pending transactions
      cashPosition.pending_transactions = Array.from(this.pendingTransactions.values());

      return cashPosition;
    } catch (error) {
      logger.error('Failed to get cash position:', error);
      throw error;
    }
  }

  /**
   * Process payment settlement
   */
  async processPaymentSettlement(settlementData: Omit<PaymentSettlement, 'id' | 'settlement_status' | 'initiated_at'>): Promise<PaymentSettlement> {
    try {
      const settlement: PaymentSettlement = {
        id: this.generateId(),
        settlement_status: 'pending',
        initiated_at: new Date(),
        ...settlementData
      };

      // Validate settlement
      await this.validateSettlement(settlement);

      // Update account balances
      await this.updateAccountBalancesForSettlement(settlement);

      // Process settlement through appropriate method
      await this.executeSettlement(settlement);

      logger.info(`Processed payment settlement ${settlement.id} for amount ${settlement.total_amount} ${settlement.currency}`);

      return settlement;
    } catch (error) {
      logger.error('Failed to process payment settlement:', error);
      throw error;
    }
  }

  /**
   * Detect fraud in transactions
   */
  async detectFraud(transactionData: any): Promise<FraudDetection> {
    try {
      const fraudDetection: FraudDetection = {
        id: this.generateId(),
        transaction_id: transactionData.id,
        risk_score: 0,
        risk_factors: [],
        fraud_indicators: [],
        status: 'monitoring',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Apply fraud detection rules
      const riskScore = await this.calculateFraudRiskScore(transactionData);
      fraudDetection.risk_score = riskScore.score;
      fraudDetection.risk_factors = riskScore.factors;
      fraudDetection.fraud_indicators = riskScore.indicators;

      // Determine action based on risk score
      if (riskScore.score > 0.8) {
        fraudDetection.status = 'investigating';
        await this.triggerFraudInvestigation(fraudDetection);
      } else if (riskScore.score > 0.6) {
        fraudDetection.status = 'monitoring';
        await this.setEnhancedMonitoring(transactionData.id);
      }

      return fraudDetection;
    } catch (error) {
      logger.error('Failed to detect fraud:', error);
      throw error;
    }
  }

  /**
   * Perform compliance monitoring
   */
  async performComplianceCheck(entityId: string, entityType: 'customer' | 'transaction' | 'account'): Promise<ComplianceMonitoring[]> {
    try {
      const complianceChecks: ComplianceMonitoring[] = [];

      // AML check
      const amlCheck = await this.performAMLCheck(entityId, entityType);
      complianceChecks.push(amlCheck);

      // KYC check
      if (entityType === 'customer') {
        const kycCheck = await this.performKYCCheck(entityId);
        complianceChecks.push(kycCheck);
      }

      // Sanctions check
      const sanctionsCheck = await this.performSanctionsCheck(entityId, entityType);
      complianceChecks.push(sanctionsCheck);

      // Transaction limits check
      if (entityType === 'transaction') {
        const limitsCheck = await this.performTransactionLimitsCheck(entityId);
        complianceChecks.push(limitsCheck);
      }

      return complianceChecks;
    } catch (error) {
      logger.error('Failed to perform compliance check:', error);
      throw error;
    }
  }

  /**
   * Get reconciliation dashboard
   */
  async getReconciliationDashboard(): Promise<ReconciliationDashboard> {
    try {
      const dashboard: ReconciliationDashboard = {
        daily_reconciliation_status: await this.getReconciliationStatus('daily'),
        weekly_reconciliation_status: await this.getReconciliationStatus('weekly'),
        monthly_reconciliation_status: await this.getReconciliationStatus('monthly'),
        total_accounts_reconciled: 0,
        total_amount_reconciled: 0,
        variance_analysis: await this.performVarianceAnalysis(),
        upcoming_reconciliations: await this.getUpcomingReconciliations(),
        exception_summary: await this.getExceptionSummary()
      };

      return dashboard;
    } catch (error) {
      logger.error('Failed to get reconciliation dashboard:', error);
      throw error;
    }
  }

  // Private helper methods

  private async fetchBankTransactions(dateFrom: Date): Promise<any[]> {
    // Fetch bank transactions from bank APIs
    return [];
  }

  private async fetchInternalTransactions(dateFrom: Date): Promise<any[]> {
    // Fetch internal ledger transactions
    return [];
  }

  private async fetchPaymentProcessorTransactions(dateFrom: Date): Promise<any[]> {
    // Fetch payment processor transactions
    return [];
  }

  private async fetchInternalPaymentTransactions(dateFrom: Date): Promise<any[]> {
    // Fetch internal payment transactions
    return [];
  }

  private async applyMatchingRules(
    sourceTransactions: any[],
    targetTransactions: any[],
    ruleId: string
  ): Promise<TransactionMatch[]> {
    const rule = this.reconciliationRules.get(ruleId);
    if (!rule) {
      throw new Error(`Reconciliation rule ${ruleId} not found`);
    }

    const matches: TransactionMatch[] = [];

    for (const sourceTx of sourceTransactions) {
      for (const targetTx of targetTransactions) {
        const matchScore = await this.calculateMatchScore(sourceTx, targetTx, rule);

        if (matchScore >= rule.auto_match_threshold) {
          matches.push({
            id: this.generateId(),
            reconciliation_process_id: '',
            source_transaction_id: sourceTx.id,
            source_system: rule.source_system,
            target_transaction_id: targetTx.id,
            target_system: rule.target_system,
            source_amount: sourceTx.amount,
            target_amount: targetTx.amount,
            amount_variance: Math.abs(sourceTx.amount - targetTx.amount),
            currency: sourceTx.currency,
            match_confidence: matchScore,
            match_status: matchScore >= 0.99 ? 'perfect' : 'variance',
            match_rules: [ruleId],
            created_at: new Date()
          });
        }
      }
    }

    return matches;
  }

  private async calculateMatchScore(sourceTx: any, targetTx: any, rule: ReconciliationRule): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    for (const criteria of rule.matching_criteria) {
      let score = 0;
      const sourceValue = sourceTx[criteria.field];
      const targetValue = targetTx[criteria.field];

      if (criteria.comparison_type === 'exact') {
        score = sourceValue === targetValue ? 1 : 0;
      } else if (criteria.comparison_type === 'fuzzy') {
        score = this.calculateFuzzyMatch(sourceValue, targetValue);
      } else if (criteria.comparison_type === 'range') {
        const diff = Math.abs(parseFloat(sourceValue) - parseFloat(targetValue));
        score = diff <= (criteria.tolerance || 0) ? 1 : 0;
      } else if (criteria.comparison_type === 'date_range') {
        const diffDays = Math.abs(new Date(sourceValue).getTime() - new Date(targetValue).getTime()) / (1000 * 60 * 60 * 24);
        score = diffDays <= (criteria.tolerance || 0) ? 1 : 0;
      }

      if (criteria.required && score === 0) {
        return 0; // Required criteria not met
      }

      totalScore += score * criteria.weight;
      totalWeight += criteria.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateFuzzyMatch(str1: string, str2: string): number {
    // Simple fuzzy matching implementation
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

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

  private async processTransactionMatch(match: TransactionMatch, processId: string): Promise<void> {
    match.reconciliation_process_id = processId;
    // Store match and update related records
  }

  private async findUnmatchedTransactions(transactions: any[], matches: TransactionMatch[]): Promise<any[]> {
    const matchedIds = new Set([
      ...matches.map(m => m.source_transaction_id),
      ...matches.map(m => m.target_transaction_id)
    ]);

    return transactions.filter(tx => !matchedIds.has(tx.id));
  }

  private async createUnmatchedTransaction(transaction: any, processId: string): Promise<UnmatchedTransaction> {
    return {
      id: this.generateId(),
      reconciliation_process_id: processId,
      transaction_id: transaction.id,
      source_system: transaction.source_system || 'unknown',
      amount: transaction.amount,
      currency: transaction.currency,
      transaction_date: transaction.date,
      reference_number: transaction.reference_number,
      description: transaction.description,
      unmatched_reason: 'No matching transaction found',
      potential_matches: [],
      status: 'unmatched',
      created_at: new Date()
    };
  }

  private calculateTotalAmount(transactions: any[]): number {
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  private async updateCashPosition(): Promise<void> {
    // Update cash position with latest account balances
    logger.debug('Updated cash position');
  }

  private async generateCashFlowForecast(): Promise<CashFlowForecast> {
    // Generate cash flow forecast
    return {
      forecast_period: '',
      opening_balance: 0,
      inflows: [],
      outflows: [],
      net_cash_flow: 0,
      closing_balance: 0,
      confidence_level: 0,
      assumptions: [],
      scenarios: []
    };
  }

  private async performLiquidityAnalysis(): Promise<LiquidityAnalysis> {
    // Perform liquidity analysis
    return {
      current_ratio: 0,
      quick_ratio: 0,
      cash_ratio: 0,
      operating_cash_flow_ratio: 0,
      cash_conversion_cycle: 0,
      days_cash_on_hand: 0,
      liquidity_score: 0,
      recommendations: []
    };
  }

  private async analyzeCurrencyExposure(): Promise<CurrencyExposure> {
    // Analyze currency exposure
    return {
      base_currency: 'USD',
      exposures: [],
      total_exposure: 0,
      hedging_positions: [],
      unhedged_exposure: 0,
      value_at_risk: 0,
      stress_test_results: []
    };
  }

  private async validateSettlement(settlement: PaymentSettlement): Promise<void> {
    // Validate settlement data
    if (!settlement.source_account_id || !settlement.destination_account_id) {
      throw new Error('Source and destination accounts are required');
    }
  }

  private async updateAccountBalancesForSettlement(settlement: PaymentSettlement): Promise<void> {
    // Update account balances
    const sourceAccount = this.treasuryAccounts.get(settlement.source_account_id);
    const destAccount = this.treasuryAccounts.get(settlement.destination_account_id);

    if (sourceAccount) {
      sourceAccount.pending_debits += settlement.total_amount;
    }
    if (destAccount) {
      sourceAccount.pending_credits += settlement.total_amount;
    }
  }

  private async executeSettlement(settlement: PaymentSettlement): Promise<void> {
    // Execute settlement through appropriate payment method
    settlement.settlement_status = 'processing';
    // This would integrate with actual payment providers
  }

  private async calculateFraudRiskScore(transaction: any): Promise<{ score: number; factors: RiskFactor[]; indicators: FraudIndicator[] }> {
    // Calculate fraud risk score
    return {
      score: 0.1,
      factors: [],
      indicators: []
    };
  }

  private async triggerFraudInvestigation(fraudDetection: FraudDetection): Promise<void> {
    // Trigger fraud investigation process
    logger.warn(`Triggered fraud investigation for transaction ${fraudDetection.transaction_id}`);
  }

  private async setEnhancedMonitoring(transactionId: string): Promise<void> {
    // Set enhanced monitoring for transaction
    logger.info(`Set enhanced monitoring for transaction ${transactionId}`);
  }

  private async performAMLCheck(entityId: string, entityType: string): Promise<ComplianceMonitoring> {
    // Perform AML check
    return {
      id: this.generateId(),
      monitoring_type: 'aml',
      entity_id: entityId,
      entity_type: entityType as any,
      compliance_status: 'compliant',
      flags: [],
      last_checked: new Date(),
      next_check_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private async performKYCCheck(entityId: string): Promise<ComplianceMonitoring> {
    // Perform KYC check
    return {
      id: this.generateId(),
      monitoring_type: 'kyc',
      entity_id: entityId,
      entity_type: 'customer',
      compliance_status: 'compliant',
      flags: [],
      last_checked: new Date(),
      next_check_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  private async performSanctionsCheck(entityId: string, entityType: string): Promise<ComplianceMonitoring> {
    // Perform sanctions check
    return {
      id: this.generateId(),
      monitoring_type: 'sanctions',
      entity_id: entityId,
      entity_type: entityType as any,
      compliance_status: 'compliant',
      flags: [],
      last_checked: new Date(),
      next_check_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private async performTransactionLimitsCheck(entityId: string): Promise<ComplianceMonitoring> {
    // Perform transaction limits check
    return {
      id: this.generateId(),
      monitoring_type: 'transaction_limits',
      entity_id: entityId,
      entity_type: 'transaction',
      compliance_status: 'compliant',
      flags: [],
      last_checked: new Date(),
      next_check_date: new Date()
    };
  }

  private async getReconciliationStatus(type: 'daily' | 'weekly' | 'monthly'): Promise<ReconciliationStatus> {
    // Get reconciliation status for specified type
    return {
      status: 'completed',
      progress_percentage: 100,
      completed_accounts: 10,
      total_accounts: 10,
      last_completed: new Date(),
      issues_count: 0
    };
  }

  private async performVarianceAnalysis(): Promise<VarianceAnalysis> {
    // Perform variance analysis
    return {
      total_variance: 0,
      variance_percentage: 0,
      significant_variances: [],
      variance_trends: [],
      common_variance_reasons: []
    };
  }

  private async getUpcomingReconciliations(): Promise<UpcomingReconciliation[]> {
    // Get upcoming reconciliations
    return [];
  }

  private async getExceptionSummary(): Promise<ExceptionSummary> {
    // Get exception summary
    return {
      total_exceptions: 0,
      critical_exceptions: 0,
      high_priority_exceptions: 0,
      exceptions_by_type: {},
      exceptions_by_age: {},
      average_resolution_time: 0
    };
  }

  private generateId(): string {
    return `REC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}