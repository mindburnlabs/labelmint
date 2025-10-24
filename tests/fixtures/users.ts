import type { User } from '@shared/types/database';

// Pre-defined test users for consistent testing
export const testUsers: Record<string, User> = {
  admin: {
    id: 'user-admin-001',
    telegramId: '1000001',
    username: 'testadmin',
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    status: 'active',
    tonWalletAddress: 'EQDAcZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pX',
    reputation: 100,
    completedTasks: 0,
    accuracy: 1.0,
    averageTimePerTask: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastActiveAt: new Date('2024-01-01T12:00:00Z'),
    emailVerifiedAt: new Date('2024-01-01T01:00:00Z'),
    kycStatus: 'verified',
    kycSubmittedAt: new Date('2024-01-01T00:30:00Z'),
    timezone: 'UTC',
    language: 'en',
    referralCode: 'ADMIN001',
    referredBy: null,
  },

  workerHighReputation: {
    id: 'user-worker-001',
    telegramId: '1000002',
    username: 'worker_pro',
    firstName: 'Expert',
    lastName: 'Worker',
    email: 'worker@test.com',
    role: 'worker',
    status: 'active',
    tonWalletAddress: 'EQBkZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pY',
    reputation: 95,
    completedTasks: 500,
    accuracy: 0.97,
    averageTimePerTask: 120,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    lastActiveAt: new Date('2024-01-15T12:00:00Z'),
    emailVerifiedAt: new Date('2024-01-01T01:00:00Z'),
    kycStatus: 'verified',
    kycSubmittedAt: new Date('2024-01-01T00:30:00Z'),
    timezone: 'America/New_York',
    language: 'en',
    referralCode: 'WORKER01',
    referredBy: 'user-admin-001',
  },

  workerMediumReputation: {
    id: 'user-worker-002',
    telegramId: '1000003',
    username: 'worker_regular',
    firstName: 'Regular',
    lastName: 'Worker',
    email: 'worker2@test.com',
    role: 'worker',
    status: 'active',
    tonWalletAddress: 'EQClZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pZ',
    reputation: 75,
    completedTasks: 200,
    accuracy: 0.85,
    averageTimePerTask: 180,
    createdAt: new Date('2024-01-05T00:00:00Z'),
    updatedAt: new Date('2024-01-14T00:00:00Z'),
    lastActiveAt: new Date('2024-01-14T10:00:00Z'),
    emailVerifiedAt: new Date('2024-01-05T01:00:00Z'),
    kycStatus: 'verified',
    kycSubmittedAt: new Date('2024-01-05T00:30:00Z'),
    timezone: 'Europe/London',
    language: 'en',
    referralCode: 'WORKER02',
    referredBy: null,
  },

  workerLowReputation: {
    id: 'user-worker-003',
    telegramId: '1000004',
    username: 'worker_newbie',
    firstName: 'New',
    lastName: 'Worker',
    email: 'worker3@test.com',
    role: 'worker',
    status: 'active',
    tonWalletAddress: 'EQDmZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pA',
    reputation: 45,
    completedTasks: 25,
    accuracy: 0.72,
    averageTimePerTask: 300,
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-13T00:00:00Z'),
    lastActiveAt: new Date('2024-01-13T08:00:00Z'),
    emailVerifiedAt: new Date('2024-01-10T01:00:00Z'),
    kycStatus: 'pending',
    kycSubmittedAt: new Date('2024-01-12T00:30:00Z'),
    timezone: 'Asia/Tokyo',
    language: 'ja',
    referralCode: 'WORKER03',
    referredBy: null,
  },

  requester: {
    id: 'user-requester-001',
    telegramId: '1000005',
    username: 'project_owner',
    firstName: 'Project',
    lastName: 'Owner',
    email: 'requester@test.com',
    role: 'requester',
    status: 'active',
    tonWalletAddress: 'EQEnZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pB',
    reputation: 80,
    completedTasks: 10,
    accuracy: 0.9,
    averageTimePerTask: 60,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-14T00:00:00Z'),
    lastActiveAt: new Date('2024-01-14T15:00:00Z'),
    emailVerifiedAt: new Date('2024-01-01T01:00:00Z'),
    kycStatus: 'verified',
    kycSubmittedAt: new Date('2024-01-01T00:30:00Z'),
    timezone: 'UTC',
    language: 'en',
    referralCode: 'REQUEST',
    referredBy: null,
  },

  suspendedWorker: {
    id: 'user-suspended-001',
    telegramId: '1000006',
    username: 'suspended_user',
    firstName: 'Suspended',
    lastName: 'User',
    email: 'suspended@test.com',
    role: 'worker',
    status: 'suspended',
    tonWalletAddress: 'EQFoZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pC',
    reputation: 20,
    completedTasks: 5,
    accuracy: 0.5,
    averageTimePerTask: 500,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastActiveAt: new Date('2024-01-10T00:00:00Z'),
    emailVerifiedAt: new Date('2024-01-01T01:00:00Z'),
    kycStatus: 'rejected',
    kycSubmittedAt: new Date('2024-01-01T00:30:00Z'),
    timezone: 'UTC',
    language: 'en',
    referralCode: 'SUSPEND',
    referredBy: null,
  },
};

// Helper to get users by role
export const getUsersByRole = (role: 'admin' | 'worker' | 'requester'): User[] => {
  return Object.values(testUsers).filter(user => user.role === role);
};

// Helper to get active workers sorted by reputation
export const getActiveWorkersSortedByReputation = (): User[] => {
  return Object.values(testUsers)
    .filter(user => user.role === 'worker' && user.status === 'active')
    .sort((a, b) => b.reputation - a.reputation);
};

// Helper to get worker with specific reputation range
export const getWorkerWithReputationRange = (min: number, max: number): User | null => {
  return Object.values(testUsers).find(
    user => user.role === 'worker' && user.reputation >= min && user.reputation <= max
  ) || null;
};