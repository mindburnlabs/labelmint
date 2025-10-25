// ============================================================================
// COMPREHENSIVE FINANCIAL CONTROL SYSTEM - TYPE DEFINITIONS
// ============================================================================

export interface ChartOfAccounts {
  revenue_accounts: RevenueAccounts;
  expense_accounts: ExpenseAccounts;
  asset_accounts: AssetAccounts;
  liability_accounts: LiabilityAccounts;
  equity_accounts: EquityAccounts;
}

export interface RevenueAccounts {
  // Platform Revenue Streams
  platform_fees: {
    transaction_fees: string[];
    service_fees: string[];
    processing_fees: string[];
    escrow_fees: string[];
    withdrawal_fees: string[];
  };

  // Subscription Revenue
  subscription_revenue: {
    starter_plans: string[];
    professional_plans: string[];
    enterprise_plans: string[];
    custom_plans: string[];
    add_on_services: string[];
  };

  // Usage-Based Revenue
  usage_based_billing: {
    api_calls: string[];
    storage_usage: string[];
    bandwidth_usage: string[];
    processing_units: string[];
    premium_features: string[];
  };

  // Professional Services
  professional_services: {
    implementation_services: string[];
    consulting_services: string[];
    training_services: string[];
    support_services: string[];
    custom_development: string[];
  };

  // Other Revenue
  other_revenue: {
    interest_income: string[];
    partnership_revenue: string[];
    affiliate_income: string[];
    miscellaneous_income: string[];
  };
}

export interface ExpenseAccounts {
  // Infrastructure Costs
  infrastructure_costs: {
    aws_compute: string[];
    aws_storage: string[];
    aws_network: string[];
    aws_database: string[];
    monitoring_tools: string[];
    security_tools: string[];
  };

  // Personnel Costs
  personnel_costs: {
    salaries_wages: string[];
    contractor_fees: string[];
    benefits_payroll_taxes: string[];
    recruitment_costs: string[];
    training_development: string[];
  };

  // Payment Processing Costs
  payment_processing: {
    blockchain_gas_fees: string[];
    payment_gateway_fees: string[];
    currency_conversion_fees: string[];
    compliance_costs: string[];
    fraud_detection: string[];
  };

  // Marketing & Sales
  marketing_costs: {
    digital_marketing: string[];
    content_marketing: string[];
    events_conferences: string[];
    sales_commissions: string[];
    partnership_marketing: string[];
  };

  // General & Administrative
  administrative_costs: {
    office_expenses: string[];
    software_licenses: string[];
    professional_services: string[];
    insurance: string[];
    legal_compliance: string[];
  };
}

export interface AssetAccounts {
  // Current Assets
  current_assets: {
    cash_accounts: string[];
    accounts_receivable: string[];
    prepaid_expenses: string[];
    short_term_investments: string[];
    inventory: string[];
  };

  // Fixed Assets
  fixed_assets: {
    computer_equipment: string[];
    office_furniture: string[];
    software_development: string[];
    leasehold_improvements: string[];
    accumulated_depreciation: string[];
  };

  // Intangible Assets
  intangible_assets: {
    intellectual_property: string[];
    goodwill: string[];
    software_licenses: string[];
    customer_relationships: string[];
    amortization: string[];
  };
}

export interface LiabilityAccounts {
  // Current Liabilities
  current_liabilities: {
    accounts_payable: string[];
    accrued_expenses: string[];
    deferred_revenue: string[];
    short_term_debt: string[];
    taxes_payable: string[];
  };

  // Long-term Liabilities
  long_term_liabilities: {
    long_term_debt: string[];
    deferred_tax_liabilities: string[];
    lease_obligations: string[];
    contingent_liabilities: string[];
  };
}

export interface EquityAccounts {
  // Owner's Equity
  owners_equity: {
    common_stock: string[];
    additional_paid_in_capital: string[];
    retained_earnings: string[];
    treasury_stock: string[];
    comprehensive_income: string[];
  };
}

