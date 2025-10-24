import { InlineKeyboard } from 'grammy';

export const clientBotKeyboards = {
  // Main menu keyboard
  mainMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 My Projects', 'view_projects')
      .text('📈 Analytics', 'view_analytics')
      .row()
      .text('💳 Billing & Payments', 'view_billing')
      .text('👥 Team', 'view_team')
      .row()
      .text('🔔 Notifications', 'view_notifications')
      .text('⚙️ Settings', 'view_settings')
      .row()
      .text('❓ Help', 'help');
    return keyboard;
  },

  // Project management keyboard
  projectMenu: (projectId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 View Status', `project_status_${projectId}`)
      .text('📁 Upload Data', `project_upload_${projectId}`)
      .row()
      .text('📈 Statistics', `project_stats_${projectId}`)
      .text('📥 Download Results', `project_results_${projectId}`)
      .row()
      .text('✏️ Edit Project', `edit_project_${projectId}`)
      .text('🗑️ Delete', `delete_project_${projectId}`)
      .row()
      .text('⬅️ Back to Projects', 'view_projects');
    return keyboard;
  },

  // Projects list navigation
  projectsList: (hasMore: boolean, page: number = 0) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('➕ Create New Project', 'create_project')
      .row();

    if (page > 0) {
      keyboard.text('⬅️ Previous', `projects_page_${page - 1}`);
    }

    keyboard.text('🔄 Refresh', 'view_projects');

    if (hasMore) {
      keyboard.text('Next ➡️', `projects_page_${page + 1}`);
    }

    keyboard.row().text('⬅️ Main Menu', 'main_menu');
    return keyboard;
  },

  // Create project wizard keyboard
  createProjectType: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('🖼️ Image Labeling', 'type_image')
      .text('📝 Text Classification', 'type_text')
      .row()
      .text('❌ Cancel', 'cancel_create');
    return keyboard;
  },

  // Billing keyboard
  billingMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('💰 Current Balance', 'view_balance')
      .text('💳 Deposit Funds', 'deposit_funds')
      .row()
      .text('📊 Transaction History', 'transaction_history')
      .text('📈 Spending Analytics', 'spending_analytics')
      .row()
      .text('⬅️ Back to Main Menu', 'main_menu');
    return keyboard;
  },

  // Deposit options
  depositOptions: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('💳 Credit Card', 'deposit_card')
      .text('₿ Crypto', 'deposit_crypto')
      .row()
      .text('🏦 Bank Transfer', 'deposit_bank')
      .text('💰 USDT (TON)', 'deposit_usdt')
      .row()
      .text('❌ Cancel', 'cancel_deposit');
    return keyboard;
  },

  // Analytics keyboard
  analyticsMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 Project Overview', 'analytics_overview')
      .text('👥 Worker Performance', 'analytics_workers')
      .row()
      .text('💰 Cost Analysis', 'analytics_costs')
      .text('⏱️ Time Analytics', 'analytics_time')
      .row()
      .text('📈 Quality Metrics', 'analytics_quality')
      .text('📋 Export Reports', 'export_reports')
      .row()
      .text('⬅️ Back to Main Menu', 'main_menu');
    return keyboard;
  },

  // Team management keyboard
  teamMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('👥 Team Members', 'view_members')
      .text('➕ Invite Member', 'invite_member')
      .row()
      .text('🔐 Permissions', 'manage_permissions')
      .text('📊 Team Stats', 'team_stats')
      .row()
      .text('⬅️ Back to Main Menu', 'main_menu');
    return keyboard;
  },

  // Notification preferences
  notificationSettings: (preferences: any) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text(
        `📧 Project Updates: ${preferences.project_updates ? '✅' : '❌'}`,
        'toggle_project_updates'
      )
      .text(
        `💳 Payment Alerts: ${preferences.payment_alerts ? '✅' : '❌'}`,
        'toggle_payment_alerts'
      )
      .row()
      .text(
        `👥 Team Activity: ${preferences.team_activity ? '✅' : '❌'}`,
        'toggle_team_activity'
      )
      .text(
        `📊 Daily Reports: ${preferences.daily_reports ? '✅' : '❌'}`,
        'toggle_daily_reports'
      )
      .row()
      .text('⬅️ Back to Settings', 'view_settings');
    return keyboard;
  },

  // Settings menu
  settingsMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('🔔 Notifications', 'view_notifications')
      .text('🌐 Language', 'change_language')
      .row()
      .text('🔐 Privacy', 'privacy_settings')
      .text('🔗 API Keys', 'api_keys')
      .row()
      .text('⬅️ Back to Main Menu', 'main_menu');
    return keyboard;
  },

  // Confirmation keyboard
  confirmAction: (action: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('✅ Yes, Confirm', `confirm_${action}`)
      .text('❌ Cancel', `cancel_${action}`);
    return keyboard;
  },

  // Worker performance keyboard
  workerPerformance: (workerId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 View Stats', `worker_stats_${workerId}`)
      .text('💳 Payment History', `worker_payments_${workerId}`)
      .row()
      .text('📞 Contact', `contact_worker_${workerId}`)
      .text('🚫 Block', `block_worker_${workerId}`)
      .row()
      .text('⬅️ Back to Team', 'view_team');
    return keyboard;
  },

  // Quick actions for notifications
  quickActions: (projectId?: string) => {
    const keyboard = new InlineKeyboard();
    if (projectId) {
      keyboard
        .text('📊 View Project', `project_status_${projectId}`)
        .text('💰 Top Up Balance', 'deposit_funds')
        .row();
    }
    keyboard
      .text('🔔 All Notifications', 'view_notifications')
      .text('⚙️ Settings', 'view_settings');
    return keyboard;
  },

  // Pagination for lists
  pagination: (page: number, hasMore: boolean, action: string) => {
    const keyboard = new InlineKeyboard();

    if (page > 0) {
      keyboard.text('⬅️ Previous', `${action}_page_${page - 1}`);
    }

    if (page > 0 && hasMore) {
      keyboard.text('🔄', `${action}_page_${page}`);
    }

    if (hasMore) {
      keyboard.text('Next ➡️', `${action}_page_${page + 1}`);
    }

    return keyboard;
  }
};