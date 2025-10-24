import { ReactNode } from 'react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: ReactNode;
  description?: string;
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="kpi-card animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
          <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const changeColor = {
    increase: 'text-green-600 dark:text-green-400',
    decrease: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  }[changeType];

  const changeIcon = {
    increase: <ArrowUpIcon className="h-4 w-4" />,
    decrease: <ArrowDownIcon className="h-4 w-4" />,
    neutral: <MinusIcon className="h-4 w-4" />,
  }[changeType];

  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {change !== undefined && (
            <div className={`mt-2 flex items-center ${changeColor}`}>
              {changeIcon}
              <span className="ml-1 text-sm font-medium">
                {Math.abs(change)}%
              </span>
              <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                from last month
              </span>
            </div>
          )}
          {description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="h-12 w-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}