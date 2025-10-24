import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const TaskNode: React.FC<any> = ({ data, selected }) => {
  const getIcon = () => {
    switch (data.config?.taskType) {
      case 'labeling':
        return '📝';
      case 'review':
        return '👀';
      case 'validation':
        return '✅';
      case 'custom':
        return '⚙️';
      default:
        return '📋';
    }
  };

  return (
    <NodeWrapper id={data.id} data={data} selected={selected}>
      <div className="min-w-[200px] bg-blue-100 border-2 border-blue-500 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getIcon()}</span>
          <div>
            <div className="font-semibold text-blue-900">Task</div>
            <div className="text-xs text-blue-700">{data.label}</div>
          </div>
        </div>
        {data.config?.projectId && (
          <div className="text-xs text-blue-600 mt-2">
            Project ID: {data.config.projectId}
          </div>
        )}
        {data.config?.assignment?.type && (
          <div className="text-xs text-blue-600 mt-1">
            Assignment: {data.config.assignment.type}
          </div>
        )}
      </div>
    </NodeWrapper>
  );
};