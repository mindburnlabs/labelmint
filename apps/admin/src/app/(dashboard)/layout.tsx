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
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { GlassNavigation } from '@/components/ui/GlassNavigation';
import { GlassCard } from '@/components/ui/GlassCard';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, permission: 'dashboard' },
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon, permission: 'users', badge: '24' },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon, permission: 'projects', badge: '12' },
  { name: 'Finance', href: '/dashboard/finance', icon: CurrencyDollarIcon, permission: 'finance' },
  { name: 'Disputes', href: '/dashboard/disputes', icon: ExclamationTriangleIcon, permission: 'disputes', badge: '3' },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-400/10 to-blue-600/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-80 glass-card m-4 shadow-2xl">
          <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <span className="text-white font-bold text-base">LM</span>
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
              className="p-2 glass-nav-item hover:scale-110 transition-all duration-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 px-4 py-6 overflow-y-auto">
            <GlassNavigation items={filteredNavigation} />
          </div>
          <div className="p-4 border-t border-white/10">
            <GlassCard className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-bounce-slow">
                <span className="text-white text-xl">?</span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Need Help?</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Check our documentation</p>
              <button className="w-full glass-button text-sm">
                View Docs
              </button>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col">
        <div className="flex flex-col flex-grow glass-card m-4 mr-0 rounded-r-2xl shadow-2xl">
          <div className="flex items-center h-20 px-6 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center space-x-4 group">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <span className="text-white font-bold text-lg">LM</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                  LabelMint
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Premium Admin Panel</p>
              </div>
            </Link>
          </div>
          <div className="flex-1 px-4 py-6 overflow-y-auto">
            <GlassNavigation items={filteredNavigation} />
          </div>
          <div className="p-4 border-t border-white/10">
            <GlassCard className="p-4 text-center hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg animate-float">
                <span className="text-white text-2xl">✨</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Need Help?</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Access comprehensive documentation and support</p>
              <button className="w-full glass-button text-sm hover:scale-105 transition-transform duration-200">
                View Documentation
              </button>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-80 relative z-10">
        {/* Premium glassmorphism header */}
        <header className="sticky top-4 z-40 mx-4 mt-4 glass-card shadow-2xl">
          <div className="flex items-center justify-between h-20 px-6">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-3 glass-nav-item hover:scale-110 transition-all duration-200"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              {/* Enhanced search bar */}
              <div className="hidden md:flex items-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                  <input
                    type="text"
                    placeholder="Search users, projects, analytics..."
                    className="relative w-80 pl-12 pr-4 py-3 glass-nav-item rounded-2xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                  />
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Enhanced quick actions */}
              <div className="hidden sm:flex items-center space-x-3">
                <button className="glass-button text-sm hover:scale-105 transition-transform duration-200">
                  + New Project
                </button>
                <button className="glass-button text-sm hover:scale-105 transition-transform duration-200">
                  + Add User
                </button>
              </div>

              {/* Premium theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-3 glass-nav-item hover:scale-110 hover:rotate-12 transition-all duration-300 group"
              >
                <div className="relative">
                  {theme === 'dark' ? (
                    <SunIcon className="h-5 w-5 group-hover:text-yellow-400 transition-colors duration-300" />
                  ) : (
                    <MoonIcon className="h-5 w-5 group-hover:text-blue-400 transition-colors duration-300" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300" />
                </div>
              </button>

              {/* Enhanced Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-3 glass-nav-item hover:scale-110 transition-all duration-200 relative group"
                >
                  <BellIcon className="h-5 w-5 group-hover:animate-bounce-slow" />
                  <span className="absolute top-2 right-2 h-3 w-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse ring-2 ring-white dark:ring-gray-800"></span>
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-ping"></span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-96 glass-card shadow-2xl animate-slide-in">
                    <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-600/10">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
                        <button className="text-xs glass-badge hover:scale-105 transition-transform duration-200">
                          Mark all read
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="divide-y divide-white/5">
                        <div className="p-4 hover:bg-white/5 transition-colors cursor-pointer group/item">
                          <div className="flex items-start space-x-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform duration-200">
                              <UsersIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors duration-200">
                                New user registration
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                John Doe joined as a worker
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-500">2 minutes ago</span>
                                <span className="glass-badge text-xs">New</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 hover:bg-white/5 transition-colors cursor-pointer group/item">
                          <div className="flex items-start space-x-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform duration-200">
                              <CheckCircleIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover/item:text-green-600 dark:group-hover/item:text-green-400 transition-colors duration-200">
                                Project completed
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Image Classification for Acme Corp
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-500">5 minutes ago</span>
                                <span className="glass-badge text-xs bg-green-500/20 text-green-600 dark:text-green-400">Success</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Premium User Menu */}
              <div className="relative group">
                <button className="flex items-center space-x-3 p-3 glass-nav-item hover:scale-105 transition-all duration-200">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      {user.profile.firstName[0]}{user.profile.lastName[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                      {user.profile.firstName} {user.profile.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize font-medium">
                      {user.role}
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Enhanced Dropdown Menu */}
                <div className="absolute right-0 mt-3 w-56 glass-card shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 animate-slide-in">
                  <div className="p-2">
                    <Link href="/dashboard/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 group/item">
                      <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {user.profile.firstName[0]}{user.profile.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">View Profile</p>
                        <p className="text-xs text-gray-500">Manage your account</p>
                      </div>
                    </Link>
                    <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200">
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <CogIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium">Settings</p>
                        <p className="text-xs text-gray-500">Preferences and more</p>
                      </div>
                    </Link>
                    <div className="border-t border-white/10 my-2"></div>
                    <button
                      onClick={logout}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group/item"
                    >
                      <div className="h-8 w-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform duration-200">
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Sign out</p>
                        <p className="text-xs text-gray-500">See you later!</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Premium Page Content */}
        <main className="flex-1 pb-8">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="glass-card p-8 animate-fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}