'use client';

import { useState, useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
  ColumnDef,
} from '@tanstack/react-table';
import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EllipsisHorizontalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui';

interface LabelMintUser {
  id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'suspended';
  daily_limit: number;
  monthly_limit: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  allowed_actions: string[];
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    telegram_username?: string;
  };
  stats?: {
    completed_tasks: number;
    success_rate: number;
  };
}

interface LabelMintsTableProps {
  labelMints: LabelMintUser[];
  selectedLabelMint: LabelMintUser | null;
  onSelectLabelMint: (labelMint: LabelMintUser) => void;
}

type LabelMintAction = 'view' | 'edit' | 'delete' | 'suspend' | 'activate';

// Virtualized Row Component
const VirtualizedRow = ({
  row,
  isSelected,
  onSelect,
  onAction
}: {
  row: Row<LabelMintUser>;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: LabelMintAction, labelMint: LabelMintUser) => void;
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div
      className={`tr hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}`}
      onClick={onSelect}
    >
      {row.getVisibleCells().map((cell, index) => (
        <div
          key={cell.id}
          className={`td ${cell.column.id === 'actions' ? 'justify-end' : ''}`}
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          icon: CheckCircleIcon,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Active'
        };
      case 'inactive':
        return {
          icon: XCircleIcon,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: 'Inactive'
        };
      case 'suspended':
        return {
          icon: ClockIcon,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: 'Suspended'
        };
      default:
        return {
          icon: XCircleIcon,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: status
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );
};

// User Avatar Component
const UserAvatar = ({ user }: { user: LabelMintUser['user'] }) => {
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
        {initials}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">
          {user.first_name} {user.last_name}
        </span>
        <span className="text-xs text-gray-500">
          {user.email}
        </span>
      </div>
    </div>
  );
};

// Dropdown Menu Component
const ActionsDropdown = ({
  labelMint,
  onAction
}: {
  labelMint: LabelMintUser;
  onAction: (action: LabelMintAction, labelMint: LabelMintUser) => void;
}) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
          <EllipsisHorizontalIcon className="h-5 w-5 text-gray-500" />
        </Menu.Button>
      </div>

      <Transition
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  } group flex w-full items-center px-4 py-2 text-sm`}
                  onClick={() => onAction('view', labelMint)}
                >
                  <EyeIcon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                  View details
                </button>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  } group flex w-full items-center px-4 py-2 text-sm`}
                  onClick={() => onAction('edit', labelMint)}
                >
                  <PencilIcon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                  Edit
                </button>
              )}
            </Menu.Item>
            {labelMint.status === 'active' ? (
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } group flex w-full items-center px-4 py-2 text-sm`}
                    onClick={() => onAction('suspend', labelMint)}
                  >
                    <ClockIcon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                    Suspend
                  </button>
                )}
              </Menu.Item>
            ) : labelMint.status === 'suspended' ? (
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } group flex w-full items-center px-4 py-2 text-sm`}
                    onClick={() => onAction('activate', labelMint)}
                  >
                    <CheckCircleIcon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                    Activate
                  </button>
                )}
              </Menu.Item>
            ) : null}
            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active ? 'bg-red-100 text-red-900' : 'text-red-700'
                  } group flex w-full items-center px-4 py-2 text-sm border-t border-gray-100`}
                  onClick={() => onAction('delete', labelMint)}
                >
                  <TrashIcon className="mr-3 h-4 w-4 text-red-400 group-hover:text-red-500" />
                  Delete
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export function LabelMintsTable({
  labelMints,
  selectedLabelMint,
  onSelectLabelMint
}: LabelMintsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = labelMints.filter((labelMint) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        labelMint.user.first_name.toLowerCase().includes(searchLower) ||
        labelMint.user.last_name.toLowerCase().includes(searchLower) ||
        labelMint.user.email.toLowerCase().includes(searchLower) ||
        labelMint.status.toLowerCase().includes(searchLower)
      );
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = sortConfig.key === 'name'
          ? `${a.user.first_name} ${a.user.last_name}`
          : sortConfig.key === 'user'
          ? a.user.email
          : a[sortConfig.key as keyof LabelMintUser];

        const bValue = sortConfig.key === 'name'
          ? `${b.user.first_name} ${b.user.last_name}`
          : sortConfig.key === 'user'
          ? b.user.email
          : b[sortConfig.key as keyof LabelMintUser];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [labelMints, searchQuery, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleAction = (action: LabelMintAction, labelMint: LabelMintUser) => {
    switch (action) {
      case 'view':
      case 'edit':
        onSelectLabelMint(labelMint);
        break;
      case 'suspend':
        console.log('Suspend labelMint:', labelMint.id);
        break;
      case 'activate':
        console.log('Activate labelMint:', labelMint.id);
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this LabelMint?')) {
          console.log('Delete labelMint:', labelMint.id);
        }
        break;
    }
  };

  const columnHelper = createColumnHelper<LabelMintUser>();

  const columns: ColumnDef<LabelMintUser>[] = [
    columnHelper.display({
      id: 'user',
      header: 'LabelMint',
      cell: (info) => <UserAvatar user={info.row.original.user} />,
      size: 300,
    }),
    columnHelper.accessor('status', {
      header: () => (
        <div className="flex items-center">
          Status
          <button
            onClick={() => handleSort('status')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 100,
    }),
    columnHelper.accessor('daily_limit', {
      header: () => (
        <div className="flex items-center">
          Daily Limit
          <button
            onClick={() => handleSort('daily_limit')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => `$${info.getValue()}`,
      size: 100,
    }),
    columnHelper.accessor('monthly_limit', {
      header: () => (
        <div className="flex items-center">
          Monthly Limit
          <button
            onClick={() => handleSort('monthly_limit')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => `$${info.getValue()}`,
      size: 120,
    }),
    columnHelper.accessor('total_spent', {
      header: () => (
        <div className="flex items-center">
          Total Spent
          <button
            onClick={() => handleSort('total_spent')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => `$${info.getValue().toFixed(2)}`,
      size: 100,
    }),
    columnHelper.accessor(row => row.stats?.completed_tasks || 0, {
      id: 'completed_tasks',
      header: () => (
        <div className="flex items-center">
          Tasks
          <button
            onClick={() => handleSort('completed_tasks')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => info.getValue(),
      size: 80,
    }),
    columnHelper.accessor(row => row.stats?.success_rate || 0, {
      id: 'success_rate',
      header: () => (
        <div className="flex items-center">
          Success Rate
          <button
            onClick={() => handleSort('success_rate')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => `${info.getValue()}%`,
      size: 100,
    }),
    columnHelper.accessor('last_active_at', {
      header: () => (
        <div className="flex items-center">
          Last Active
          <button
            onClick={() => handleSort('last_active_at')}
            className="ml-2"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      size: 100,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <ActionsDropdown
          labelMint={info.row.original}
          onAction={handleAction}
        />
      ),
      size: 50,
    }),
  ];

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);

  return (
    <div className="h-full flex flex-col">
      <style jsx>{`
        .table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }
        .thead {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        .th {
          padding: 12px;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          text-align: left;
          display: flex;
          align-items: center;
        }
        .tr {
          display: flex;
          border-bottom: 1px solid #f3f4f6;
        }
        .tr:last-child {
          border-bottom: none;
        }
        .td {
          padding: 12px;
          font-size: 14px;
          color: #111827;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
      `}</style>

      {/* Table */}
      <div className="table flex-1">
        {/* Header */}
        <div className="thead">
          {table.getHeaderGroups().map(headerGroup => (
            <div key={headerGroup.id} className="tr">
              {headerGroup.headers.map(header => (
                <div key={header.id} className="th">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Virtualized Body */}
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 49px)' }}>
          {paginatedData.map((row, index) => (
            <VirtualizedRow
              key={row.id}
              row={table.getRowModel().rows[index]}
              isSelected={selectedLabelMint?.id === row.id}
              onSelect={() => onSelectLabelMint(row)}
              onAction={handleAction}
            />
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage + 1} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
        <div className="text-sm text-gray-500">
          Showing {paginatedData.length} of {filteredData.length} LabelMints
        </div>
      </div>
    </div>
  );
}