export interface AccountingPeriod {
  id: string;
  start_date: Date;
  end_date: Date;
  fiscal_year: number;
  fiscal_quarter?: number;
  status: 'open' | 'closed' | 'adjusting';
  created_at: Date;
  closed_at?: Date;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  date: Date;
  description: string;
  period_id: string;
  entries: JournalEntryLine[];
  total_debits: number;
  total_credits: number;
  status: 'draft' | 'posted' | 'reversed';
  created_by: string;
  approved_by?: string;
  posted_at?: Date;
  attachments: string[];
  metadata: Record<string, any>;
}

export interface JournalEntryLine {
  account_number: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debit_amount: number;
  credit_amount: number;
  description?: string;
  cost_center?: string;
  department?: string;
  project?: string;
  tax_code?: string;
}

export interface FinancialTransaction {
  id: string;
  transaction_date: Date;
  amount: number;
  currency: string;
  transaction_type: TransactionType;
  source_system: string;
  source_transaction_id: string;
  customer_id?: string;
  vendor_id?: string;
  description: string;
  category: string;
  subcategory?: string;
  tax_amount?: number;
  tax_jurisdiction?: string;
  exchange_rate?: number;
  base_currency_amount: number;
  payment_method?: string;
  reference_number?: string;
  attachments: string[];
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export enum TransactionType {
  REVENUE = 'revenue',
  EXPENSE = 'expense',
  ASSET_PURCHASE = 'asset_purchase',
  ASSET_SALE = 'asset_sale',
  DEBT_ISSUANCE = 'debt_issuance',
  DEBT_REPAYMENT = 'debt_repayment',
  EQUITY_ISSUANCE = 'equity_issuance',
  EQUITY_REPURCHASE = 'equity_repurchase',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment'
}

export interface GeneralLedger {
  account_number: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
  currency: string;
  last_updated: Date;
  entries: LedgerEntry[];
}

export interface LedgerEntry {
  id: string;
  date: Date;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  journal_entry_id: string;
  transaction_id?: string;
  created_at: Date;
}

export interface TrialBalance {
  period_id: string;
  generated_at: Date;
  accounts: TrialBalanceAccount[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

export interface TrialBalanceAccount {
  account_number: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface FinancialStatement {
  id: string;
  statement_type: FinancialStatementType;
  period_id: string;
  generated_at: Date;
  data: any;
  status: 'draft' | 'final' | 'restated';
  created_by: string;
  approved_by?: string;
  approved_at?: Date;
  notes: string[];
}

export enum FinancialStatementType {
  INCOME_STATEMENT = 'income_statement',
  BALANCE_SHEET = 'balance_sheet',
  CASH_FLOW_STATEMENT = 'cash_flow_statement',
  STATEMENT_OF_EQUITY = 'statement_of_equity',
  NOTES_TO_FINANCIAL_STATEMENTS = 'notes_to_financial_statements'
}

export interface RevenueRecognitionRule {
  id: string;
  name: string;
  description: string;
  revenue_stream: string;
  recognition_method: RecognitionMethod;
  recognition_period_days?: number;
  percentage_recognition?: number;
  conditions: RecognitionCondition[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export enum RecognitionMethod {
  IMMEDIATE = 'immediate',
  PROPORTIONAL = 'proportional',
  MILESTONE_BASED = 'milestone_based',
  TIME_BASED = 'time_based',
  DELIVERY_BASED = 'delivery_based'
}

export interface RecognitionCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  description: string;
}

export interface DeferredRevenue {
  id: string;
  customer_id: string;
  contract_id: string;
  total_amount: number;
  currency: string;
  recognized_amount: number;
  remaining_amount: number;
  start_date: Date;
  end_date: Date;
  recognition_schedule: RevenueRecognitionSchedule[];
  status: 'active' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface RevenueRecognitionSchedule {
  id: string;
  deferred_revenue_id: string;
  recognition_date: Date;
  amount_to_recognize: number;
  recognized_amount: number;
  status: 'pending' | 'recognized' | 'overdue';
  recognized_at?: Date;
  journal_entry_id?: string;
}

export interface TaxConfiguration {
  id: string;
  tax_jurisdiction: string;
  tax_name: string;
  tax_rate: number;
  tax_type: 'sales_tax' | 'vat' | 'gst' | 'income_tax' | 'other';
  is_compound: boolean;
  applies_to: string[];
  effective_date: Date;
  expiry_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TaxReport {
  id: string;
  tax_jurisdiction: string;
  report_period_start: Date;
  report_period_end: Date;
  total_taxable_amount: number;
  total_tax_collected: number;
  total_tax_paid: number;
  net_tax_liability: number;
  transactions: TaxTransaction[];
  status: 'draft' | 'filed' | 'amended';
  filed_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TaxTransaction {
  transaction_id: string;
  transaction_date: Date;
  taxable_amount: number;
  tax_amount: number;
  tax_rate: number;
  tax_type: string;
  customer_tax_id?: string;
  exemption_reason?: string;
}

export interface AccountsPayable {
  id: string;
  vendor_id: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  amount: number;
  currency: string;
  tax_amount?: number;
  total_amount: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'disputed';
  amount_paid: number;
  remaining_amount: number;
  payment_terms: string;
  department?: string;
  cost_center?: string;
  project?: string;
  attachments: string[];
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export interface AccountsReceivable {
  id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  amount: number;
  currency: string;
  tax_amount?: number;
  total_amount: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'written_off';
  amount_paid: number;
  remaining_amount: number;
  payment_terms: string;
  days_overdue?: number;
  collection_status?: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  dunning_level?: number;
  last_dunning_date?: Date;
  attachments: string[];
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export interface FinancialClose {
  id: string;
  period_id: string;
  close_type: 'monthly' | 'quarterly' | 'annual';
  status: 'in_progress' | 'review' | 'completed' | 'failed';
  start_date: Date;
  target_completion_date: Date;
  actual_completion_date?: Date;
  close_checklist: CloseChecklistItem[];
  created_by: string;
  reviewed_by?: string;
  approved_by?: string;
  notes: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CloseChecklistItem {
  id: string;
  task_name: string;
  description: string;
  responsible_person: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  due_date: Date;
  completed_at?: Date;
  notes?: string;
  dependencies?: string[];
}

export interface BankReconciliation {
  id: string;
  bank_account_id: string;
  reconciliation_date: Date;
  statement_balance: number;
  book_balance: number;
  reconciled_items: ReconciledItem[];
  unreconciled_items: UnreconciledItem[];
  adjustment_entries: AdjustmentEntry[];
  status: 'in_progress' | 'completed' | 'failed';
  reconciled_by: string;
  reconciled_at?: Date;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ReconciledItem {
  transaction_id: string;
  statement_line_id?: string;
  amount: number;
  reconciliation_date: Date;
  status: 'matched' | 'adjusted';
}

export interface UnreconciledItem {
  type: 'book_only' | 'statement_only';
  amount: number;
  description: string;
  date: Date;
  reason?: string;
}

export interface AdjustmentEntry {
  id: string;
  journal_entry_id: string;
  description: string;
  amount: number;
  adjustment_type: 'bank_fee' | 'error_correction' | 'timing_difference' | 'other';
  created_at: Date;
}

export interface Budget {
  id: string;
  name: string;
  description: string;
  fiscal_year: number;
  fiscal_quarter?: number;
  department?: string;
  cost_center?: string;
  budget_type: 'operating' | 'capital' | 'project';
  status: 'draft' | 'approved' | 'active' | 'closed';
  start_date: Date;
  end_date: Date;
  total_budgeted: number;
  currency: string;
  budget_lines: BudgetLine[];
  approved_by?: string;
  approved_at?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetLine {
  id: string;
  account_number: string;
  account_name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  period: string;
  notes?: string;
}

export interface BudgetVariance {
  budget_id: string;
  period: string;
  total_budgeted: number;
  total_actual: number;
  total_variance: number;
  variance_percentage: number;
  account_variances: AccountVariance[];
  generated_at: Date;
}

export interface AccountVariance {
  account_number: string;
  account_name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  variance_type: 'favorable' | 'unfavorable';
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string;
  department_id?: string;
  manager_id?: string;
  budget_owner_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  parent_department_id?: string;
  manager_id?: string;
  cost_centers: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}