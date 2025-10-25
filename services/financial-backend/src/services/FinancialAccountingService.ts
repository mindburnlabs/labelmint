// ============================================================================
// COMPREHENSIVE FINANCIAL ACCOUNTING SERVICE
// ============================================================================

import {
  ChartOfAccounts,
  JournalEntry,
  FinancialTransaction,
  GeneralLedger,
  TrialBalance,
  AccountingPeriod,
  FinancialStatement,
  FinancialStatementType,
  TransactionType,
  RevenueRecognitionRule,
  DeferredRevenue,
  AccountsPayable,
  AccountsReceivable,
  FinancialClose,
  BankReconciliation,
  Budget,
  BudgetVariance
} from '../types/financial.types';
import { Logger } from '../utils/logger';

const logger = new Logger('FinancialAccountingService');

export class FinancialAccountingService {
  private chartOfAccounts: ChartOfAccounts;
  private activePeriod: AccountingPeriod | null = null;
  private revenueRecognitionRules: Map<string, RevenueRecognitionRule> = new Map();

  constructor() {
    this.initializeChartOfAccounts();
    this.loadRevenueRecognitionRules();
  }

  /**
   * Initialize the comprehensive chart of accounts
   */
  private initializeChartOfAccounts(): void {
    this.chartOfAccounts = {
      revenue_accounts: {
        platform_fees: {
          transaction_fees: ['4001', '4002', '4003'],
          service_fees: ['4010', '4011', '4012'],
          processing_fees: ['4020', '4021', '4022'],
          escrow_fees: ['4030', '4031', '4032'],
          withdrawal_fees: ['4040', '4041', '4042']
        },
        subscription_revenue: {
          starter_plans: ['4100', '4101', '4102'],
          professional_plans: ['4110', '4111', '4112'],
          enterprise_plans: ['4120', '4121', '4122'],
          custom_plans: ['4130', '4131', '4132'],
          add_on_services: ['4140', '4141', '4142']
        },
        usage_based_billing: {
          api_calls: ['4200', '4201', '4202'],
          storage_usage: ['4210', '4211', '4212'],
          bandwidth_usage: ['4220', '4221', '4222'],
          processing_units: ['4230', '4231', '4232'],
          premium_features: ['4240', '4241', '4242']
        },
        professional_services: {
          implementation_services: ['4300', '4301', '4302'],
          consulting_services: ['4310', '4311', '4312'],
          training_services: ['4320', '4321', '4322'],
          support_services: ['4330', '4331', '4332'],
          custom_development: ['4340', '4341', '4342']
        },
        other_revenue: {
          interest_income: ['4900', '4901', '4902'],
          partnership_revenue: ['4910', '4911', '4912'],
          affiliate_income: ['4920', '4921', '4922'],
          miscellaneous_income: ['4990', '4991', '4992']
        }
      },
      expense_accounts: {
        infrastructure_costs: {
          aws_compute: ['5001', '5002', '5003'],
          aws_storage: ['5010', '5011', '5012'],
          aws_network: ['5020', '5021', '5022'],
          aws_database: ['5030', '5031', '5032'],
          monitoring_tools: ['5040', '5041', '5042'],
          security_tools: ['5050', '5051', '5052']
        },
        personnel_costs: {
          salaries_wages: ['5100', '5101', '5102'],
          contractor_fees: ['5110', '5111', '5112'],
          benefits_payroll_taxes: ['5120', '5121', '5122'],
          recruitment_costs: ['5130', '5131', '5132'],
          training_development: ['5140', '5141', '5142']
        },
        payment_processing: {
          blockchain_gas_fees: ['5200', '5201', '5202'],
          payment_gateway_fees: ['5210', '5211', '5212'],
          currency_conversion_fees: ['5220', '5221', '5222'],
          compliance_costs: ['5230', '5231', '5232'],
          fraud_detection: ['5240', '5241', '5242']
        },
        marketing_costs: {
          digital_marketing: ['5300', '5301', '5302'],
          content_marketing: ['5310', '5311', '5312'],
          events_conferences: ['5320', '5321', '5322'],
          sales_commissions: ['5330', '5331', '5332'],
          partnership_marketing: ['5340', '5341', '5342']
        },
        administrative_costs: {
          office_expenses: ['5400', '5401', '5402'],
          software_licenses: ['5410', '5411', '5412'],
          professional_services: ['5420', '5421', '5422'],
          insurance: ['5430', '5431', '5432'],
          legal_compliance: ['5440', '5441', '5442']
        }
      },
      asset_accounts: {
        current_assets: {
          cash_accounts: ['1000', '1001', '1002'],
          accounts_receivable: ['1100', '1101', '1102'],
          prepaid_expenses: ['1200', '1201', '1202'],
          short_term_investments: ['1300', '1301', '1302'],
          inventory: ['1400', '1401', '1402']
        },
        fixed_assets: {
          computer_equipment: ['1500', '1501', '1502'],
          office_furniture: ['1510', '1511', '1512'],
          software_development: ['1520', '1521', '1522'],
          leasehold_improvements: ['1530', '1531', '1532'],
          accumulated_depreciation: ['1590', '1591', '1592']
        },
        intangible_assets: {
          intellectual_property: ['1600', '1601', '1602'],
          goodwill: ['1610', '1611', '1612'],
          software_licenses: ['1620', '1621', '1622'],
          customer_relationships: ['1630', '1631', '1632'],
          amortization: ['1690', '1691', '1692']
        }
      },
      liability_accounts: {
        current_liabilities: {
          accounts_payable: ['2000', '2001', '2002'],
          accrued_expenses: ['2010', '2011', '2012'],
          deferred_revenue: ['2020', '2021', '2022'],
          short_term_debt: ['2030', '2031', '2032'],
          taxes_payable: ['2040', '2041', '2042']
        },
        long_term_liabilities: {
          long_term_debt: ['2100', '2101', '2102'],
          deferred_tax_liabilities: ['2110', '2111', '2112'],
          lease_obligations: ['2120', '2121', '2122'],
          contingent_liabilities: ['2130', '2131', '2132']
        }
      },
      equity_accounts: {
        owners_equity: {
          common_stock: ['3000', '3001', '3002'],
          additional_paid_in_capital: ['3010', '3011', '3012'],
          retained_earnings: ['3020', '3021', '3022'],
          treasury_stock: ['3030', '3031', '3032'],
          comprehensive_income: ['3040', '3041', '3042']
        }
      }
    };

    logger.info('Chart of accounts initialized successfully');
  }

