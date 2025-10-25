import React from 'react';

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
}

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', ...props }) => (
  <tr className={className} {...props}>{children}</tr>
);

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '', ...props }) => (
  <th className={className} {...props}>{children}</th>
);

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', ...props }) => (
  <td className={className} {...props}>{children}</td>
);