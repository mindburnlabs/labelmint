import React, { memo } from 'react';
import { MiniMap } from 'reactflow';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface WorkflowMiniMapProps extends Omit<ComponentProps, 'children'> {
  nodeColor?: (node: any) => string;
  nodeStrokeWidth?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

const defaultNodeColor = (node: any): string => {
  const nodeColors = {
    trigger: '#10b981',
    task: '#3b82f6',
    validation: '#f59e0b',
    integration: '#8b5cf6',
    ai: '#ec4899',
    condition: '#06b6d4',
    webhook: '#6366f1',
    email: '#14b8a6',
    database: '#f97316',
    delay: '#84cc16',
    transform: '#a855f7',
    notification: '#06b6d4',
  };

  return nodeColors[node.type] || '#6b7280';
};

export const WorkflowMiniMap = memo<WorkflowMiniMapProps>(({
  nodeColor = defaultNodeColor,
  nodeStrokeWidth = 3,
  position = 'bottom-left',
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-lg border border-gray-200 p-2',
        className
      )}
      {...props}
    >
      <MiniMap
        nodeColor={nodeColor}
        nodeStrokeWidth={nodeStrokeWidth}
        pannable
        zoomable
        position={position}
        className="rounded"
        maskColor="rgba(0, 0, 0, 0.1)"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
        aria-label="Workflow minimap - shows overview of entire workflow"
      />
    </div>
  );
});

WorkflowMiniMap.displayName = 'WorkflowMiniMap';