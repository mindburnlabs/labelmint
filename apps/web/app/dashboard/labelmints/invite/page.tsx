'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  UserPlusIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface NewLabelMint {
  email: string;
  firstName: string;
  lastName: string;
  telegramUsername?: string;
  dailyLimit: number;
  monthlyLimit: number;
  permissions: {
    refund: boolean;
    partial_refund: boolean;
    suspend: boolean;
    edit: boolean;
  };
}

export default function InviteLabelMintPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labelMints, setLabelMints] = useState<NewLabelMint[]>([
    {
      email: '',
      firstName: '',
      lastName: '',
      telegramUsername: '',
      dailyLimit: 100,
      monthlyLimit: 3000,
      permissions: {
        refund: true,
        partial_refund: false,
        suspend: false,
        edit: false,
      }
    }
  ]);

  const addNewLabelMint = () => {
    setLabelMints([
      ...labelMints,
      {
        email: '',
        firstName: '',
        lastName: '',
        telegramUsername: '',
        dailyLimit: 100,
        monthlyLimit: 3000,
        permissions: {
          refund: true,
          partial_refund: false,
          suspend: false,
          edit: false,
        }
      }
    ]);
  };

  const removeLabelMint = (index: number) => {
    if (labelMints.length > 1) {
      setLabelMints(labelMints.filter((_, i) => i !== index));
    }
  };

  const updateLabelMint = (index: number, field: keyof NewLabelMint, value: any) => {
    const updated = [...labelMints];
    if (field === 'permissions') {
      updated[index].permissions = { ...updated[index].permissions, ...value };
    } else {
      (updated[index] as any)[field] = value;
    }
    setLabelMints(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate all LabelMints
      for (const labelMint of labelMints) {
        if (!labelMint.email || !labelMint.firstName || !labelMint.lastName) {
          throw new Error('Please fill in all required fields');
        }
      }

      // Mock API call - in real implementation, this would send invitations
      console.log('Inviting LabelMints:', labelMints);

      console.log(`${labelMints.length} LabelMint(s) invited successfully!`);

      // Redirect to main LabelMints page
      setTimeout(() => {
        router.push('/dashboard/labelmints');
      }, 1500);

    } catch (error: any) {
      alert(error.message || 'Failed to send invitations');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <span className="ml-4 text-sm text-gray-500">Invite Team Members</span>
            </div>
            <Link href="/dashboard/labelmints">
              <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to LabelMints
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How invitation works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Enter email addresses of team members you want to invite</li>
                  <li>Set initial spending limits and permissions</li>
                  <li>Invited members will receive an email to join your workspace</li>
                  <li>You can modify limits and permissions anytime after they join</li>
                </ul>
              </div>
            </div>
          </div>

          {/* LabelMints List */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Team Members ({labelMints.length})
              </h2>
              <button
                type="button"
                onClick={addNewLabelMint}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Another
              </button>
            </div>

            {labelMints.map((labelMint, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    LabelMint {index + 1}
                  </h3>
                  {labelMints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLabelMint(index)}
                      className="p-1 text-red-600 hover:text-red-800 rounded"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={labelMint.firstName}
                      onChange={(e) => updateLabelMint(index, 'firstName', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="John"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={labelMint.lastName}
                      onChange={(e) => updateLabelMint(index, 'lastName', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Doe"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={labelMint.email}
                      onChange={(e) => updateLabelMint(index, 'email', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="john.doe@example.com"
                    />
                  </div>

                  {/* Telegram Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telegram Username
                    </label>
                    <input
                      type="text"
                      value={labelMint.telegramUsername || ''}
                      onChange={(e) => updateLabelMint(index, 'telegramUsername', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="@johndoe"
                    />
                  </div>

                  {/* Daily Limit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily Spending Limit *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="10"
                        value={labelMint.dailyLimit}
                        onChange={(e) => updateLabelMint(index, 'dailyLimit', Number(e.target.value))}
                        className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="100"
                      />
                    </div>
                  </div>

                  {/* Monthly Limit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Spending Limit *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="100"
                        value={labelMint.monthlyLimit}
                        onChange={(e) => updateLabelMint(index, 'monthlyLimit', Number(e.target.value))}
                        className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="3000"
                      />
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Permissions
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={labelMint.permissions.refund}
                        onChange={(e) => updateLabelMint(index, 'permissions', { refund: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
                      />
                      <span className="text-sm text-gray-700">Refund</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={labelMint.permissions.partial_refund}
                        onChange={(e) => updateLabelMint(index, 'permissions', { partial_refund: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
                      />
                      <span className="text-sm text-gray-700">Partial Refund</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={labelMint.permissions.suspend}
                        onChange={(e) => updateLabelMint(index, 'permissions', { suspend: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
                      />
                      <span className="text-sm text-gray-700">Suspend</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={labelMint.permissions.edit}
                        onChange={(e) => updateLabelMint(index, 'permissions', { edit: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
                      />
                      <span className="text-sm text-gray-700">Edit</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Link href="/dashboard/labelmints">
              <button
                type="button"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 min-w-[150px] flex items-center"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Invitations...
                </span>
              ) : (
                <span className="flex items-center">
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Send {labelMints.length > 1 ? `${labelMints.length} ` : ''}Invitation{labelMints.length > 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}