  /**
   * Create a new journal entry with double-entry bookkeeping
   */
  async createJournalEntry(entryData: Omit<JournalEntry, 'id' | 'total_debits' | 'total_credits' | 'status' | 'created_at'>): Promise<JournalEntry> {
    try {
      // Validate debits equal credits
      const totalDebits = entryData.entries.reduce((sum, line) => sum + line.debit_amount, 0);
      const totalCredits = entryData.entries.reduce((sum, line) => sum + line.credit_amount, 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
      }

      // Validate account numbers exist in chart of accounts
      await this.validateAccounts(entryData.entries);

      const journalEntry: JournalEntry = {
        id: this.generateId(),
        entry_number: await this.generateEntryNumber(),
        ...entryData,
        total_debits: totalDebits,
        total_credits: totalCredits,
        status: 'draft',
        created_at: new Date()
      };

      // Post to general ledger if status is posted
      if (entryData.status === 'posted') {
        await this.postJournalEntry(journalEntry);
      }

      logger.info(`Created journal entry ${journalEntry.entry_number} with ${entryData.entries.length} lines`);

      return journalEntry;
    } catch (error) {
      logger.error('Failed to create journal entry:', error);
      throw error;
    }
  }

  /**
   * Post journal entry to general ledger
   */
  async postJournalEntry(journalEntry: JournalEntry): Promise<void> {
    try {
      for (const line of journalEntry.entries) {
        await this.updateGeneralLedger(line, journalEntry);
      }

      journalEntry.status = 'posted';
      journalEntry.posted_at = new Date();

      logger.info(`Posted journal entry ${journalEntry.entry_number} to general ledger`);
    } catch (error) {
      logger.error(`Failed to post journal entry ${journalEntry.entry_number}:`, error);
      throw error;
    }
  }

