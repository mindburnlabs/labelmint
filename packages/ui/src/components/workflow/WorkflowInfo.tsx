import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface WorkflowInfoProps extends ComponentProps {
  selectedNode: any;
  readOnly: boolean;
}

export const WorkflowInfo = memo<WorkflowInfoProps>(({
  selectedNode,
  readOnly,
  className,
  ...props
}) => {
  if (!selectedNode) {
    return (
      <div
        className={cn(
          'bg-white/90 backdrop-blur rounded-lg p-4 shadow-lg text-sm',
          className
        )}
        {...props}
      >
        <span className="text-gray-600">
          {readOnly ? 'View only mode' : 'Click on a node to configure it'}
        </span>
      </div>
    );
  }

  const getNodeTypeInfo = (type: string) => {
    const nodeTypes = {
      trigger: { color: '#10b981', icon: '⚡' },
      task: { color: '#3b82f6', icon: '📋' },
      validation: { color: '#f59e0b', icon: '✅' },
      integration: { color: '#8b5cf6', icon: '🔗' },
      ai: { color: '#ec4899', icon: '🤖' },
      condition: { color: '#06b6d4', icon: '🔀' },
      webhook: { color: '#6366f1', icon: '🪝' },
      email: { color: '#14b8a6', icon: '✉️' },
      database: { color: '#f97316', icon: '🗄️' },
      delay: { color: '#84cc16', icon: '⏱️' },
      transform: { color: '#a855f7', icon: '🔄' },
      notification: { color: '#06b6d4', icon: '🔔' },
    };

    return nodeTypes[type] || { color: '#6b7280', icon: '📦' };
  };

  const nodeInfo = getNodeTypeInfo(selectedNode.type);

  return (
    <div
      className={cn(
        'bg-white/90 backdrop-blur rounded-lg p-4 shadow-lg',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xl"
          style={{ color: nodeInfo.color }}
        >
          {nodeInfo.icon}
        </span>
        <div className="text-sm font-medium text-gray-900">
          Selected: {selectedNode.data.label || selectedNode.type}
        </div>
      </div>

      {!readOnly && selectedNode.data.description && (
        <p className="text-xs text-gray-600 mt-2 max-w-xs">
          {selectedNode.data.description}
        </p>
      )}
    </div>
  );
});

WorkflowInfo.displayName = 'WorkflowInfo';