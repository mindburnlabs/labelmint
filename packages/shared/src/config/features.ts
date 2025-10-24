// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  enableTelegramAuth: boolean;
  enableTonPayments: boolean;
  enableUsdtPayments: boolean;
  enableRealtimeCollaboration: boolean;
  enableAdvancedAnalytics: boolean;
  enableAIAssistance: boolean;
  enableBetaFeatures: boolean;
  enableDebugMode: boolean;
  enableMockData: boolean;
}

/**
 * Default feature flags
 */
export const defaultFeatureFlags: FeatureFlags = {
  enableTelegramAuth: true,
  enableTonPayments: true,
  enableUsdtPayments: true,
  enableRealtimeCollaboration: true,
  enableAdvancedAnalytics: true,
  enableAIAssistance: false,
  enableBetaFeatures: false,
  enableDebugMode: false,
  enableMockData: false
};

/**
 * Get feature flags for environment
 */
export function getFeatureFlags(env: string = process.env.NODE_ENV || 'development'): FeatureFlags {
  const flags = { ...defaultFeatureFlags };

  // Environment-specific overrides
  if (env === 'development') {
    flags.enableDebugMode = true;
    flags.enableMockData = true;
  } else if (env === 'production') {
    flags.enableDebugMode = false;
    flags.enableMockData = false;
  } else if (env === 'test') {
    flags.enableMockData = true;
    flags.enableDebugMode = true;
  }

  // Override from environment variables
  flags.enableTelegramAuth = getBooleanEnv('FEATURE_TELEGRAM_AUTH', flags.enableTelegramAuth);
  flags.enableTonPayments = getBooleanEnv('FEATURE_TON_PAYMENTS', flags.enableTonPayments);
  flags.enableUsdtPayments = getBooleanEnv('FEATURE_USDT_PAYMENTS', flags.enableUsdtPayments);
  flags.enableRealtimeCollaboration = getBooleanEnv('FEATURE_REALTIME_COLLABORATION', flags.enableRealtimeCollaboration);
  flags.enableAdvancedAnalytics = getBooleanEnv('FEATURE_ADVANCED_ANALYTICS', flags.enableAdvancedAnalytics);
  flags.enableAIAssistance = getBooleanEnv('FEATURE_AI_ASSISTANCE', flags.enableAIAssistance);
  flags.enableBetaFeatures = getBooleanEnv('FEATURE_BETA_FEATURES', flags.enableBetaFeatures);
  flags.enableDebugMode = getBooleanEnv('FEATURE_DEBUG_MODE', flags.enableDebugMode);
  flags.enableMockData = getBooleanEnv('FEATURE_MOCK_DATA', flags.enableMockData);

  return flags;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags, flags?: FeatureFlags): boolean {
  const featureFlags = flags || getFeatureFlags();
  return featureFlags[feature];
}

// Import environment helpers
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}