import React, { memo, forwardRef } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface NodeWrapperProps extends NodeProps, ComponentProps {
  children: React.ReactNode;
  selected?: boolean;
  type?: string;
  hideHandles?: boolean;
}

export const NodeWrapper = memo(forwardRef<HTMLDivElement, NodeWrapperProps>(({
  children,
  selected,
  type = 'default',
  hideHandles = false,
  className,
  id,
  data,
  ...props
}, ref) => {
  const getNodeColor = (nodeType: string) => {
    const colors = {
      trigger: 'border-green-500 bg-green-50',
      task: 'border-blue-500 bg-blue-50',
      validation: 'border-yellow-500 bg-yellow-50',
      integration: 'border-purple-500 bg-purple-50',
      ai: 'border-pink-500 bg-pink-50',
      condition: 'border-cyan-500 bg-cyan-50',
      webhook: 'border-indigo-500 bg-indigo-50',
      email: 'border-teal-500 bg-teal-50',
      database: 'border-orange-500 bg-orange-50',
      delay: 'border-lime-500 bg-lime-50',
      transform: 'border-fuchsia-500 bg-fuchsia-50',
      notification: 'border-cyan-500 bg-cyan-50',
    };

    return colors[nodeType] || 'border-gray-500 bg-gray-50';
  };

  return (
    <div
      ref={ref}
      className={cn(
        'relative min-w-[120px] rounded-lg border-2 bg-white shadow-sm transition-all duration-200 hover:shadow-md',
        getNodeColor(type),
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        className
      )}
      {...props}
    >
      {!hideHandles && (
        <>
          {/* Input Handle */}
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3 border-2 border-white bg-gray-400 hover:bg-gray-600 transition-colors"
            aria-label={`Input for node ${data?.label || id}`}
          />

          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 border-2 border-white bg-gray-400 hover:bg-gray-600 transition-colors"
            aria-label={`Output for node ${data?.label || id}`}
          />
        </>
      )}

      {/* Node Content */}
      <div className="p-3">
        {children}
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
});

NodeWrapper.displayName = 'NodeWrapper';