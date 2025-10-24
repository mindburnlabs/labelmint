'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Key,
  Mail,
  Smartphone,
  Save,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Switch } from '@labelmint/ui';

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    timezone: string;
    language: string;
  };
  notifications: {
    email: boolean;
    push: boolean;
    taskUpdates: boolean;
    projectUpdates: boolean;
    earnings: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showStats: boolean;
    allowDirectMessages: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    apiKeys: Array<{
      id: string;
      name: string;
      createdAt: string;
      lastUsed?: string;
    }>;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    currency: 'USD' | 'EUR';
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY';
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      timezone: 'UTC',
      language: 'en',
    },
    notifications: {
      email: true,
      push: true,
      taskUpdates: true,
      projectUpdates: true,
      earnings: true,
    },
    privacy: {
      profileVisibility: 'private',
      showStats: true,
      allowDirectMessages: false,
    },
    security: {
      twoFactorEnabled: false,
      apiKeys: [],
    },
    preferences: {
      theme: 'auto',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
    },
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'security' | 'preferences'>('profile');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentUser = await authClient.getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      // Mock settings - in production, load from API
      const mockSettings: UserSettings = {
        profile: {
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          email: `${currentUser.username}@example.com`,
          phone: '+1234567890',
          timezone: 'America/New_York',
          language: 'en',
        },
        notifications: {
          email: true,
          push: true,
          taskUpdates: true,
          projectUpdates: true,
          earnings: true,
        },
        privacy: {
          profileVisibility: 'private',
          showStats: true,
          allowDirectMessages: false,
        },
        security: {
          twoFactorEnabled: false,
          apiKeys: [
            {
              id: 'key-1',
              name: 'Production API',
              createdAt: '2024-01-15T10:00:00Z',
              lastUsed: '2024-01-20T15:30:00Z',
            },
          ],
        },
        preferences: {
          theme: 'auto',
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
        },
      };

      setSettings(mockSettings);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const generateApiKey = async () => {
    try {
      const newKey = {
        id: `key-${Date.now()}`,
        name: `API Key ${settings.security.apiKeys.length + 1}`,
        createdAt: new Date().toISOString(),
      };

      setSettings(prev => ({
        ...prev,
        security: {
          ...prev.security,
          apiKeys: [...prev.security.apiKeys, newKey],
        },
      }));

      toast.success('API key generated successfully');
    } catch (error) {
      toast.error('Failed to generate API key');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      setSettings(prev => ({
        ...prev,
        security: {
          ...prev.security,
          apiKeys: prev.security.apiKeys.filter(key => key.id !== keyId),
        },
      }));

      toast.success('API key deleted successfully');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Settings</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Profile Information
                </h2>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={settings.profile.firstName}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, firstName: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={settings.profile.lastName}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, lastName: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={settings.profile.email}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, email: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={settings.profile.phone}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, phone: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Timezone
                      </label>
                      <select
                        value={settings.profile.timezone}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, timezone: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Language
                      </label>
                      <select
                        value={settings.profile.language}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            profile: { ...prev.profile, language: e.target.value },
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="zh">中文</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Notification Preferences
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Receive updates via email
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.email}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, email: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Browser and mobile notifications
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.push}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, push: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Task Updates</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        When tasks are completed
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.taskUpdates}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, taskUpdates: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Project Updates</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Project progress changes
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.projectUpdates}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, projectUpdates: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Earnings Updates</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        When you receive payments
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.earnings}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, earnings: checked },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                    Security
                  </h2>

                  {/* Two-Factor Authentication */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Two-Factor Authentication
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <Switch
                        checked={settings.security.twoFactorEnabled}
                        onChecked={(checked) =>
                          setSettings(prev => ({
                            ...prev,
                            security: { ...prev.security, twoFactorEnabled: checked },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* API Keys */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        API Keys
                      </h3>
                      <Button onClick={generateApiKey} variant="outline" size="sm">
                        <Key className="h-4 w-4 mr-2" />
                        Generate New Key
                      </Button>
                    </div>

                    {settings.security.apiKeys.length > 0 ? (
                      <div className="space-y-3">
                        {settings.security.apiKeys.map((apiKey) => (
                          <div
                            key={apiKey.id}
                            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {apiKey.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                              </p>
                              {apiKey.lastUsed && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteApiKey(apiKey.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Key className="mx-auto h-12 w-12 mb-3 opacity-50" />
                        <p>No API keys generated yet</p>
                        <p className="text-sm">Generate an API key to integrate with external services</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Privacy Settings
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Profile Visibility</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Control who can see your profile
                      </p>
                    </div>
                    <select
                      value={settings.privacy.profileVisibility}
                      onChange={(e) =>
                        setSettings(prev => ({
                          ...prev,
                          privacy: { ...prev.privacy, profileVisibility: e.target.value as 'public' | 'private' },
                        }))
                      }
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Show Statistics</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Display your performance stats
                      </p>
                    </div>
                    <Switch
                      checked={settings.privacy.showStats}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          privacy: { ...prev.privacy, showStats: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Allow Direct Messages</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Other users can message you
                      </p>
                    </div>
                    <Switch
                      checked={settings.privacy.allowDirectMessages}
                      onChecked={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          privacy: { ...prev.privacy, allowDirectMessages: checked },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Preferences */}
            {activeTab === 'preferences' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Preferences
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <select
                      value={settings.preferences.theme}
                      onChange={(e) =>
                        setSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, theme: e.target.value as 'light' | 'dark' | 'auto' },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                    >
                      <option value="auto">Auto</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={settings.preferences.currency}
                      onChange={(e) =>
                        setSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, currency: e.target.value as 'USD' | 'EUR' },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date Format
                    </label>
                    <select
                      value={settings.preferences.dateFormat}
                      onChange={(e) =>
                        setSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, dateFormat: e.target.value as 'MM/DD/YYYY' | 'DD/MM/YYYY' },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}