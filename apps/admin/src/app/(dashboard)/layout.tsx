'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/auth';
import { useTheme } from 'next-themes';
import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, permission: 'dashboard' },
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon, permission: 'users' },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon, permission: 'projects' },
  { name: 'Finance', href: '/dashboard/finance', icon: CurrencyDollarIcon, permission: 'finance' },
  { name: 'Disputes', href: '/dashboard/disputes', icon: ExclamationTriangleIcon, permission: 'disputes' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon, permission: 'analytics' },
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon, permission: 'settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      const currentNav = navigation.find((nav) => nav.href === pathname);
      if (currentNav && !canAccess(user, currentNav.permission)) {
        router.push('/dashboard');
      }
    }
  }, [user, pathname, router]);

  if (!user) {
    return null;
  }

  const filteredNavigation = navigation.filter((nav) => canAccess(user, nav.permission));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-72 bg-white dark:bg-gray-800 shadow-xl">
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LM</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  LabelMint
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  pathname === item.href
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                }`} />
                {item.name}
                {pathname === item.href && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
              <p className="text-sm font-medium">Need Help?</p>
              <p className="text-xs opacity-90 mt-1">Check our documentation for guidance</p>
              <button className="mt-3 w-full bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1.5 text-xs font-medium">
                View Docs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LM</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  LabelMint
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  pathname === item.href
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                }`} />
                {item.name}
                {pathname === item.href && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
              <p className="text-sm font-medium">Need Help?</p>
              <p className="text-xs opacity-90 mt-1">Check our documentation for guidance</p>
              <button className="mt-3 w-full bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1.5 text-xs font-medium">
                View Docs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top navigation */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              {/* Search bar */}
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-64 lg:w-96 pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Quick actions */}
              <div className="hidden sm:flex items-center space-x-2">
                <button className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  + New Project
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  + Add User
                </button>
              </div>

              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                >
                  <BellIcon className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"></span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Mark all read</span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                              <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                New user registration
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                John Doe joined as a worker
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">2 minutes ago</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Project completed
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Image Classification for Acme Corp
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">5 minutes ago</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative group">
                <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {user.profile.firstName[0]}{user.profile.lastName[0]}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.profile.firstName} {user.profile.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {user.role}
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link href="/dashboard/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Profile
                  </Link>
                  <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Settings
                  </Link>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}