  /**
   * Record financial transaction from external systems
   */
  async recordFinancialTransaction(transaction: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<FinancialTransaction> {
    try {
      const financialTransaction: FinancialTransaction = {
        id: this.generateId(),
        ...transaction,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create automatic journal entry based on transaction type
      const journalEntry = await this.createJournalEntryFromTransaction(financialTransaction);

      // Post the journal entry
      await this.postJournalEntry(journalEntry);

      // Handle revenue recognition for applicable transactions
      if (transaction.transaction_type === TransactionType.REVENUE) {
        await this.processRevenueRecognition(financialTransaction);
      }

      logger.info(`Recorded financial transaction ${financialTransaction.id} from ${transaction.source_system}`);

      return financialTransaction;
    } catch (error) {
      logger.error('Failed to record financial transaction:', error);
      throw error;
    }
  }

  /**
   * Generate trial balance for a period
   */
  async generateTrialBalance(periodId: string): Promise<TrialBalance> {
    try {
      const generalLedgerAccounts = await this.getGeneralLedgerAccounts(periodId);

      let totalDebits = 0;
      let totalCredits = 0;

      const accounts: any[] = generalLedgerAccounts.map(account => {
        const debitBalance = account.balance > 0 &&
          ['asset', 'expense'].includes(account.account_type) ? account.balance : 0;
        const creditBalance = account.balance > 0 &&
          ['liability', 'equity', 'revenue'].includes(account.account_type) ? account.balance : 0;

        totalDebits += debitBalance;
        totalCredits += creditBalance;

        return {
          account_number: account.account_number,
          account_name: account.account_name,
          account_type: account.account_type,
          debit_balance: debitBalance,
          credit_balance: creditBalance
        };
      });

      const trialBalance: TrialBalance = {
        period_id: periodId,
        generated_at: new Date(),
        accounts,
        total_debits: totalDebits,
        total_credits: totalCredits,
        is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
      };

      if (!trialBalance.is_balanced) {
        logger.warn(`Trial balance is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`);
      }

      return trialBalance;
    } catch (error) {
      logger.error('Failed to generate trial balance:', error);
      throw error;
    }
  }

  /**
   * Generate financial statements
   */
  async generateFinancialStatement(
    periodId: string,
    statementType: FinancialStatementType
  ): Promise<FinancialStatement> {
    try {
      let statementData: any;

      switch (statementType) {
        case FinancialStatementType.INCOME_STATEMENT:
          statementData = await this.generateIncomeStatement(periodId);
          break;
        case FinancialStatementType.BALANCE_SHEET:
          statementData = await this.generateBalanceSheet(periodId);
          break;
        case FinancialStatementType.CASH_FLOW_STATEMENT:
          statementData = await this.generateCashFlowStatement(periodId);
          break;
        case FinancialStatementType.STATEMENT_OF_EQUITY:
          statementData = await this.generateStatementOfEquity(periodId);
          break;
        default:
          throw new Error(`Unsupported statement type: ${statementType}`);
      }

      const financialStatement: FinancialStatement = {
        id: this.generateId(),
        statement_type: statementType,
        period_id: periodId,
        generated_at: new Date(),
        data: statementData,
        status: 'draft',
        created_by: 'system',
        notes: []
      };

      logger.info(`Generated ${statementType} for period ${periodId}`);

      return financialStatement;
    } catch (error) {
      logger.error(`Failed to generate ${statementType}:`, error);
      throw error;
    }
  }

  /**
   * Process accounts receivable and collections
   */
  async processAccountsReceivable(invoiceData: Omit<AccountsReceivable, 'id' | 'created_at' | 'updated_at'>): Promise<AccountsReceivable> {
    try {
      const accountsReceivable: AccountsReceivable = {
        id: this.generateId(),
        ...invoiceData,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create journal entry for the receivable
      const journalEntryData = {
        date: invoiceData.invoice_date,
        description: `Invoice ${invoiceData.invoice_number} - ${invoiceData.customer_id}`,
        period_id: this.activePeriod?.id || '',
        entries: [
          {
            account_number: '1100', // Accounts Receivable
            account_name: 'Accounts Receivable',
            account_type: 'asset' as const,
            debit_amount: invoiceData.total_amount,
            credit_amount: 0,
            description: invoiceData.invoice_number
          },
          {
            account_number: '4001', // Revenue
            account_name: 'Service Revenue',
            account_type: 'revenue' as const,
            debit_amount: 0,
            credit_amount: invoiceData.amount,
            description: invoiceData.invoice_number
          }
        ],
        created_by: 'system',
        status: 'posted' as const,
        attachments: invoiceData.attachments,
        metadata: { invoice_id: accountsReceivable.id }
      };

      await this.createJournalEntry(journalEntryData);

      // Handle tax if applicable
      if (invoiceData.tax_amount && invoiceData.tax_amount > 0) {
        const taxEntryData = {
          date: invoiceData.invoice_date,
          description: `Sales tax on invoice ${invoiceData.invoice_number}`,
          period_id: this.activePeriod?.id || '',
          entries: [
            {
              account_number: '1100', // Accounts Receivable
              account_name: 'Accounts Receivable',
              account_type: 'asset' as const,
              debit_amount: invoiceData.tax_amount,
              credit_amount: 0,
              description: `Tax on ${invoiceData.invoice_number}`
            },
            {
              account_number: '2040', // Sales Tax Payable
              account_name: 'Sales Tax Payable',
              account_type: 'liability' as const,
              debit_amount: 0,
              credit_amount: invoiceData.tax_amount,
              description: `Tax on ${invoiceData.invoice_number}`
            }
          ],
          created_by: 'system',
          status: 'posted' as const,
          metadata: { invoice_id: accountsReceivable.id, tax_entry: true }
        };

        await this.createJournalEntry(taxEntryData);
      }

      logger.info(`Processed accounts receivable for invoice ${invoiceData.invoice_number}`);

      return accountsReceivable;
    } catch (error) {
      logger.error('Failed to process accounts receivable:', error);
      throw error;
    }
  }

  /**
   * Process accounts payable
   */
  async processAccountsPayable(invoiceData: Omit<AccountsPayable, 'id' | 'created_at' | 'updated_at'>): Promise<AccountsPayable> {
    try {
      const accountsPayable: AccountsPayable = {
        id: this.generateId(),
        ...invoiceData,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create journal entry for the payable
      const journalEntryData = {
        date: invoiceData.invoice_date,
        description: `Vendor invoice ${invoiceData.invoice_number} - ${invoiceData.vendor_id}`,
        period_id: this.activePeriod?.id || '',
        entries: [
          {
            account_number: this.getExpenseAccountForVendor(invoiceData.vendor_id),
            account_name: 'Operating Expenses',
            account_type: 'expense' as const,
            debit_amount: invoiceData.amount,
            credit_amount: 0,
            description: invoiceData.invoice_number
          },
          {
            account_number: '2000', // Accounts Payable
            account_name: 'Accounts Payable',
            account_type: 'liability' as const,
            debit_amount: 0,
            credit_amount: invoiceData.total_amount,
            description: invoiceData.invoice_number
          }
        ],
        created_by: 'system',
        status: 'posted' as const,
        attachments: invoiceData.attachments,
        metadata: { vendor_invoice_id: accountsPayable.id }
      };

      await this.createJournalEntry(journalEntryData);

      logger.info(`Processed accounts payable for invoice ${invoiceData.invoice_number}`);

      return accountsPayable;
    } catch (error) {
      logger.error('Failed to process accounts payable:', error);
      throw error;
    }
  }

  /**
   * Handle revenue recognition according to ASC 606
   */
  async processRevenueRecognition(transaction: FinancialTransaction): Promise<void> {
    try {
      const rules = this.getRevenueRecognitionRules(transaction.category);

      for (const rule of rules) {
        if (this.shouldRecognizeRevenue(transaction, rule)) {
          await this.applyRevenueRecognition(transaction, rule);
        }
      }
    } catch (error) {
      logger.error('Failed to process revenue recognition:', error);
      throw error;
    }
  }

  /**
   * Create and manage accounting periods
   */
  async createAccountingPeriod(periodData: Omit<AccountingPeriod, 'id' | 'status' | 'created_at'>): Promise<AccountingPeriod> {
    try {
      const accountingPeriod: AccountingPeriod = {
        id: this.generateId(),
        ...periodData,
        status: 'open',
        created_at: new Date()
      };

      // Close previous period if needed
      if (this.activePeriod) {
        await this.closeAccountingPeriod(this.activePeriod.id);
      }

      this.activePeriod = accountingPeriod;

      logger.info(`Created accounting period ${accountingPeriod.id} for ${accountingPeriod.fiscal_year}`);

      return accountingPeriod;
    } catch (error) {
      logger.error('Failed to create accounting period:', error);
      throw error;
    }
  }

  /**
   * Close accounting period
   */
  async closeAccountingPeriod(periodId: string): Promise<void> {
    try {
      // Generate trial balance
      const trialBalance = await this.generateTrialBalance(periodId);

      if (!trialBalance.is_balanced) {
        throw new Error('Cannot close period: Trial balance is not balanced');
      }

      // Generate closing entries
      await this.generateClosingEntries(periodId);

      // Update period status
      // This would typically update the database
      this.activePeriod = null;

      logger.info(`Successfully closed accounting period ${periodId}`);
    } catch (error) {
      logger.error(`Failed to close accounting period ${periodId}:`, error);
      throw error;
    }
  }

  /**
   * Generate financial close checklist
   */
  async initiateFinancialClose(periodId: string, closeType: 'monthly' | 'quarterly' | 'annual'): Promise<FinancialClose> {
    try {
      const financialClose: FinancialClose = {
        id: this.generateId(),
        period_id: periodId,
        close_type: closeType,
        status: 'in_progress',
        start_date: new Date(),
        target_completion_date: this.calculateTargetCompletionDate(closeType),
        close_checklist: this.generateCloseChecklist(closeType),
        created_by: 'system',
        notes: []
      };

      logger.info(`Initiated ${closeType} financial close for period ${periodId}`);

      return financialClose;
    } catch (error) {
      logger.error('Failed to initiate financial close:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateId(): string {
    return `FIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateEntryNumber(): Promise<string> {
    // This would typically query the database for the next entry number
    const sequence = await this.getNextSequence('journal_entry');
    return `JE${new Date().getFullYear()}${sequence.toString().padStart(6, '0')}`;
  }

  private async validateAccounts(entries: any[]): Promise<void> {
    for (const entry of entries) {
      if (!this.isValidAccountNumber(entry.account_number)) {
        throw new Error(`Invalid account number: ${entry.account_number}`);
      }
    }
  }

  private isValidAccountNumber(accountNumber: string): boolean {
    // Check if account number exists in chart of accounts
    const allAccounts = [
      ...Object.values(this.chartOfAccounts.revenue_accounts).flat(),
      ...Object.values(this.chartOfAccounts.expense_accounts).flat(),
      ...Object.values(this.chartOfAccounts.asset_accounts).flat(),
      ...Object.values(this.chartOfAccounts.liability_accounts).flat(),
      ...Object.values(this.chartOfAccounts.equity_accounts).flat()
    ].flat();

    return allAccounts.includes(accountNumber);
  }

  private async updateGeneralLedger(line: any, journalEntry: JournalEntry): Promise<void> {
    // This would typically update the general ledger in the database
    logger.debug(`Updating general ledger for account ${line.account_number}`);
  }

  private async createJournalEntryFromTransaction(transaction: FinancialTransaction): Promise<JournalEntry> {
    // This would create appropriate journal entries based on transaction type
    throw new Error('Not implemented');
  }

  private async getGeneralLedgerAccounts(periodId: string): Promise<any[]> {
    // This would query the database for general ledger accounts
    return [];
  }

  private async generateIncomeStatement(periodId: string): Promise<any> {
    // Generate income statement data
    return {
      revenue: 0,
      expenses: 0,
      net_income: 0
    };
  }

  private async generateBalanceSheet(periodId: string): Promise<any> {
    // Generate balance sheet data
    return {
      assets: 0,
      liabilities: 0,
      equity: 0
    };
  }

  private async generateCashFlowStatement(periodId: string): Promise<any> {
    // Generate cash flow statement data
    return {
      operating_cash_flow: 0,
      investing_cash_flow: 0,
      financing_cash_flow: 0,
      net_cash_flow: 0
    };
  }

  private async generateStatementOfEquity(periodId: string): Promise<any> {
    // Generate statement of equity data
    return {
      beginning_balance: 0,
      net_income: 0,
      dividends: 0,
      ending_balance: 0
    };
  }

  private getExpenseAccountForVendor(vendorId: string): string {
    // This would typically look up the default expense account for a vendor
    return '5001'; // Default to operating expenses
  }

  private getRevenueRecognitionRules(category: string): RevenueRecognitionRule[] {
    // Return applicable revenue recognition rules
    return Array.from(this.revenueRecognitionRules.values())
      .filter(rule => rule.revenue_stream === category && rule.is_active);
  }

  private shouldRecognizeRevenue(transaction: FinancialTransaction, rule: RevenueRecognitionRule): boolean {
    // Check if transaction meets conditions for revenue recognition
    return rule.conditions.every(condition => {
      // Evaluate conditions
      return true;
    });
  }

  private async applyRevenueRecognition(transaction: FinancialTransaction, rule: RevenueRecognitionRule): Promise<void> {
    // Apply revenue recognition based on rule
    logger.info(`Applying revenue recognition rule ${rule.name} to transaction ${transaction.id}`);
  }

  private loadRevenueRecognitionRules(): void {
    // Load revenue recognition rules from configuration or database
    logger.info('Revenue recognition rules loaded');
  }

  private async getNextSequence(sequenceName: string): Promise<number> {
    // Get next sequence number from database
    return Math.floor(Math.random() * 999999);
  }

  private calculateTargetCompletionDate(closeType: 'monthly' | 'quarterly' | 'annual'): Date {
    const now = new Date();
    switch (closeType) {
      case 'monthly':
        return new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
      case 'quarterly':
        return new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days
      case 'annual':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  private generateCloseChecklist(closeType: 'monthly' | 'quarterly' | 'annual'): any[] {
    const baseChecklist = [
      {
        id: '1',
        task_name: 'Verify all transactions posted',
        description: 'Ensure all transactions for the period have been posted',
        responsible_person: 'accountant',
        status: 'pending' as const,
        due_date: new Date(),
        dependencies: []
      },
      {
        id: '2',
        task_name: 'Reconcile bank accounts',
        description: 'Complete bank reconciliation for all accounts',
        responsible_person: 'accountant',
        status: 'pending' as const,
        due_date: new Date(),
        dependencies: ['1']
      }
    ];

    if (closeType === 'quarterly' || closeType === 'annual') {
      baseChecklist.push({
        id: '3',
        task_name: 'Review and adjust accruals',
        description: 'Review and adjust prepaid expenses and accrued liabilities',
        responsible_person: 'senior_accountant',
        status: 'pending' as const,
        due_date: new Date(),
        dependencies: ['2']
      });
    }

    if (closeType === 'annual') {
      baseChecklist.push(
        {
          id: '4',
          task_name: 'Fixed asset depreciation',
          description: 'Calculate and record depreciation expense',
          responsible_person: 'accountant',
          status: 'pending' as const,
          due_date: new Date(),
          dependencies: ['3']
        },
        {
          id: '5',
          task_name: 'Year-end tax provisioning',
          description: 'Calculate and record tax provisions',
          responsible_person: 'tax_manager',
          status: 'pending' as const,
          due_date: new Date(),
          dependencies: ['4']
        }
      );
    }

    return baseChecklist;
  }

  private async generateClosingEntries(periodId: string): Promise<void> {
    // Generate closing entries to reset temporary accounts
    logger.info(`Generating closing entries for period ${periodId}`);
  }
}