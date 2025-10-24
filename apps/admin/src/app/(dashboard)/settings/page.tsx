'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@labelmint/ui/components/Button';
import {
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  KeyIcon,
  UserIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`${section} settings saved successfully`);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'api', name: 'API Settings', icon: KeyIcon },
    { id: 'system', name: 'System', icon: CogIcon },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your account and system settings.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Export Settings
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-4 border-blue-500'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                  }`}
                >
                  <tab.icon className={`mr-3 h-5 w-5 ${
                    activeTab === tab.id
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`} />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Profile Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Update your personal information and profile.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.profile.firstName}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.profile.lastName}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('Profile')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notification Preferences
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose what notifications you want to receive.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  {[
                    { label: 'Email notifications for new users', description: 'Get notified when new users register' },
                    { label: 'Email notifications for disputes', description: 'Get notified when disputes are opened' },
                    { label: 'Email notifications for withdrawals', description: 'Get notified for withdrawal requests' },
                    { label: 'In-app notifications', description: 'Show notifications in the dashboard' },
                    { label: 'Weekly summary reports', description: 'Receive weekly performance summaries' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked={index < 3}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('Notifications')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Security Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage your password and security preferences.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Change Password
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Two-Factor Authentication
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        Enable 2FA for added security
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Use an authenticator app to generate codes
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Enable
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Active Sessions
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Chrome on macOS
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last active 2 minutes ago • San Francisco, CA
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave('Security')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* API Settings */}
          {activeTab === 'api' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  API Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage API keys and integration settings.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    API Keys
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Production API Key
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          mk_prod_...xyz • Created 30 days ago
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          Regenerate
                        </Button>
                        <Button variant="outline" size="sm">
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button className="mt-4" variant="outline">
                    Generate New API Key
                  </Button>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Webhook URLs
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Endpoint URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://your-domain.com/webhook"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave('API')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  System Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure system-wide settings and preferences.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Platform Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Maintenance Mode
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Temporarily disable user access
                        </p>
                      </div>
                      <input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          New User Registrations
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Allow new users to sign up
                        </p>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Project Auto-approval
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Automatically approve new projects
                        </p>
                      </div>
                      <input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Rate Limiting
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Requests per Minute
                      </label>
                      <input
                        type="number"
                        defaultValue="1000"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        File Upload Size (MB)
                      </label>
                      <input
                        type="number"
                        defaultValue="100"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave('System')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}