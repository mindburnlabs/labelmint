import { InlineKeyboard } from 'grammy';

export const workerBotKeyboards = {
  // Main menu keyboard
  mainMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📋 Available Tasks', 'available_tasks')
      .text('💰 My Earnings', 'my_earnings')
      .row()
      .text('👤 My Profile', 'my_profile')
      .text('🏆 Leaderboard', 'leaderboard')
      .row()
      .text('🎯 Achievements', 'achievements')
      .text('🎓 Training', 'training')
      .row()
      .text('💳 Withdraw', 'withdraw')
      .text('❓ Help', 'help');
    return keyboard;
  },

  // Tasks menu with filters
  tasksMenu: (categories: string[] = [], activeFilter: string = 'all') => {
    const keyboard = new InlineKeyboard();

    // Add category filters if available
    if (categories.length > 0) {
      const firstRow = categories.slice(0, 2);
      const secondRow = categories.slice(2, 4);

      if (firstRow.length > 0) {
        firstRow.forEach(cat => {
          keyboard.text(
            `${activeFilter === cat ? '✅ ' : ''}${cat}`,
            `filter_category_${cat}`
          );
        });
        keyboard.row();
      }

      if (secondRow.length > 0) {
        secondRow.forEach(cat => {
          keyboard.text(
            `${activeFilter === cat ? '✅ ' : ''}${cat}`,
            `filter_category_${cat}`
          );
        });
        keyboard.row();
      }
    }

    // Add sort options
    keyboard
      .text(`💰 ${activeFilter === 'high_pay' ? '✅ ' : ''}High Pay`, 'sort_high_pay')
      .text(`⚡ ${activeFilter === 'quick' ? '✅ ' : ''}Quick Tasks`, 'sort_quick')
      .row()
      .text(`🔥 ${activeFilter === 'trending' ? '✅ ' : ''}Trending`, 'sort_trending')
      .text(`⭐ ${activeFilter === 'top_rated' ? '✅ ' : ''}Top Rated`, 'sort_top_rated')
      .row()
      .text('🔄 Refresh', 'refresh_tasks')
      .text('⬅️ Main Menu', 'main_menu');
    return keyboard;
  },

  // Task details keyboard
  taskDetails: (taskId: string, isAccepted: boolean = false) => {
    const keyboard = new InlineKeyboard();

    if (!isAccepted) {
      keyboard
        .text('✅ Accept Task', `accept_task_${taskId}`)
        .text('❌ Skip', 'skip_task');
    } else {
      keyboard
        .text('📝 Start Task', `start_task_${taskId}`)
        .text('❌ Return Task', `return_task_${taskId}`);
    }

    keyboard
      .row()
      .text('📊 Project Info', `project_info_${taskId}`)
      .text('👤 Requester Info', `requester_info_${taskId}`)
      .row()
      .text('⬅️ Back to Tasks', 'available_tasks');
    return keyboard;
  },

  // Task interface keyboard
  taskInterface: (taskId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('✅ Submit', `submit_task_${taskId}`)
      .text('⏭️ Skip', `skip_current_${taskId}`)
      .row()
      .text('❓ Help', 'task_help')
      .text('⏸️ Pause', `pause_task_${taskId}`);
    return keyboard;
  },

  // Earnings menu
  earningsMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('💳 Current Balance', 'current_balance')
      .text('📊 Today\'s Earnings', 'daily_earnings')
      .row()
      .text('📈 This Week', 'weekly_earnings')
      .text('📅 This Month', 'monthly_earnings')
      .row()
      .text('📋 Transaction History', 'transaction_history')
      .text('📊 Statistics', 'earnings_stats')
      .row()
      .text('💸 Withdraw Funds', 'withdraw')
      .text('⬅️ Main Menu', 'main_menu');
    return keyboard;
  },

  // Withdrawal options
  withdrawOptions: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('💰 Withdraw All', 'withdraw_all')
      .text('💳 Custom Amount', 'withdraw_custom')
      .row()
      .text('🏦 Bank Transfer', 'withdraw_bank')
      .text('💳 USDT (TON)', 'withdraw_usdt')
      .row()
      .text('⚙️ Payment Settings', 'payment_settings')
      .text('❌ Cancel', 'cancel_withdraw');
    return keyboard;
  },

  // Profile menu
  profileMenu: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 Statistics', 'profile_stats')
      .text('🏆 Achievements', 'achievements')
      .row()
      .text('⚙️ Preferences', 'profile_settings')
      .text('🔔 Notifications', 'notification_settings')
      .row()
      .text('📞 Support', 'contact_support')
      .text('⬅️ Main Menu', 'main_menu');
    return keyboard;
  },

  // Leaderboard filters
  leaderboardFilters: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('🏆 Top Earners', 'leaderboard_earners')
      .text('⚡ Fastest Workers', 'leaderboard_speed')
      .row()
      .text('⭐ Top Quality', 'leaderboard_quality')
      .text('🔥 Rising Stars', 'leaderboard_rising')
      .row()
      .text('🌍 Global', 'leaderboard_global')
      .text('🏆 My Country', 'leaderboard_country')
      .row()
      .text('⬅️ Back', 'main_menu');
    return keyboard;
  },

  // Training modules
  trainingModules: () => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📚 Getting Started', 'training_basic')
      .text('🎯 Advanced Skills', 'training_advanced')
      .row()
      .text('🏷️ Image Labeling', 'training_images')
      .text('📝 Text Classification', 'training_text')
      .row()
      .text('💰 Payment Guide', 'training_payment')
      .text('⭐ Quality Guide', 'training_quality')
      .row()
      .text('🧪 Practice Tasks', 'practice_tasks')
      .text('⬅️ Main Menu', 'main_menu');
    return keyboard;
  },

  // Achievement details
  achievementDetails: (achievementId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('📊 View Progress', `achievement_progress_${achievementId}`)
      .text('🏆 Leaderboard', 'leaderboard')
      .row()
      .text('🎯 Related Tasks', `achievement_tasks_${achievementId}`)
      .text('⬅️ Back to Achievements', 'achievements');
    return keyboard;
  },

  // Notification preferences
  notificationSettings: (preferences: any) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text(
        `📋 New Tasks: ${preferences.new_tasks ? '✅' : '❌'}`,
        'toggle_new_tasks'
      )
      .text(
        `💰 Payments: ${preferences.payments ? '✅' : '❌'}`,
        'toggle_payments'
      )
      .row()
      .text(
        `🏆 Achievements: ${preferences.achievements ? '✅' : '❌'}`,
        'toggle_achievements'
      )
      .text(
        `📊 Daily Summary: ${preferences.daily_summary ? '✅' : '❌'}`,
        'toggle_daily_summary'
      )
      .row()
      .text(
        `🎯 Task Reminders: ${preferences.task_reminders ? '✅' : '❌'}`,
        'toggle_task_reminders'
      )
      .text(
        `🏅 Rank Changes: ${preferences.rank_changes ? '✅' : '❌'}`,
        'toggle_rank_changes'
      )
      .row()
      .text('⬅️ Back to Profile', 'my_profile');
    return keyboard;
  },

  // Quick action keyboard
  quickActions: (hasPendingTasks: boolean = false, lowBalance: boolean = false) => {
    const keyboard = new InlineKeyboard();

    if (hasPendingTasks) {
      keyboard
        .text('📋 Continue Task', 'continue_pending')
        .text('⏭️ Skip Task', 'skip_pending');
    } else {
      keyboard
        .text('📋 Find Tasks', 'available_tasks')
        .text('💰 Earn Now', 'earn_now');
    }

    keyboard.row();

    if (lowBalance) {
      keyboard.text('💳 Withdraw', 'withdraw');
    } else {
      keyboard.text('📊 Check Balance', 'current_balance');
    }

    keyboard.text('👤 Profile', 'my_profile');

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
  },

  // Rating keyboard
  rateTask: (taskId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('⭐⭐⭐⭐⭐', `rate_task_${taskId}_5`)
      .text('⭐⭐⭐⭐', `rate_task_${taskId}_4`)
      .row()
      .text('⭐⭐⭐', `rate_task_${taskId}_3`)
      .text('⭐⭐', `rate_task_${taskId}_2`)
      .row()
      .text('⭐', `rate_task_${taskId}_1`)
      .text('⏭️ Skip', 'skip_rating');
    return keyboard;
  },

  // Report issue keyboard
  reportIssue: (taskId: string) => {
    const keyboard = new InlineKeyboard();
    keyboard
      .text('🐛 Bug/Technical Issue', `report_bug_${taskId}`)
      .text('❓ Unclear Instructions', `report_unclear_${taskId}`)
      .row()
      .text('⚠️ Inappropriate Content', `report_inappropriate_${taskId}`)
      .text('💰 Payment Issue', `report_payment_${taskId}`)
      .row()
      .text('📝 Other', `report_other_${taskId}`)
      .text('❌ Cancel', 'cancel_report');
    return keyboard;
  }
};